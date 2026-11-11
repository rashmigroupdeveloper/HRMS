/** LC-02/CORE-10: IT receives stakeholder tasks, never HR employee conversion. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
 INSERT INTO core.permissions(code) VALUES ('lifecycle.onboard.tasks') ON CONFLICT(code) DO NOTHING;
 INSERT INTO core.role_permissions(role_id,permission_id,scope)
 SELECT r.id,p.id,'all' FROM core.roles r CROSS JOIN core.permissions p
 WHERE r.code IN ('it_admin','super_admin') AND p.code='lifecycle.onboard.tasks'
 ON CONFLICT(role_id,permission_id) DO NOTHING;`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
}
