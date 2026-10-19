/**
 * E2E-004 (O25: routing holds), E2E-005 (hr_head read-only RBAC matrix) and E2E-028 (ROLE_TASKS O5, O9): hr_ops maintains holidays by location and runs the month-lock
 * checklist/lock for the companies in its scope. Holidays get their own permission so hr_ops
 * does not need admin.settings.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

const GRANTS: [string, string, string][] = [
  ['hr_ops', 'attendance.holidays.manage', 'org_unit'],
  ['hr_head', 'attendance.holidays.manage', 'all'],
  ['super_admin', 'attendance.holidays.manage', 'all'],
  ['hr_ops', 'attendance.month_lock', 'org_unit'],
  ['hr_ops', 'workflow.routing_holds', 'org_unit'],
  ['hr_head', 'workflow.routing_holds', 'all'],
  ['super_admin', 'workflow.routing_holds', 'all'],
  ['hr_head', 'admin.rbac.read', 'all'],
  ['super_admin', 'admin.rbac.read', 'all'],
];

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`INSERT INTO core.permissions (code) VALUES ('attendance.holidays.manage'), ('workflow.routing_holds'), ('admin.rbac.read') ON CONFLICT (code) DO NOTHING;`);
  for (const [role, perm, scope] of GRANTS) {
    pgm.sql(`INSERT INTO core.role_permissions (role_id, permission_id, scope)
      SELECT r.id, p.id, '${scope}' FROM core.roles r, core.permissions p WHERE r.code = '${role}' AND p.code = '${perm}'
      ON CONFLICT (role_id, permission_id) DO NOTHING;`);
  }
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DELETE FROM core.role_permissions rp USING core.roles r, core.permissions p
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'hr_ops' AND p.code = 'attendance.month_lock';
    DELETE FROM core.permissions WHERE code IN ('attendance.holidays.manage', 'workflow.routing_holds', 'admin.rbac.read');`);
}
