/**
 * Handover item 2 (SOW 004, C-48): org masters CRUD is its own permission,
 * held by super_admin only (docs/08 §2: super_admin owns system configuration).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    INSERT INTO core.permissions (code) VALUES ('org.masters.manage') ON CONFLICT (code) DO NOTHING;
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
      SELECT r.id, p.id, 'all' FROM core.roles r, core.permissions p
       WHERE r.code = 'super_admin' AND p.code = 'org.masters.manage'
      ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DELETE FROM core.permissions WHERE code = 'org.masters.manage';`);
}
