/** D4/NFR-03: explicit account links and session-bound one-use S256 grants. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout='5s';
 CREATE TABLE sec.app_links (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES core.users(id),
  client_id TEXT NOT NULL CHECK(length(btrim(client_id))>0),external_subject TEXT NOT NULL CHECK(external_subject ~ '^[1-9][0-9]*$'),
  is_active BOOLEAN NOT NULL DEFAULT true,link_nonce UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by BIGINT NOT NULL REFERENCES core.users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id,user_id),UNIQUE(client_id,external_subject)
 );
 CREATE FUNCTION sec.app_link_guard() RETURNS trigger AS $$ BEGIN
  IF (NEW.id,NEW.user_id,NEW.client_id,NEW.external_subject,NEW.created_by,NEW.created_at) IS DISTINCT FROM
     (OLD.id,OLD.user_id,OLD.client_id,OLD.external_subject,OLD.created_by,OLD.created_at)
     OR (NEW.is_active IS DISTINCT FROM OLD.is_active AND NEW.link_nonce=OLD.link_nonce)
     THEN RAISE EXCEPTION 'Connected account identity is immutable; lifecycle changes require a fresh nonce'; END IF;
  RETURN NEW;
 END $$ LANGUAGE plpgsql;
 CREATE TRIGGER app_link_guard BEFORE UPDATE ON sec.app_links FOR EACH ROW EXECUTE FUNCTION sec.app_link_guard();
 CREATE TABLE sec.sso_grants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,code_hash TEXT NOT NULL UNIQUE CHECK(code_hash ~ '^[a-f0-9]{64}$'),
  link_id BIGINT NOT NULL REFERENCES sec.app_links(id),link_nonce UUID NOT NULL,session_sid UUID NOT NULL REFERENCES sec.sessions(sid),
  redirect_uri TEXT NOT NULL CHECK(length(btrim(redirect_uri))>0),challenge TEXT NOT NULL CHECK(challenge ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(expires_at>created_at),CHECK(consumed_at IS NULL OR consumed_at>=created_at)
 );
 CREATE INDEX sso_grants_expiry_idx ON sec.sso_grants(expires_at);
 CREATE FUNCTION sec.sso_grant_guard() RETURNS trigger AS $$ BEGIN
  IF (NEW.code_hash,NEW.link_id,NEW.link_nonce,NEW.session_sid,NEW.redirect_uri,NEW.challenge,NEW.expires_at,NEW.created_at) IS DISTINCT FROM
     (OLD.code_hash,OLD.link_id,OLD.link_nonce,OLD.session_sid,OLD.redirect_uri,OLD.challenge,OLD.expires_at,OLD.created_at)
     OR OLD.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'SSO grant bindings and consumed grants are immutable'; END IF;
  RETURN NEW;
 END $$ LANGUAGE plpgsql;
 CREATE TRIGGER sso_grant_guard BEFORE UPDATE ON sec.sso_grants FOR EACH ROW EXECUTE FUNCTION sec.sso_grant_guard();
 INSERT INTO core.settings(key,value,value_type,description) VALUES('auth.sso_code_ttl_seconds','120'::jsonb,'number','NFR-03: linked application one-use authorization code lifetime') ON CONFLICT(key) DO NOTHING;
 INSERT INTO core.permissions(code)VALUES('auth.sso')ON CONFLICT(code)DO NOTHING;
 INSERT INTO core.role_permissions(role_id,permission_id,scope)SELECT r.id,p.id,'all' FROM core.roles r JOIN core.permissions p ON p.code='auth.sso' ON CONFLICT(role_id,permission_id)DO NOTHING;
`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    `SET lock_timeout='5s';DROP TABLE sec.sso_grants;DROP FUNCTION sec.sso_grant_guard();DROP TABLE sec.app_links;DROP FUNCTION sec.app_link_guard();DELETE FROM core.role_permissions WHERE permission_id IN(SELECT id FROM core.permissions WHERE code='auth.sso');DELETE FROM core.permissions WHERE code='auth.sso';`,
  );
}
