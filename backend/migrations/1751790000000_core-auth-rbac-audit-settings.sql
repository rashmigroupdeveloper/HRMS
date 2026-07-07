SET lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS core;

CREATE OR REPLACE FUNCTION core.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TABLE core.users (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id     BIGINT,
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
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
  code       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER roles_updated_at BEFORE UPDATE ON core.roles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE core.permissions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
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
  scope_org_unit_id BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, scope_org_unit_id)
);
CREATE TRIGGER user_roles_updated_at BEFORE UPDATE ON core.user_roles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE core.audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES core.users(id),
  action        TEXT NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     BIGINT,
  field         TEXT,
  old_value     TEXT,
  new_value     TEXT,
  ip            INET,
  at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  prev_hash     TEXT NOT NULL,
  row_hash      TEXT NOT NULL
);
CREATE INDEX audit_log_entity_idx ON core.audit_log (entity, entity_id, at);

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

CREATE OR REPLACE FUNCTION core.audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'core.audit_log is append-only (CORE-11 / MCA edit-log rule)';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON core.audit_log
  FOR EACH ROW EXECUTE FUNCTION core.audit_log_immutable();

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

CREATE TABLE core.settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  value_type  TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_by  BIGINT REFERENCES core.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON core.settings
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
