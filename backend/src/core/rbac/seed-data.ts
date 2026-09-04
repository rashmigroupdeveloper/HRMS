/**
 * RBAC seed — docs/08 §1 (role catalog) + §2 (permission grid), encoded verbatim.
 *
 * Scope semantics (docs/08 legend) are enforced by the authorization layer at
 * query time — 'subtree' via core.reporting_tree, 'org_unit' via
 * user_roles.scope_org_unit_id, 'own' via the requester's employee link:
 *   all      = ✓ full          subtree  = S (own reporting subtree)
 *   own      = O (own records) org_unit = P (scoped to entity/plant)
 *   readonly = R
 *
 * Hard rules (docs/08 §2): it_admin NEVER holds compensation.read (separation
 * of duties) · managers NEVER hold attendance.manual_override (PP-v2-18) ·
 * payroll.run.finalize needs payroll_admin action PLUS hr_head co-sign ·
 * payroll.run.reopen is super_admin only.
 */

export type RoleCode =
  | 'employee'
  | 'manager'
  | 'senior_manager'
  | 'hr_ops'
  | 'hr_head'
  | 'payroll_admin'
  | 'plant_head'
  | 'ceo_cell'
  | 'it_admin'
  | 'super_admin'
  | 'compliance_officer'
  | 'dpo';

export type Scope = 'all' | 'subtree' | 'own' | 'org_unit' | 'readonly';

export interface RoleSeed {
  code: RoleCode;
  name: string;
}

/** docs/08 §1 — the ten roles. `manager`/`senior_manager` are DERIVED at runtime
 *  from core.reporting_tree (depth ≥ 1 / ≥ 2), never manually granted. */
export const ROLES: readonly RoleSeed[] = [
  { code: 'employee', name: 'Employee (ESS)' },
  { code: 'manager', name: 'Reporting Manager (derived)' },
  { code: 'senior_manager', name: 'Senior Manager — manager of managers (derived)' },
  { code: 'hr_ops', name: 'HR Operations' },
  { code: 'hr_head', name: 'HR Head' },
  { code: 'payroll_admin', name: 'Payroll Administrator' },
  { code: 'plant_head', name: 'Plant / Business Head' },
  { code: 'ceo_cell', name: 'CEO Cell / Executive' },
  { code: 'it_admin', name: 'IT / System Administrator' },
  { code: 'super_admin', name: 'Super Administrator (break-glass)' },
  { code: 'compliance_officer', name: 'Compliance Officer' },
  { code: 'dpo', name: 'Data Protection Officer' },
] as const;

export const PERMISSIONS = [
  'employee.read',
  'employee.write',
  'employee.compensation.read',
  'employee.statutory_ids.read',
  'attendance.own',
  'attendance.team.read',
  'attendance.roster.write',
  'attendance.manual_override',
  'attendance.month_lock',
  'attendance.muster.export',
  'leave.own',
  'leave.approve',
  'ar.approve',
  'od.approve',
  'ot.approve',
  'claims.own',
  'claims.approve',
  'leave.admin',
  'payroll.run.view',
  'payroll.run.manage',
  'payroll.run.finalize',
  'payroll.run.reopen',
  'payroll.reports',
  'salary.write',
  'lifecycle.onboard.convert',
  'lifecycle.confirmation.approve',
  'lifecycle.separation.approve',
  'letters.issue',
  'assets.manage',
  'helpdesk.agent',
  'engagement.publish',
  'reports.hr',
  'reports.bu',
  'reports.ceo',
  'admin.users',
  'admin.roles',
  'admin.settings',
  'admin.devices',
  'admin.integrations',
  'audit.read',
  // ── Phase 5 Stage 5.2 — identity hardening (SEC-01..11) ───────────────────
  // Held by IT, NOT by HR: these govern how people authenticate, not what HR
  // data they may see. `sec.mfa.manage` can reset someone's second factor, so
  // its own use is step-up gated and audited.
  'sec.session.revoke',
  'sec.mfa.manage',
  // ── Phase 5 Stage 5.7 — statutory registrations, licences, calendar ───────
  // Statutory obligations, NOT system settings: these sit with HR/compliance,
  // never with IT. Evidence upload is separable so recording a challan can be
  // delegated without handing over the ability to rewrite the calendar.
  'cmp.licence.manage',
  'cmp.calendar.manage',
  'cmp.evidence.upload',
  'cmp.register.generate',
  // ── Phase 5 Stage 5.5 — POSH / grievance / whistleblower (skeleton) ────────
  // POSH handlers are hr_head + super_admin for v1 — NOT a fake IC role.
  // IC membership is a sponsor appointment; empty committee is the honest state.
  'ird.posh.handle',
  'ird.grievance.handle',
  'ird.whistle.intake',
  'prv.notice.manage',
  'prv.consent.read',
  'prv.rights.handle',
  'prv.retention.manage',
  'prv.breach.manage',
  'doc.vault.own',
  'doc.vault.manage',
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export interface Grant {
  permission: PermissionCode;
  scope: Scope;
  note?: string;
}

const APPROVAL_PERMS: readonly PermissionCode[] = [
  'leave.approve',
  'ar.approve',
  'od.approve',
  'ot.approve',
];

function grants(perms: readonly PermissionCode[], scope: Scope, note?: string): Grant[] {
  return perms.map((permission) => (note ? { permission, scope, note } : { permission, scope }));
}

/** docs/08 §2 — the permission grid, row-faithful. */
export const ROLE_GRANTS: Readonly<Record<RoleCode, readonly Grant[]>> = {
  employee: [
    { permission: 'employee.read', scope: 'own' },
    { permission: 'employee.compensation.read', scope: 'own', note: 'own payslip only' },
    { permission: 'employee.statutory_ids.read', scope: 'own' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'doc.vault.own', scope: 'own' },
    { permission: 'claims.own', scope: 'all' },
  ],
  manager: [
    { permission: 'employee.read', scope: 'subtree' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'attendance.team.read', scope: 'subtree' },
    { permission: 'attendance.roster.write', scope: 'subtree' },
    { permission: 'attendance.muster.export', scope: 'subtree' },
    ...grants(APPROVAL_PERMS, 'subtree'),
    { permission: 'claims.approve', scope: 'subtree' },
    { permission: 'lifecycle.confirmation.approve', scope: 'subtree', note: 'step 1' },
    { permission: 'lifecycle.separation.approve', scope: 'subtree', note: 'step 1' },
    { permission: 'reports.hr', scope: 'subtree' },
    { permission: 'doc.vault.own', scope: 'own' },
  ],
  senior_manager: [
    { permission: 'employee.read', scope: 'subtree' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'attendance.team.read', scope: 'subtree', note: 'entire subtree (KQ)' },
    { permission: 'attendance.roster.write', scope: 'subtree' },
    { permission: 'attendance.muster.export', scope: 'subtree' },
    ...grants(APPROVAL_PERMS, 'subtree'),
    { permission: 'claims.approve', scope: 'subtree' },
    { permission: 'lifecycle.confirmation.approve', scope: 'subtree' },
    { permission: 'lifecycle.separation.approve', scope: 'subtree' },
    { permission: 'reports.hr', scope: 'subtree' },
    { permission: 'doc.vault.own', scope: 'own' },
  ],
  hr_ops: [
    { permission: 'employee.read', scope: 'org_unit' },
    { permission: 'employee.write', scope: 'org_unit' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'attendance.team.read', scope: 'org_unit' },
    { permission: 'attendance.roster.write', scope: 'org_unit' },
    { permission: 'attendance.manual_override', scope: 'org_unit', note: 'reason + audit mandatory' },
    { permission: 'attendance.muster.export', scope: 'org_unit' },
    ...grants(APPROVAL_PERMS, 'org_unit', 'step 2 where chain says'),
    { permission: 'claims.approve', scope: 'org_unit', note: 'bill verification step' },
    { permission: 'leave.admin', scope: 'org_unit' },
    { permission: 'lifecycle.onboard.convert', scope: 'org_unit' },
    { permission: 'lifecycle.separation.approve', scope: 'org_unit', note: 'admin closure step' },
    { permission: 'letters.issue', scope: 'org_unit' },
    { permission: 'assets.manage', scope: 'org_unit' },
    { permission: 'helpdesk.agent', scope: 'all' },
    { permission: 'engagement.publish', scope: 'org_unit' },
    { permission: 'reports.hr', scope: 'org_unit' },
    { permission: 'cmp.calendar.manage', scope: 'org_unit' },
    { permission: 'cmp.evidence.upload', scope: 'org_unit' },
    { permission: 'doc.vault.own', scope: 'own' },
    { permission: 'doc.vault.manage', scope: 'org_unit' },
  ],
  hr_head: [
    { permission: 'employee.read', scope: 'all' },
    { permission: 'employee.write', scope: 'all' },
    { permission: 'employee.compensation.read', scope: 'all' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'attendance.team.read', scope: 'all' },
    { permission: 'attendance.roster.write', scope: 'all' },
    { permission: 'attendance.manual_override', scope: 'all', note: 'reason + audit mandatory' },
    { permission: 'attendance.month_lock', scope: 'all' },
    { permission: 'attendance.muster.export', scope: 'all' },
    ...grants(APPROVAL_PERMS, 'all'),
    { permission: 'claims.approve', scope: 'all' },
    { permission: 'leave.admin', scope: 'all' },
    { permission: 'payroll.run.view', scope: 'readonly' },
    { permission: 'payroll.run.finalize', scope: 'all', note: 'co-sign — two-person rule' },
    { permission: 'payroll.reports', scope: 'all' },
    { permission: 'salary.write', scope: 'all', note: 'approval of revisions' },
    { permission: 'lifecycle.onboard.convert', scope: 'all' },
    { permission: 'lifecycle.confirmation.approve', scope: 'all' },
    { permission: 'lifecycle.separation.approve', scope: 'all' },
    { permission: 'letters.issue', scope: 'all' },
    { permission: 'assets.manage', scope: 'all' },
    { permission: 'helpdesk.agent', scope: 'all' },
    { permission: 'engagement.publish', scope: 'all' },
    { permission: 'reports.hr', scope: 'all' },
    { permission: 'reports.bu', scope: 'all' },
    { permission: 'admin.settings', scope: 'all', note: 'HR policy values only' },
    { permission: 'audit.read', scope: 'org_unit' },
    { permission: 'cmp.licence.manage', scope: 'all' },
    { permission: 'cmp.calendar.manage', scope: 'all' },
    { permission: 'cmp.evidence.upload', scope: 'all' },
    { permission: 'cmp.register.generate', scope: 'all' },
    { permission: 'ird.posh.handle', scope: 'all', note: 'v1 skeleton — IC role deferred to sponsor' },
    { permission: 'ird.grievance.handle', scope: 'all' },
    { permission: 'ird.whistle.intake', scope: 'all' },
    { permission: 'doc.vault.own', scope: 'own' },
    { permission: 'doc.vault.manage', scope: 'all' },
  ],
  payroll_admin: [
    { permission: 'employee.read', scope: 'all' },
    { permission: 'employee.compensation.read', scope: 'all' },
    { permission: 'employee.statutory_ids.read', scope: 'all', note: 'the only unmasked role besides super_admin' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'attendance.team.read', scope: 'readonly' },
    { permission: 'attendance.month_lock', scope: 'all' },
    { permission: 'attendance.muster.export', scope: 'all' },
    { permission: 'claims.approve', scope: 'all', note: 'payment batch step' },
    { permission: 'payroll.run.view', scope: 'all' },
    { permission: 'payroll.run.manage', scope: 'all' },
    { permission: 'payroll.run.finalize', scope: 'all', note: 'initiator — needs hr_head co-sign' },
    { permission: 'payroll.reports', scope: 'all' },
    { permission: 'salary.write', scope: 'all' },
    { permission: 'helpdesk.agent', scope: 'all' },
    { permission: 'admin.settings', scope: 'all', note: 'payroll policy values only' },
    { permission: 'audit.read', scope: 'org_unit', note: 'payroll domain only' },
  ],
  plant_head: [
    { permission: 'employee.read', scope: 'org_unit', note: 'read-only' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'attendance.team.read', scope: 'org_unit', note: 'read-only' },
    { permission: 'attendance.muster.export', scope: 'org_unit' },
    { permission: 'reports.bu', scope: 'org_unit' },
  ],
  ceo_cell: [
    { permission: 'employee.read', scope: 'readonly' },
    { permission: 'employee.compensation.read', scope: 'readonly', note: 'aggregates only — never individual salaries' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'attendance.team.read', scope: 'readonly' },
    { permission: 'attendance.muster.export', scope: 'all' },
    { permission: 'reports.ceo', scope: 'all' },
  ],
  it_admin: [
    { permission: 'employee.read', scope: 'readonly', note: 'directory basics; NO salary/statutory visibility' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'assets.manage', scope: 'all' },
    { permission: 'helpdesk.agent', scope: 'all', note: 'IT category' },
    { permission: 'admin.users', scope: 'all' },
    { permission: 'admin.roles', scope: 'all', note: 'grant ≤ own level' },
    { permission: 'admin.settings', scope: 'all', note: 'technical settings only' },
    { permission: 'admin.devices', scope: 'all' },
    { permission: 'admin.integrations', scope: 'all' },
    { permission: 'audit.read', scope: 'all' },
    { permission: 'sec.session.revoke', scope: 'all' },
    { permission: 'sec.mfa.manage', scope: 'all', note: 'reset only — step-up + audit required' },
  ],
  compliance_officer: [
    { permission: 'employee.read', scope: 'readonly' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'cmp.licence.manage', scope: 'all' },
    { permission: 'cmp.calendar.manage', scope: 'all' },
    { permission: 'cmp.evidence.upload', scope: 'all' },
    { permission: 'cmp.register.generate', scope: 'all' },
    { permission: 'doc.vault.own', scope: 'own' },
    { permission: 'doc.vault.manage', scope: 'all' },
  ],
  dpo: [
    { permission: 'employee.read', scope: 'readonly' },
    { permission: 'attendance.own', scope: 'all' },
    { permission: 'leave.own', scope: 'all' },
    { permission: 'prv.notice.manage', scope: 'all' },
    { permission: 'prv.consent.read', scope: 'all' },
    { permission: 'prv.rights.handle', scope: 'all' },
    { permission: 'prv.retention.manage', scope: 'all' },
    { permission: 'prv.breach.manage', scope: 'all' },
    { permission: 'doc.vault.own', scope: 'own' },
  ],
  super_admin: [
    // Everything, incl. the two powers no one else has. All actions audit-logged;
    // role membership reviewed quarterly (docs/08 §2 hard rules).
    ...PERMISSIONS.map((permission): Grant => ({ permission, scope: 'all' })),
  ],
};
