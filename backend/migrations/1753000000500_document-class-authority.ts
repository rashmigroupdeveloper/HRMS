/** CORE-08 / DOC-02 / RQ-JF-015: medical/compensation file authority is explicit. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    INSERT INTO core.permissions(code) VALUES ('employee.medical.read') ON CONFLICT(code) DO NOTHING;
    INSERT INTO core.role_permissions(role_id,permission_id,scope)
      SELECT r.id,p.id,'all' FROM core.roles r CROSS JOIN core.permissions p
      WHERE r.code='super_admin' AND p.code='employee.medical.read'
      ON CONFLICT(role_id,permission_id) DO NOTHING;
    INSERT INTO core.settings(key,value,value_type,description)
      VALUES ('doc.compensation_types','"payslip"'::jsonb,'string',
        'Document catalog types requiring compensation field authority for non-owner downloads')
      ON CONFLICT(key) DO NOTHING;
  `);
}
export function down(pgm: MigrationBuilder): void {
  // Keep configured authorization data on rollback; dormant grants expose no route.
  pgm.sql(`SET lock_timeout = '5s';`);
}
