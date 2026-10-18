/**
 * E2E-008: the probation board is readable by hr_ops (org unit) and managers
 * (subtree); only hr_head (and super_admin) decide confirmation/extension/separation.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

const GRANTS: [string, string, string][] = [
  ['hr_ops', 'lifecycle.probation.view', 'org_unit'],
  ['manager', 'lifecycle.probation.view', 'subtree'],
  ['senior_manager', 'lifecycle.probation.view', 'subtree'],
  ['hr_head', 'lifecycle.probation.view', 'all'],
  ['hr_head', 'lifecycle.probation.decide', 'all'],
  ['super_admin', 'lifecycle.probation.view', 'all'],
  ['super_admin', 'lifecycle.probation.decide', 'all'],
];

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`INSERT INTO core.permissions (code) VALUES ('lifecycle.probation.view'), ('lifecycle.probation.decide') ON CONFLICT (code) DO NOTHING;`);
  for (const [role, perm, scope] of GRANTS) {
    pgm.sql(`INSERT INTO core.role_permissions (role_id, permission_id, scope)
      SELECT r.id, p.id, '${scope}' FROM core.roles r, core.permissions p WHERE r.code = '${role}' AND p.code = '${perm}'
      ON CONFLICT (role_id, permission_id) DO NOTHING;`);
  }
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DELETE FROM core.permissions WHERE code IN ('lifecycle.probation.view', 'lifecycle.probation.decide');`);
}
