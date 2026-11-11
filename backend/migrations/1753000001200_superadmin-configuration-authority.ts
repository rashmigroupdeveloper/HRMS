/** CORE-10/11: sponsor delegates configuration from Super Admin; processing stays separate. */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    INSERT INTO core.permissions(code) VALUES
      ('admin.workflows'), ('payroll.config.manage'), ('hr.config.manage'), ('system.config.manage')
      ON CONFLICT(code) DO NOTHING;
    INSERT INTO core.role_permissions(role_id,permission_id,scope)
      SELECT r.id,p.id,'all' FROM core.roles r CROSS JOIN core.permissions p
      WHERE r.code='super_admin' AND p.code IN
        ('admin.workflows','payroll.config.manage','hr.config.manage','system.config.manage')
      ON CONFLICT(role_id,permission_id) DO NOTHING;
    DELETE FROM core.role_permissions rp USING core.roles r,core.permissions p
      WHERE rp.role_id=r.id AND rp.permission_id=p.id
        AND r.code='hr_head' AND p.code='admin.rbac.read';
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Preserve administrator delegation decisions and do not restore explicitly revoked access.
  pgm.sql(`SET lock_timeout = '5s';`);
}
