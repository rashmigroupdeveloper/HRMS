/** NFR-03: expand-compatible guard for linked-signin schemas created before the guard landed. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout='5s';
 CREATE OR REPLACE FUNCTION sec.app_link_guard() RETURNS trigger AS $$ BEGIN
  IF (NEW.id,NEW.user_id,NEW.client_id,NEW.external_subject,NEW.created_by,NEW.created_at) IS DISTINCT FROM
     (OLD.id,OLD.user_id,OLD.client_id,OLD.external_subject,OLD.created_by,OLD.created_at)
     OR (NEW.is_active IS DISTINCT FROM OLD.is_active AND NEW.link_nonce=OLD.link_nonce)
     THEN RAISE EXCEPTION 'Connected account identity is immutable; lifecycle changes require a fresh nonce'; END IF;
  RETURN NEW;
 END $$ LANGUAGE plpgsql;
 DROP TRIGGER IF EXISTS app_link_guard ON sec.app_links;
 CREATE TRIGGER app_link_guard BEFORE UPDATE ON sec.app_links FOR EACH ROW EXECUTE FUNCTION sec.app_link_guard();
`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    `SET lock_timeout='5s';`,
  ); /* Keep compatible protection until the base linked-signin migration drops its table/function. */
}
