/**
 * Scope isolation (owner rule): hr_head + super_admin are GROUP (RML=1, RGH=2, and future entities);
 * every other role is limited to its company / plant / department / reporting tree / self.
 * Read isolation = list never contains the other entity and detail reads are 403/404;
 * write isolation = actions on the other entity's records are 403/404 (never 2xx).
 */
import { test, expect } from '@playwright/test';
import { apiLogin, type ApiClient } from '../../lib/api';
import { PERSONAS, ROLE_ORDER } from '../../lib/personas';
import { q } from '../../lib/db';

type Role = (typeof ROLE_ORDER)[number];
const clients = new Map<string, ApiClient>();
test.afterAll(async () => { for (const c of clients.values()) await c.dispose(); });
async function client(role: Role) {
  if (!clients.has(role)) clients.set(role, await apiLogin(PERSONAS[role].email));
  return clients.get(role)!;
}
const prefixes = (txt: string) => new Set((txt.match(/\b(RML|RGH)\d{6}\b/g) ?? []).map((e) => e.slice(0, 3)));
const DENY = [403, 404];

/** Which companies each persona may see in people lists. */
const PEOPLE_SCOPE: Record<Role, string[]> = {
  employee: ['RML'], manager: ['RML'], senior_manager: ['RML'], hod: ['RML'],
  hr_ops_rml: ['RML'], hr_ops_rgh: ['RGH'], hr_head: ['RGH', 'RML'], payroll_admin: ['RML'],
  plant_head: ['RML'], ceo_cell: ['RGH', 'RML'], it_admin: ['RGH', 'RML'], super_admin: ['RGH', 'RML'],
};
const GROUP: Role[] = ['hr_head', 'super_admin'];

for (const role of ROLE_ORDER) {
  const label = PERSONAS[role].role;
  test(`[${label}] SCOPE-LIST people lists stay inside the role's scope`, async () => {
    const c = await client(role);
    const r = await c.get('/api/employees?limit=500');
    expect(r.status()).toBe(200);
    const seen = [...prefixes(await r.text())].sort();
    for (const co of seen) expect(PEOPLE_SCOPE[role], `${label} sees ${co} employees`).toContain(co);
    if (GROUP.includes(role)) expect(seen, `${label} is group-level`).toEqual(['RGH', 'RML']);
  });
}

test.describe('cross-entity detail reads', () => {
  const rmlOnly: Role[] = ['manager', 'senior_manager', 'hod', 'hr_ops_rml', 'payroll_admin', 'plant_head'];
  for (const role of rmlOnly) {
    test(`[${PERSONAS[role].role}] SCOPE-READ RGH employee profile and leave balance are not readable`, async () => {
      const c = await client(role);
      expect(DENY, 'GET /api/employees/RGH000001').toContain((await c.get('/api/employees/RGH000001')).status());
      expect(DENY, 'GET /api/leave/balances/11').toContain((await c.get('/api/leave/balances/11')).status());
    });
  }
  test('[hr_ops (RGH)] SCOPE-READ RML employee profile and leave balance are not readable', async () => {
    const c = await client('hr_ops_rgh');
    expect(DENY).toContain((await c.get('/api/employees/RML000009')).status());
    expect(DENY).toContain((await c.get('/api/leave/balances/9')).status());
  });
  for (const role of GROUP) {
    test(`[${PERSONAS[role].role}] SCOPE-READ group role reads both entities`, async () => {
      const c = await client(role);
      expect((await c.get('/api/employees/RGH000001')).status()).toBe(200);
      expect((await c.get('/api/employees/RML000009')).status()).toBe(200);
    });
  }
});

test.describe('cross-entity writes are refused', () => {
  const RGH_EMP = 11;
  test('[hr_ops (RML)] SCOPE-WRITE leave adjustment / letter / attendance override for an RGH employee', async () => {
    const c = await client('hr_ops_rml');
    const problems: string[] = [];
    const tries: [string, Promise<import('@playwright/test').APIResponse>][] = [
      ['leave.adjust', c.post('/api/leave/adjustments', { employeeId: RGH_EMP, leaveType: 'CL', delta: 1, note: 'e2e cross-entity negative' })],
      ['letters.issue', c.post('/api/letters/issue', { employeeId: RGH_EMP, templateCode: 'experience', extraFields: { dol: '2026-09-30' } })],
      ['attendance.override', c.put('/api/attendance/days/override', { employeeId: RGH_EMP, date: '2026-10-05', status: 'P', reason: 'e2e cross-entity negative' })],
    ];
    for (const [id, p] of tries) { const r = await p; if (!DENY.includes(r.status())) problems.push(`${id}: ${r.status()} ${(await r.text()).slice(0, 140)}`); }
    expect(problems, problems.join('\n')).toEqual([]);
  });
  test('[payroll_admin] SCOPE-WRITE cannot create a payroll run for RGH', async () => {
    const c = await client('payroll_admin');
    const r = await c.post('/api/payroll/runs/create', { company_id: 2, month: '2027-02-01' });
    expect(DENY, `runs.create RGH → ${r.status()} ${(await r.text()).slice(0, 140)}`).toContain(r.status());
  });
});

test.describe('payroll runs by entity', () => {
  const runsFor = async (role: Role) => {
    const c = await client(role);
    const r = await c.post('/api/payroll/runs/list', {});
    expect(r.status()).toBe(200);
    const runs = (await r.json()) as { companyId?: number; company_id?: number }[];
    return new Set(runs.map((x) => Number(x.companyId ?? x.company_id)));
  };
  test('[payroll_admin] SCOPE-PAY RML payroll admin lists only RML runs', async () => {
    const [{ n }] = await q<{ n: number }>('SELECT count(*)::int n FROM pay.payroll_runs WHERE company_id=2').catch(() => [{ n: 0 }]);
    test.skip(!n, 'no RGH runs in this DB');
    expect([...await runsFor('payroll_admin')]).toEqual([1]);
  });
  test('[hr_head] SCOPE-PAY hr_head lists RML and RGH runs', async () => {
    const [{ n }] = await q<{ n: number }>('SELECT count(DISTINCT company_id)::int n FROM pay.payroll_runs').catch(() => [{ n: 0 }]);
    test.skip(n < 2, 'runs exist for fewer than two companies');
    expect([...await runsFor('hr_head')].sort()).toEqual([1, 2]);
  });
});

test.describe('reporting tree / department / self', () => {
  test('[manager] SCOPE-TREE manager cannot open an employee outside the tree (HR ops RML000003)', async () => {
    const c = await client('manager');
    expect(DENY).toContain((await c.get('/api/employees/RML000003')).status());
    expect((await c.get('/api/employees/RML000008')).status(), 'own report is readable').toBe(200);
  });
  test('[hod] SCOPE-DEPT HOD cannot open an employee of another department (HR, RML000003)', async () => {
    const c = await client('hod');
    expect(DENY).toContain((await c.get('/api/employees/RML000003')).status());
  });
  test('[employee] SCOPE-SELF IDOR: another employee\'s profile, balances, letters, assets, loans are refused', async () => {
    const c = await client('employee');
    const problems: string[] = [];
    for (const p of ['/api/employees/RML000009', '/api/leave/balances/9', '/api/letters/employee/9', '/api/assets/held-by/9', '/api/payroll/salaries/effective/9']) {
      const st = (await c.get(p)).status();
      if (!DENY.includes(st)) problems.push(`${p}: ${st}`);
    }
    const [loan] = await q<{ id: number }>('SELECT id FROM pay.loans WHERE employee_id<>8 ORDER BY id LIMIT 1').catch(() => []);
    if (loan) { const st = (await c.get(`/api/loans/${loan.id}/ledger`)).status(); if (!DENY.includes(st)) problems.push(`/api/loans/${loan.id}/ledger: ${st}`); }
    const [trip] = await q<{ id: number }>('SELECT id FROM te.trips WHERE employee_id<>8 ORDER BY id LIMIT 1').catch(() => []);
    if (trip) { const st = (await c.get(`/api/travel/trips/${trip.id}`)).status(); if (!DENY.includes(st)) problems.push(`/api/travel/trips/${trip.id}: ${st}`); }
    expect(problems, problems.join('\n')).toEqual([]);
  });
  test('[manager] SCOPE-ATT-027 manager has no attendance override (403)', async () => {
    const c = await client('manager');
    const r = await c.put('/api/attendance/days/override', { employeeId: 8, workDate: '2026-10-05', status: 'P', reason: 'e2e negative: managers never mark present' });
    expect(r.status(), (await r.text()).slice(0, 160)).toBe(403);
  });
  test('[ceo_cell] SCOPE-COMP ceo_cell cannot read an individual salary or payslip register', async () => {
    const c = await client('ceo_cell');
    expect([401, 403]).toContain((await c.get('/api/payroll/salaries/effective/9')).status());
    expect([401, 403]).toContain((await c.post('/api/payroll/runs/list', {})).status());
  });
});
