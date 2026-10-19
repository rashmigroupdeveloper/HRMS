/** CORE-10/LC-01: machine possession never replaces runtime business permission. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout='5s';
    INSERT INTO core.permissions(code) VALUES('integration.ats.receive') ON CONFLICT(code) DO NOTHING;
    INSERT INTO core.role_permissions(role_id,permission_id,scope)
      SELECT r.id,p.id,'all' FROM core.roles r JOIN core.permissions p ON p.code='integration.ats.receive'
      WHERE r.code='super_admin' ON CONFLICT(role_id,permission_id) DO NOTHING;
  `);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout='5s';
    DELETE FROM core.role_permissions WHERE permission_id IN (SELECT id FROM core.permissions WHERE code='integration.ats.receive');
    DELETE FROM core.permissions WHERE code='integration.ats.receive';
  `);
}
