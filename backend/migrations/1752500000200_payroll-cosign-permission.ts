/**
 * C-04 / docs/08 §2: approving (co-signing) a computed payroll run is its own
 * permission, granted to hr_head (and to super_admin, which holds every
 * permission so it can delegate; run.service refuses its break-glass co-sign). Replaces the hard-coded role list
 * (hr_head | super_admin | ceo_cell) in run.service. Whether super_admin may
 * co-sign as break-glass is a recorded client decision (default: no).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    INSERT INTO core.permissions (code) VALUES ('payroll.run.cosign') ON CONFLICT (code) DO NOTHING;
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
      SELECT r.id, p.id, 'all' FROM core.roles r, core.permissions p
       WHERE r.code IN ('hr_head', 'super_admin') AND p.code = 'payroll.run.cosign'
      ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DELETE FROM core.permissions WHERE code = 'payroll.run.cosign';`);
}
