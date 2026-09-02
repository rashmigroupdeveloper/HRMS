/**
 * CORE-10 / CORE-11 — historical org-unit scope on the append-only audit log.
 *
 * Version 1 hashes predate scope_org_unit_id. New rows use version 2 and hash
 * the scope value as part of row content, so adding data scoping does not make
 * the tamper-evident chain weaker and does not invalidate existing evidence.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE core.audit_log
      ADD COLUMN scope_org_unit_id BIGINT REFERENCES core.org_units(id),
      ADD COLUMN hash_version SMALLINT NOT NULL DEFAULT 1
        CHECK (hash_version IN (1, 2));

    ALTER TABLE core.audit_log ALTER COLUMN hash_version SET DEFAULT 2;
    CREATE INDEX audit_log_scope_idx
      ON core.audit_log (scope_org_unit_id, at DESC, id DESC);

    CREATE OR REPLACE FUNCTION core.audit_log_chain() RETURNS trigger AS $$
    DECLARE
      last_hash TEXT;
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('core.audit_log'));
      SELECT row_hash INTO last_hash FROM core.audit_log ORDER BY id DESC LIMIT 1;
      NEW.prev_hash := COALESCE(last_hash, 'GENESIS');
      NEW.hash_version := 2;
      NEW.row_hash := encode(digest(
        NEW.prev_hash
          || coalesce(NEW.actor_user_id::text, '') || '|' || NEW.action
          || '|' || NEW.entity || '|' || coalesce(NEW.entity_id::text, '')
          || '|' || coalesce(NEW.field, '') || '|' || coalesce(NEW.old_value, '')
          || '|' || coalesce(NEW.new_value, '') || '|' || coalesce(NEW.ip::text, '')
          || '|' || NEW.at::text
          || '|' || coalesce(NEW.scope_org_unit_id::text, '') || '|v2',
        'sha256'), 'hex');
      RETURN NEW;
    END $$ LANGUAGE plpgsql;

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

        IF r.hash_version = 1 THEN
          computed := encode(digest(
            r.prev_hash
              || coalesce(r.actor_user_id::text, '') || '|' || r.action
              || '|' || r.entity || '|' || coalesce(r.entity_id::text, '')
              || '|' || coalesce(r.field, '') || '|' || coalesce(r.old_value, '')
              || '|' || coalesce(r.new_value, '') || '|' || coalesce(r.ip::text, '')
              || '|' || r.at::text,
            'sha256'), 'hex');
        ELSE
          computed := encode(digest(
            r.prev_hash
              || coalesce(r.actor_user_id::text, '') || '|' || r.action
              || '|' || r.entity || '|' || coalesce(r.entity_id::text, '')
              || '|' || coalesce(r.field, '') || '|' || coalesce(r.old_value, '')
              || '|' || coalesce(r.new_value, '') || '|' || coalesce(r.ip::text, '')
              || '|' || r.at::text
              || '|' || coalesce(r.scope_org_unit_id::text, '') || '|v2',
            'sha256'), 'hex');
        END IF;

        IF computed <> r.row_hash THEN
          RETURN r.id;
        END IF;
        expected_prev := r.row_hash;
      END LOOP;
      RETURN NULL;
    END $$ LANGUAGE plpgsql;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM core.audit_log WHERE hash_version = 2) THEN
        RAISE EXCEPTION 'cannot remove audit scope after version-2 audit evidence exists';
      END IF;
    END $$;

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

    DROP INDEX core.audit_log_scope_idx;
    ALTER TABLE core.audit_log DROP COLUMN hash_version;
    ALTER TABLE core.audit_log DROP COLUMN scope_org_unit_id;
  `);
}
