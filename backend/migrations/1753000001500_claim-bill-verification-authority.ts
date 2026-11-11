/** CLM-03/CORE-10: receipt substantiation is distinct from a manager's business approval. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
 INSERT INTO core.permissions(code) VALUES ('claims.verify') ON CONFLICT(code) DO NOTHING;
 INSERT INTO core.role_permissions(role_id,permission_id,scope)
 SELECT r.id,p.id,CASE WHEN r.code='hr_ops' THEN 'org_unit' ELSE 'all' END
 FROM core.roles r CROSS JOIN core.permissions p
 WHERE r.code IN ('hr_ops','hr_head','super_admin') AND p.code='claims.verify'
 ON CONFLICT(role_id,permission_id) DO NOTHING;`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
}
