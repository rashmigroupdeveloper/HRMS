/** API permission matrix (docs/08 §2) + entity scope + write negatives for every role. */
import { test, expect } from '@playwright/test';
import { apiLogin, type ApiClient } from '../../lib/api';
import { PERSONAS, ROLE_ORDER } from '../../lib/personas';

type Role = (typeof ROLE_ORDER)[number];
interface Rule { id: string; m: 'GET' | 'POST'; p: string; body?: unknown; allow: Role[]; either?: Role[]; why: string }

const PAYROLL: Role[] = ['payroll_admin', 'super_admin'];
const READ_RULES: Rule[] = [
  { id: 'runs.list', m: 'POST', p: '/api/payroll/runs/list', allow: ['hr_head', ...PAYROLL], why: 'payroll.run.view (docs/08: hr_head R, payroll ✓)' },
  { id: 'run.items', m: 'GET', p: '/api/payroll/runs/4/items', allow: ['hr_head', ...PAYROLL], why: 'payroll register is compensation data' },
  { id: 'salary.other', m: 'GET', p: '/api/payroll/salaries/effective/9', allow: ['hr_head', ...PAYROLL], why: 'employee.compensation.read — it_admin never (SoD)' },
  { id: 'statutory.rates', m: 'GET', p: '/api/payroll/config/statutory-rates', allow: ['hr_head', ...PAYROLL], why: 'payroll config' },
  { id: 'auth.users', m: 'GET', p: '/api/auth/users', allow: ['it_admin', 'super_admin'], why: 'admin.users' },
  { id: 'rbac.matrix', m: 'GET', p: '/api/rbac/matrix', allow: ['it_admin', 'super_admin'], why: 'admin.roles' },
  { id: 'rbac.users', m: 'GET', p: '/api/rbac/users', allow: ['it_admin', 'super_admin'], why: 'admin.roles' },
  { id: 'audit', m: 'GET', p: '/api/audit', allow: ['it_admin', 'super_admin'], either: ['hr_head', 'payroll_admin'], why: 'audit.read (hr_head/payroll scoped)' },
  { id: 'executive', m: 'GET', p: '/api/reports/executive', allow: ['ceo_cell', 'super_admin'], either: ['hr_head'], why: 'reports.ceo' },
  { id: 'letters.templates', m: 'GET', p: '/api/letters/templates', allow: ['hr_ops_rml', 'hr_ops_rgh', 'hr_head', 'super_admin'], why: 'letters.issue' },
  { id: 'assets', m: 'GET', p: '/api/assets', allow: ['hr_ops_rml', 'hr_ops_rgh', 'hr_head', 'it_admin', 'super_admin'], why: 'assets.manage' },
  { id: 'leave.balance.RML000009', m: 'GET', p: '/api/leave/balances/9', allow: ['hr_ops_rml', 'hr_head', 'super_admin'], either: ['manager', 'senior_manager', 'plant_head', 'hod'], why: 'leave.admin P-scoped (RGH hr_ops must not see RML)' },
  { id: 'leave.balance.RGH000001', m: 'GET', p: '/api/leave/balances/11', allow: ['hr_ops_rgh', 'hr_head', 'super_admin'], why: 'leave.admin P-scoped (RML hr_ops must not see RGH)' },
  { id: 'settings', m: 'GET', p: '/api/settings', allow: ['hr_head', 'payroll_admin', 'it_admin', 'super_admin'], why: 'admin.settings' },
];

// Writes are only sent for roles that must be refused (no side effects when the app is correct).
const WRITE_RULES: Rule[] = [
  { id: 'runs.create', m: 'POST', p: '/api/payroll/runs/create', body: { company_id: 1, month: '2027-03-01' }, allow: PAYROLL, why: 'payroll.run.manage' },
  { id: 'statutory.write', m: 'POST', p: '/api/payroll/config/statutory-rates', body: { scheme: 'PF', param: 'ee_rate_pct', value: 99, effectiveFrom: '2030-01-01', sourceNote: 'e2e negative test' }, allow: PAYROLL, why: 'payroll config write (hr_head is read-only)' },
  { id: 'rbac.grant', m: 'POST', p: '/api/rbac/user-roles', body: { userId: 8, roleCode: 'super_admin', action: 'grant' }, allow: ['super_admin', 'it_admin'], why: 'admin.roles' },
  { id: 'user.unlock', m: 'POST', p: '/api/auth/users/9/unlock', allow: ['it_admin', 'super_admin'], why: 'admin.users' },
  { id: 'leave.adjust', m: 'POST', p: '/api/leave/adjustments', body: { employeeId: 9, leaveType: 'CL', delta: 30, note: 'e2e negative test' }, allow: ['hr_ops_rml', 'hr_head', 'super_admin'], why: 'leave.admin' },
  { id: 'letters.issue', m: 'POST', p: '/api/letters/issue', body: { employeeId: 9, templateCode: 'experience' }, allow: ['hr_ops_rml', 'hr_head', 'super_admin'], either: ['hr_ops_rgh'], why: 'letters.issue' },
  { id: 'month.lock', m: 'POST', p: '/api/attendance/month-lock', body: { companyId: 1, month: '2027-01-01' }, allow: ['hr_head', 'payroll_admin', 'super_admin'], why: 'attendance.month_lock' },
];

const clients = new Map<string, ApiClient>();
test.afterAll(async () => { for (const c of clients.values()) await c.dispose(); });
async function client(role: Role) {
  if (!clients.has(role)) clients.set(role, await apiLogin(PERSONAS[role].email));
  return clients.get(role)!;
}
async function call(c: ApiClient, r: Rule) { return r.m === 'GET' ? c.get(r.p) : c.post(r.p, r.body); }

for (const role of ROLE_ORDER) {
  const label = PERSONAS[role].role;
  test(`[${label}] API-PERM-READ read permissions match docs/08`, async () => {
    const c = await client(role);
    const problems: string[] = [];
    for (const r of READ_RULES) {
      if (r.either?.includes(role)) continue;
      const st = (await call(c, r)).status();
      const allowed = r.allow.includes(role);
      if (allowed && st >= 400) problems.push(`${r.id}: expected access, got ${st} (${r.m} ${r.p}) — ${r.why}`);
      if (!allowed && st !== 403 && st !== 401) problems.push(`${r.id}: expected 403, got ${st} (${r.m} ${r.p}) — ${r.why}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test(`[${label}] API-PERM-WRITE forbidden writes are refused with 403`, async () => {
    const c = await client(role);
    const problems: string[] = [];
    for (const r of WRITE_RULES) {
      if (r.allow.includes(role) || r.either?.includes(role)) continue;
      const res = await call(c, r);
      if (res.status() !== 403 && res.status() !== 401) problems.push(`${r.id}: expected 403, got ${res.status()} (${r.m} ${r.p}) — ${r.why}: ${(await res.text()).slice(0, 160)}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test.describe('entity scope (group vs entity roles)', () => {
  const companiesSeen = async (role: Role) => {
    const c = await client(role);
    const res = await c.get('/api/employees?limit=500');
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).items as { ecode: string }[];
    return new Set(items.map((i) => i.ecode.slice(0, 3)));
  };
  test('[hr_ops (RML)] API-SCOPE sees only RML employees', async () => { expect([...await companiesSeen('hr_ops_rml')]).toEqual(['RML']); });
  test('[hr_ops (RGH)] API-SCOPE sees only RGH employees', async () => { expect([...await companiesSeen('hr_ops_rgh')]).toEqual(['RGH']); });
  test('[hr_head] API-SCOPE group-level: sees RML and RGH', async () => { expect([...await companiesSeen('hr_head')].sort()).toEqual(['RGH', 'RML']); });
  test('[super_admin] API-SCOPE group-level: sees RML and RGH', async () => { expect([...await companiesSeen('super_admin')].sort()).toEqual(['RGH', 'RML']); });
  test('[employee] API-SCOPE people list never includes another company', async () => { expect([...await companiesSeen('employee')].filter((c) => c !== 'RML')).toEqual([]); });
  test('[hr_ops (RGH)] API-SCOPE cannot read an RML payroll run or employee profile', async () => {
    const c = await client('hr_ops_rgh');
    expect((await c.get('/api/payroll/runs/4/items')).status()).toBe(403);
    const prof = await c.get('/api/employees/RML000009');
    expect([403, 404]).toContain(prof.status());
  });
});
