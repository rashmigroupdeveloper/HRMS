/** Every persona the suite logs in as (see /workspace/hrms-test/seed/USERS.md + scripts/e2e-prep.sql). */
export const PASSWORD = process.env.E2E_PASSWORD ?? 'Rashmi#Test2026';

export interface Persona {
  key: string;
  role: string; // reporting bucket
  email: string;
  ecode?: string;
  name: string;
  /** Primary nav labels that MUST be visible for this role. */
  nav: string[];
  /** Paths whose page should render real content for this role. */
  allowed: string[];
  /** Paths this role must NOT be able to use (UI must deny/redirect, data must not render). */
  forbidden: string[];
}

export const PERSONAS: Record<string, Persona> = {
  employee: {
    key: 'employee', role: 'employee', email: 'employee@rashmi.test', ecode: 'RML000008', name: 'Debajit Roy',
    nav: ['Home', 'My Attendance', 'My Leave', 'My Pay', 'My Claims'],
    allowed: ['/', '/my/attendance', '/my/leave', '/my/pay', '/my/claims', '/helpdesk', '/people', '/me', '/my/letters', '/policies'],
    forbidden: ['/payroll', '/payroll/structures', '/admin/users', '/admin/settings', '/admin/audit', '/executive', '/attendance/month-lock', '/leave', '/letters', '/loans?tab=company'],
  },
  employee2: {
    key: 'employee2', role: 'employee', email: 'employee2@rashmi.test', ecode: 'RML000009', name: 'Priya Sharma',
    nav: ['Home', 'My Attendance', 'My Leave'], allowed: [], forbidden: [],
  },
  rgh_employee: {
    key: 'rgh_employee', role: 'employee', email: 'rgh.employee@rashmi.test', ecode: 'RGH000001', name: 'Sushanta',
    nav: ['Home'], allowed: [], forbidden: [],
  },
  manager: {
    key: 'manager', role: 'manager', email: 'manager@rashmi.test', ecode: 'RML000007', name: 'Amit Kumar Singh',
    nav: ['Home', 'My Team'],
    allowed: ['/', '/my/team', '/approvals', '/my/team/overtime', '/people'],
    forbidden: ['/payroll', '/admin/users', '/admin/settings', '/executive', '/attendance/month-lock'],
  },
  senior_manager: {
    key: 'senior_manager', role: 'senior_manager', email: 'srmanager@rashmi.test', ecode: 'RML000006', name: 'Kinjal Roy',
    nav: ['Home', 'My Team'],
    allowed: ['/', '/my/team', '/approvals', '/people'],
    forbidden: ['/payroll', '/admin/users', '/admin/settings', '/executive'],
  },
  hod: {
    key: 'hod', role: 'hod', email: 'hod@rashmi.test', ecode: 'RML000090', name: 'Hemant DeptHead',
    nav: ['Home'],
    allowed: ['/', '/approvals', '/people'],
    forbidden: ['/payroll', '/admin/users', '/admin/settings', '/executive'],
  },
  hr_ops_rml: {
    key: 'hr_ops_rml', role: 'hr_ops (RML)', email: 'hrops@rashmi.test', ecode: 'RML000003', name: 'Rachna Das',
    nav: ['Dashboard', 'People'],
    allowed: ['/', '/people', '/lifecycle', '/letters', '/leave', '/assets', '/attendance', '/engagement', '/reports'],
    forbidden: ['/payroll', '/payroll/structures', '/admin/users', '/admin/audit', '/executive'],
  },
  hr_ops_rgh: {
    key: 'hr_ops_rgh', role: 'hr_ops (RGH)', email: 'hrops.rgh@rashmi.test', ecode: 'RGH000090', name: 'Sweta RGH-HROps',
    nav: ['Dashboard', 'People'],
    allowed: ['/', '/people', '/lifecycle', '/letters', '/leave'],
    forbidden: ['/payroll', '/admin/users', '/executive'],
  },
  hr_head: {
    key: 'hr_head', role: 'hr_head', email: 'hrhead@rashmi.test', ecode: 'RML000002', name: 'Chaitanya Paila',
    nav: ['Dashboard', 'People'],
    allowed: ['/', '/people', '/approvals', '/payroll', '/admin/settings', '/admin/workflows', '/reports', '/lifecycle'],
    forbidden: ['/admin/users'],
  },
  payroll_admin: {
    key: 'payroll_admin', role: 'payroll_admin', email: 'payroll@rashmi.test', ecode: 'RML000004', name: 'Subhasis Panda',
    nav: ['Dashboard', 'Payroll'],
    allowed: ['/', '/payroll', '/payroll/structures', '/payroll/revisions', '/payroll/parallel-run', '/loans', '/claims', '/reports'],
    forbidden: ['/admin/users', '/executive', '/admin/workflows'],
  },
  plant_head: {
    key: 'plant_head', role: 'plant_head', email: 'planthead@rashmi.test', ecode: 'RML000005', name: 'Sapikul Ali',
    nav: ['Dashboard'],
    allowed: ['/', '/attendance/muster', '/attendance/absence-cases', '/reports'],
    forbidden: ['/payroll', '/admin/users', '/admin/settings', '/executive', '/payroll/structures'],
  },
  ceo_cell: {
    key: 'ceo_cell', role: 'ceo_cell', email: 'ceo@rashmi.test', ecode: 'RML000001', name: 'Arun Gupta',
    nav: ['Executive'],
    allowed: ['/executive', '/reports'],
    forbidden: ['/payroll', '/admin/users', '/admin/settings', '/payroll/structures', '/attendance/month-lock'],
  },
  it_admin: {
    key: 'it_admin', role: 'it_admin', email: 'itadmin@rashmi.test', ecode: 'RML000010', name: 'Sharique Khan',
    nav: [],
    allowed: ['/', '/admin/users', '/attendance/devices', '/admin/audit'],
    forbidden: ['/payroll', '/payroll/structures', '/my/team', '/executive', '/payroll/revisions'],
  },
  super_admin: {
    key: 'super_admin', role: 'super_admin', email: 'admin@rashmi.test', name: 'Super Admin',
    nav: [],
    allowed: ['/', '/admin/users', '/admin/settings', '/admin/audit', '/admin/workflows', '/payroll', '/people'],
    forbidden: [],
  },
};

export const EXTRA = { payroll_rgh: 'payroll.rgh@rashmi.test', payroll_group: 'payroll.group@rashmi.test' };
export const ROLE_ORDER = ['employee', 'manager', 'senior_manager', 'hod', 'hr_ops_rml', 'hr_ops_rgh', 'hr_head', 'payroll_admin', 'plant_head', 'ceo_cell', 'it_admin', 'super_admin'] as const;
export const SAMPLE = { email: 'rml033625@qa-payroll.rashmi.test', ecode: 'RML033625', expectedNet: 59124 };
export const AUTH_TEST_USERS = { lockout: 'lockout@rashmi.test', pwchange: 'pwchange@rashmi.test', pwreset: 'pwreset@rashmi.test' };

/** Mock-payroll cohort employee (all report to RML000007 Amit; functional manager RML000006 Kinjal). */
export function cohort(ecode: string): Persona {
  return { key: ecode, role: 'employee', email: `${ecode.toLowerCase()}@qa-payroll.rashmi.test`, ecode, name: ecode, nav: [], allowed: [], forbidden: [] };
}
