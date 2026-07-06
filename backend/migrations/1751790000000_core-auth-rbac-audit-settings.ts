/**
 * Migration 0001 — core schema: auth, RBAC, hash-chained audit log, settings.
 * Spec: docs/03 §1 (tables) · docs/08 (RBAC model) · docs/14 §7.4 (hash chain, MCA rule).
 *
 * Conventions honored (docs/03, backend/migrations/README.md):
 *  - lock_timeout set first — a blocked migration fails fast, never freezes prod.
 *  - Every table: identity PK + created_at/updated_at (trigger-maintained).
 *  - audit_log is INSERT-only, enforced by trigger (not just revoked grants).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE EXTENSION IF NOT EXISTS pgcrypto; -- digest() for the audit hash chain

    CREATE SCHEMA IF NOT EXISTS core;

    -- updated_at maintainer (shared by every table)
    CREATE OR REPLACE FUNCTION core.set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END $$ LANGUAGE plpgsql;

    ------------------------------------------------------------------
    -- Auth & access (docs/03 §1)
    ------------------------------------------------------------------
    CREATE TABLE core.users (
      id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id     BIGINT,            -- FK to core.employees added in the org/employees migration
      email           CITEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,     -- bcrypt (EMS hashes carry over on import — doc 11 §0.1)
      is_active       BOOLEAN NOT NULL DEFAULT true,
      last_login_at   TIMESTAMPTZ,
      failed_attempts SMALLINT NOT NULL DEFAULT 0,
      locked_until    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER users_updated_at BEFORE UPDATE ON core.users
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.roles (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code       TEXT UNIQUE NOT NULL,   -- stable machine name (docs/08 §1 catalog)
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER roles_updated_at BEFORE UPDATE ON core.roles
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.permissions (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code       TEXT UNIQUE NOT NULL,   -- module.action grid (CORE-10)
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER permissions_updated_at BEFORE UPDATE ON core.permissions
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.role_permissions (
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      role_id       BIGINT NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
      permission_id BIGINT NOT NULL REFERENCES core.permissions(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (role_id, permission_id)
    );
    CREATE TRIGGER role_permissions_updated_at BEFORE UPDATE ON core.role_permissions
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.user_roles (
      id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id           BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
      role_id           BIGINT NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
      scope_org_unit_id BIGINT,          -- FK to core.org_units added in the org migration
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role_id, scope_org_unit_id)
    );
    CREATE TRIGGER user_roles_updated_at BEFORE UPDATE ON core.user_roles
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Audit log — append-only + hash-chained (CORE-11, NFR-04, doc 14 §7.4)
    ------------------------------------------------------------------
    CREATE TABLE core.audit_log (
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      actor_user_id BIGINT REFERENCES core.users(id),  -- NULL = system job
      action        TEXT NOT NULL,      -- 'create'|'update'|'delete'|'login'|'approve'|'finalize'...
      entity        TEXT NOT NULL,      -- e.g. 'core.employees'
      entity_id     BIGINT,
      field         TEXT,
      old_value     TEXT,
      new_value     TEXT,               -- sensitive values stored MASKED by the app layer
      ip            INET,
      at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      prev_hash     TEXT NOT NULL,      -- hash of the previous row ('GENESIS' for row 1)
      row_hash      TEXT NOT NULL       -- sha256(prev_hash ‖ this row's content)
    );
    CREATE INDEX audit_log_entity_idx ON core.audit_log (entity, entity_id, at);

    -- Hash chain: each row cryptographically commits to the one before it.
    -- Advisory xact lock serializes writers so the chain never forks.
    CREATE OR REPLACE FUNCTION core.audit_log_chain() RETURNS trigger AS $$
    DECLARE
      last_hash TEXT;
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('core.audit_log'));
      SELECT row_hash INTO last_hash FROM core.audit_log ORDER BY id DESC LIMIT 1;
      NEW.prev_hash := COALESCE(last_hash, 'GENESIS');
      NEW.row_hash := encode(digest(
        NEW.prev_hash
          || coalesce(NEW.actor_user_id::text, '') || '|' || NEW.action
          || '|' || NEW.entity || '|' || coalesce(NEW.entity_id::text, '')
          || '|' || coalesce(NEW.field, '') || '|' || coalesce(NEW.old_value, '')
          || '|' || coalesce(NEW.new_value, '') || '|' || coalesce(NEW.ip::text, '')
          || '|' || NEW.at::text,
        'sha256'), 'hex');
      RETURN NEW;
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER audit_log_chain BEFORE INSERT ON core.audit_log
      FOR EACH ROW EXECUTE FUNCTION core.audit_log_chain();

    -- INSERT-only: any UPDATE/DELETE is rejected at the database layer.
    CREATE OR REPLACE FUNCTION core.audit_log_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'core.audit_log is append-only (CORE-11 / MCA edit-log rule)';
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON core.audit_log
      FOR EACH ROW EXECUTE FUNCTION core.audit_log_immutable();

    -- Tamper detection: recompute the chain; returns the first broken row id (NULL = intact).
    CREATE OR REPLACE FUNCTION core.verify_audit_chain() RETURNS BIGINT AS $$
    DECLARE
      r RECORD;
      expected_prev TEXT := 'GENESIS';
      computed TEXT;
    BEGIN
      FOR r IN SELECT * FROM core.audit_log ORDER BY id LOOP
        IF r.prev_hash <> expected_prev THEN
          RETURN r.id;
        END IF;
        computed := encode(digest(
          r.prev_hash
            || coalesce(r.actor_user_id::text, '') || '|' || r.action
            || '|' || r.entity || '|' || coalesce(r.entity_id::text, '')
            || '|' || coalesce(r.field, '') || '|' || coalesce(r.old_value, '')
            || '|' || coalesce(r.new_value, '') || '|' || coalesce(r.ip::text, '')
            || '|' || r.at::text,
          'sha256'), 'hex');
        IF computed <> r.row_hash THEN
          RETURN r.id;
        END IF;
        expected_prev := r.row_hash;
      END LOOP;
      RETURN NULL;
    END $$ LANGUAGE plpgsql;

    ------------------------------------------------------------------
    -- Settings — typed key-value store; every policy number's home (docs/04 §8)
    ------------------------------------------------------------------
    CREATE TABLE core.settings (
      key         TEXT PRIMARY KEY,     -- e.g. 'att.grace_in_minutes', 'pay.pf_wage_base'
      value       JSONB NOT NULL,
      value_type  TEXT NOT NULL,        -- 'number'|'string'|'boolean'|'json' — app-validated
      description TEXT NOT NULL,        -- what this policy controls + its doc source
      updated_by  BIGINT REFERENCES core.users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER settings_updated_at BEFORE UPDATE ON core.settings
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS core.settings;
    DROP TABLE IF EXISTS core.audit_log;
    DROP FUNCTION IF EXISTS core.verify_audit_chain();
    DROP FUNCTION IF EXISTS core.audit_log_immutable();
    DROP FUNCTION IF EXISTS core.audit_log_chain();
    DROP TABLE IF EXISTS core.user_roles;
    DROP TABLE IF EXISTS core.role_permissions;
    DROP TABLE IF EXISTS core.permissions;
    DROP TABLE IF EXISTS core.roles;
    DROP TABLE IF EXISTS core.users;
    DROP FUNCTION IF EXISTS core.set_updated_at();
    DROP SCHEMA IF EXISTS core;
  `);
}
