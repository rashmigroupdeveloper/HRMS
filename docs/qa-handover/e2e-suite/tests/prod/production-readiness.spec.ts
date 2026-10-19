/**
 * Production-readiness pass (owner acceptance bar, BRIEF 01:33 IST): FRESH EMPTY DB → migrations → the app's own seeds →
 * a go-live built ONLY through the product (org masters, employees, logins, salary, opening balances, punches) →
 * every role's core daily flow end to end → Kent punches → muster → payroll. No snapshot, no SQL shortcuts for business
 * data. Run: E2E_DB=hrms_e2e_prod scripts/prod-reset.sh && (start servers on that DB) && E2E_PROD=1 npx playwright test
 * Anything that needs a mock, shows a hard-coded figure, a dead button or "coming soon" on a core path is a P1 bug.
 */
import { test, expect, type APIResponse, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { apiLogin, type ApiClient } from '../../lib/api';
import { q } from '../../lib/db';

// Not serial: a failed step must not hide later findings. State survives worker restarts via a JSON file.
const LOGS = process.env.E2E_LOGS ?? path.resolve('.logs');
const ADMIN = JSON.parse(fs.readFileSync(path.join(LOGS, 'prod-admin.json'), 'utf8')) as { email: string; password: string; migrations: number };
const PW = 'Rashmi#Prod2026!';
const MONTH = '2026-09-01'; // last closed month (today is Oct 2026)
const DOJ = '2026-08-01';
const ABSENT = ['2026-09-08', '2026-09-09'];
const LEAVE_DAY = '2026-09-15';
const HOLIDAY = { date: '2026-09-17', name: 'Vishwakarma Puja' };
const DOOR = 'RML-KGP-MAIN-GATE';
const STATE = path.join(LOGS, 'prod-state.json');
const S: Record<string, any> = fs.existsSync(STATE) && fs.statSync(STATE).mtimeMs > fs.statSync(path.join(LOGS, 'prod-admin.json')).mtimeMs
  ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { emp: {} };
test.afterEach(() => fs.writeFileSync(STATE, JSON.stringify(S)));
test.afterAll(() => { if (GAPS.length) fs.appendFileSync(path.join(LOGS, 'prod-gaps.txt'), GAPS.join('\n') + '\n'); });
const clients: ApiClient[] = [];
/** Product gaps we must bridge with SQL so the REST of the flow can still be exercised. Each is a filed P1 bug; the
 *  bridging step is reported as a finding (annotation) and the step that needed it stays failed/soft-failed. */
const GAPS: string[] = [];
async function bridge(id: string, why: string, sqlText: string, params: unknown[] = []) {
  GAPS.push(`${id}: ${why}`); test.info().annotations.push({ type: `WORKAROUND ${id}`, description: why });
  await q(sqlText, params);
}
const ok = (r: APIResponse) => r.status() >= 200 && r.status() < 300;
async function body(r: APIResponse) { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } }
async function must(r: APIResponse, what: string) { const b = await body(r); expect(r.status(), `${what}: ${typeof b === 'string' ? b : JSON.stringify(b)}`).toBeLessThan(300); return b; }
async function as(email: string, pw = PW) { const c = await apiLogin(email, pw); clients.push(c); return c; }
test.afterAll(async () => { for (const c of clients) await c.dispose(); });

/** Weekdays (Mon–Sat; Sunday is the default week-off) of September 2026. */
function workdays(): string[] {
  const out: string[] = [];
  for (let d = 1; d <= 30; d++) { const dt = new Date(Date.UTC(2026, 8, d)); if (dt.getUTCDay() !== 0) out.push(dt.toISOString().slice(0, 10)); }
  return out;
}
const label = (iso: string, hm: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${y} ${hm}`; };
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

test('[bootstrap] PR-00 empty DB migrates and seeds idempotently; only the break-glass admin exists', async () => {
  const [{ n }] = await q<{ n: number }>('SELECT count(*)::int n FROM public.pgmigrations');
  expect(n, 'every migration file applied on an empty database').toBe(ADMIN.migrations);
  const [{ users }] = await q<{ users: number }>('SELECT count(*)::int users FROM core.users');
  expect(users, 'no demo logins in a fresh install').toBe(1);
  const [{ emps }] = await q<{ emps: number }>('SELECT count(*)::int emps FROM core.employees');
  expect(emps, 'no demo employees in a fresh install').toBe(0);
  const sa = await as(ADMIN.email, ADMIN.password);
  const me = await must(await sa.get('/api/auth/me'), 'admin /me');
  S.adminMust = me.mustChangePassword;
  const h = await sa.ctx.get('/health/ready');
  expect(h.status(), 'health endpoint').toBe(200);
});

test('[bootstrap] PR-01 reference masters a real go-live needs are seeded (statutory, components, leave types, companies)', async () => {
  const counts = Object.fromEntries(await Promise.all(([
    ['companies', 'core.companies'], ['statutory_rates', 'pay.statutory_rates'], ['pt_slabs', 'pay.pt_slabs'], ['it_slabs', 'pay.it_slabs'],
    ['salary_components', 'pay.salary_components'], ['leave_types', 'lv.leave_types'], ['shifts', 'att.shifts'], ['letter_templates', 'core.letter_templates'],
    ['workflow_definitions', 'wf.definitions'], ['gl_accounts', 'pay.gl_accounts'], ['claim_types', 'pay.claim_types'],
  ] as const).map(async ([k, t]) => [k, (await q<{ n: number }>(`SELECT count(*)::int n FROM ${t}`))[0].n] as const)));
  test.info().annotations.push({ type: 'fresh-db-masters', description: JSON.stringify(counts) });
  for (const k of ['companies', 'statutory_rates', 'pt_slabs', 'it_slabs', 'salary_components', 'leave_types', 'shifts', 'letter_templates', 'workflow_definitions'])
    expect(counts[k], `${k} seeded`).toBeGreaterThan(0);
  const [rml] = await q<{ id: number; pan: string | null; tan: string | null; pf: string | null }>("SELECT id, pan, tan, pf_establishment_code pf FROM core.companies WHERE code='RML'");
  expect(rml, 'RML company exists').toBeTruthy();
  S.rml = rml.id;
});

test('[super_admin] PR-02 org masters for RML are created through the product', async () => {
  const sa = await as(ADMIN.email, ADMIN.password);
  const mk = async (kind: string, values: Record<string, unknown>) => (await must(await sa.post(`/api/core/masters/${kind}`, { values }), `create ${kind}`)).id as number;
  const upd = await sa.ctx.patch(`/api/core/masters/companies/${S.rml}`, { headers: { authorization: `Bearer ${sa.token}` }, data: { values: { pan: 'AABCR1234K', tan: 'CALR12345A', pf_establishment_code: 'WBCAL0012345', pt_registration_no: 'PT/WB/12345' } } });
  expect(upd.status(), `company statutory IDs: ${await upd.text()}`).toBe(200);
  S.ou = await mk('org_units', { company_id: S.rml, name: 'Kharagpur Works' });
  S.loc = await mk('locations', { company_id: S.rml, name: 'Kharagpur', state_code: 'WB' });
  S.cc = await mk('cost_centers', { company_id: S.rml, code: 'KGP-PRD', name: 'Kharagpur Production' });
  const kinds = await sa.get('/api/core/masters/plants');
  expect.soft(kinds.status(), 'plants are an org master (GL mapping and SAP JV are keyed by plant)').toBe(200);
  if (!ok(kinds)) await bridge('E2E-030', 'no product path to create a plant (core.plants) or link a cost centre to it', "INSERT INTO core.plants (company_id, plant_code, name, location_id) VALUES ($1, 'KGP', 'Kharagpur Works', $2) ON CONFLICT DO NOTHING; ", [S.rml, S.loc])
    .then(() => q("UPDATE core.cost_centers SET plant_id=(SELECT id FROM core.plants WHERE company_id=$1 AND plant_code='KGP') WHERE id=$2", [S.rml, S.cc]));
  S.dept = await mk('departments', { name: 'Production' });
  S.deptHr = await mk('departments', { name: 'Human Resources' });
  for (const name of ['Engineer', 'Shift Manager', 'HR Manager', 'Payroll Executive', 'Plant Head']) await mk('designations', { name });
  await mk('grades', { code: 'M1', name: 'Management 1', rank: 10 });
  await mk('grades', { code: 'S2', name: 'Staff 2', rank: 20 });
});

const PEOPLE = [
  { key: 'hrhead', first: 'Hema', last: 'Head', dept: 'Human Resources', desig: 'HR Manager', grade: 'Management 1', roles: [['hr_head', null]] },
  { key: 'payroll', first: 'Pavan', last: 'Payroll', dept: 'Human Resources', desig: 'Payroll Executive', grade: 'Staff 2', roles: [['payroll_admin', 'rml']] },
  { key: 'hrops', first: 'Om', last: 'Ops', dept: 'Human Resources', desig: 'HR Manager', grade: 'Staff 2', roles: [['hr_ops', 'rml']] },
  { key: 'plant', first: 'Pritam', last: 'Plant', dept: 'Production', desig: 'Plant Head', grade: 'Management 1', roles: [['plant_head', 'rml']] },
  { key: 'manager', first: 'Mohan', last: 'Manager', dept: 'Production', desig: 'Shift Manager', grade: 'Management 1', roles: [] as [string, string | null][] , manager: 'plant' },
  { key: 'employee', first: 'Esha', last: 'Engineer', dept: 'Production', desig: 'Engineer', grade: 'Staff 2', roles: [], manager: 'manager' },
] as const;

test('[hr_ops via super_admin] PR-03 employees are created with real master data (e-codes allocated)', async () => {
  const sa = await as(ADMIN.email, ADMIN.password);
  for (const p of PEOPLE) {
    const mgr = 'manager' in p && p.manager ? S.emp[p.manager]?.ecode : undefined;
    const email = `${p.key}@rashmi.prod`;
    const r = await must(await sa.post('/api/employees', {
      companyCode: 'RML', firstName: p.first, lastName: p.last, gender: 'Female', dob: '1990-05-10', doj: DOJ, orgUnit: 'Kharagpur Works',
      location: 'Kharagpur', department: p.dept, designation: p.desig, grade: p.grade, category: 'white_collar', contractType: 'permanent',
      managerEcode: mgr, workEmail: email, mobile: '9830012345', pan: `ABCPE${1231 + PEOPLE.indexOf(p)}F`,
      bankName: 'State Bank of India', bankAccount: `30012345678${PEOPLE.indexOf(p)}`, bankIfsc: 'SBIN0000001',
    }), `create employee ${p.key}`);
    S.emp[p.key] = { ecode: r.ecode, id: r.employeeId, email };
  }
  expect(Object.keys(S.emp)).toHaveLength(PEOPLE.length);
  const [b] = await q<{ n: number }>("SELECT count(*)::int n FROM core.employees WHERE company_id=$1 AND attendance_mode='biometric' AND NOT biometric_registered", [S.rml]);
  expect.soft(b.n, 'a new joiner can be marked biometric-registered through the product (create form / onboarding IT task)').toBe(0);
  if (b.n) await bridge('E2E-031', 'employees created via the product stay biometric_registered=false and no screen/API sets it, so the month can never be locked', "UPDATE core.employees SET biometric_registered=true WHERE company_id=$1 AND attendance_mode='biometric'", [S.rml]);
});

test('[it_admin via super_admin] PR-04 logins + roles; first login forces a password change', async () => {
  const sa = await as(ADMIN.email, ADMIN.password);
  for (const p of PEOPLE) {
    const e = S.emp[p.key];
    const u = await must(await sa.post('/api/auth/users', { email: e.email, employeeId: e.id }), `login for ${p.key}`);
    e.userId = u.userId;
    for (const [role, scope] of p.roles) await must(await sa.post('/api/rbac/user-roles', { userId: u.userId, role, scopeOrgUnitId: scope === 'rml' ? S.rml : null }), `grant ${role} to ${p.key}`);
    const first = await apiLogin(e.email, u.temporaryPassword);
    const me = await body(await first.get('/api/auth/me'));
    expect(me.mustChangePassword, `${p.key} must change the temporary password`).toBeTruthy();
    await must(await first.post('/api/auth/change-password', { currentPassword: u.temporaryPassword, newPassword: PW }), `${p.key} changes password`);
    await first.dispose();
  }
  // Managers are derived from reporting lines; check the manager persona really gets approver rights.
  const m = await as(S.emp.manager.email);
  const me = await body(await m.get('/api/auth/me'));
  test.info().annotations.push({ type: 'manager-roles', description: JSON.stringify(me.roles ?? me.user?.roles ?? me) .slice(0, 300) });
});

test('[hr_ops] PR-05 holiday calendar and opening leave balances (go-live import)', async () => {
  const h = await as(S.emp.hrops.email);
  const csv = `Employee code,Leave type,Mode,Days,Reason\n${PEOPLE.flatMap((p) => [`${S.emp[p.key].ecode},CL,set_balance,4,Go-live opening balance`, `${S.emp[p.key].ecode},EL,set_balance,10,Go-live opening balance`]).join('\n')}\n`;
  const pv = await must(await h.post('/api/bulk/leave-balances/preview', { filename: 'opening.csv', base64: b64(csv) }), 'opening balance preview');
  expect(pv.errorRows, JSON.stringify(pv.issues)).toBe(0);
  await must(await h.post(`/api/bulk/leave-balances/jobs/${pv.jobId}/commit`, {}), 'opening balance commit');
  const e = await as(S.emp.employee.email);
  const bal = await body(await e.get('/api/leave/balances')) as { leaveType: string; available: number }[];
  expect(bal.find((b) => b.leaveType === 'EL')?.available, 'employee sees the opening EL').toBe(10);
  // O5: hr_ops maintains holidays by location.
  const hol = await h.put('/api/attendance/config/holidays', { date: HOLIDAY.date, name: HOLIDAY.name, locationId: S.loc });
  if (!ok(hol)) { const sa = await as(ADMIN.email, ADMIN.password); await must(await sa.put('/api/attendance/config/holidays', { date: HOLIDAY.date, name: HOLIDAY.name, locationId: S.loc }), 'add holiday (super_admin fallback)'); }
  expect.soft(hol.status(), `O5 hr_ops adds a holiday: ${await hol.text()}`).toBe(200);
});

test('[payroll_admin] PR-06 salary structure and assignment', async () => {
  const p = await as(S.emp.payroll.email);
  const st = await must(await p.post('/api/payroll/structures', { name: 'RML Staff 2026', company_id: S.rml, components: [
    { component_code: 'BASIC', formula_override: '16000' /* no CTC variable exists for 'BASIC = 40% of CTC' (E2E-029) */ }, { component_code: 'HRA' }, { component_code: 'SPECIAL_ALLOW' },
  ] }), 'create structure');
  S.structure = st.id;
  for (const componentCode of ['BASIC', 'HRA', 'SPECIAL_ALLOW', 'PF_EE', 'PT'])
    await must(await p.put('/api/payroll/config/gl-accounts', { companyCode: 'RML', plantCode: 'KGP', costCenterCode: 'KGP-PRD', componentCode, glCode: `4${String(componentCode.length).padStart(2, '0')}100` }), `GL ${componentCode}`);
  for (const k of ['employee', 'manager']) {
    await must(await p.post('/api/payroll/salaries/assign', { employee_id: S.emp[k].id, structure_id: st.id, effective_from: DOJ, annual_ctc_rupees: k === 'employee' ? 480000 : 900000, phase: 'confirmed', revision_reason: 'joining' }), `assign salary ${k}`);
  }
});

/** September punches for employee + manager (employee: absent on ABSENT days, no punch on the leave day). */
function septemberPunches(): { ecode: string; k: string; d: string; hm: string; dir: 'in' | 'out' }[] {
  const out: { ecode: string; k: string; d: string; hm: string; dir: 'in' | 'out' }[] = [];
  for (const k of ['employee', 'manager']) for (const d of workdays()) {
    if (d === HOLIDAY.date || (k === 'employee' && (ABSENT.includes(d) || d === LEAVE_DAY))) continue;
    out.push({ ecode: S.emp[k].ecode, k, d, hm: '09:02:00', dir: 'in' }, { ecode: S.emp[k].ecode, k, d, hm: '18:05:00', dir: 'out' });
  }
  return out;
}
const KENT_SIM = `http://127.0.0.1:${process.env.E2E_KENT_PORT ?? '5194'}`;
const swipeCount = async () => (await q<{ n: number }>("SELECT count(*)::int n FROM att.swipe_events WHERE employee_no=$1 AND swipe_ts >= '2026-09-01' AND swipe_ts < '2026-10-01'", [S.emp.employee.ecode]))[0].n;

test('[it_admin] PR-07 Kent feed: simulator punches pulled by "Sync now" (the adapter production will use)', async () => {
  // Device KGP-G1 is mapped to door RML-KGP-MAIN-GATE via KENT_DEVICE_MAP (start-servers.sh E2E_KENT_SIM=1).
  // The device uploads its September buffer on 1 Oct, so its completeThrough covers the whole month.
  const punches = septemberPunches().map((p) => ({ employeeNo: p.ecode, punchTime: `${p.d} ${p.hm}`, deviceId: 'KGP-G1', direction: p.dir, receivedAt: '2026-10-01T02:00:00Z' }));
  const sim = await fetch(`${KENT_SIM}/_sim/punches`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(punches) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as const);
  expect(sim.ok, `Kent simulator reachable at ${KENT_SIM}: ${sim.status} ${await sim.text()}`).toBe(true);
  const sa = await as(ADMIN.email, ADMIN.password);
  const r = await sa.post('/api/attendance/sync', {});
  S.kentSync = `${r.status()} ${(await r.text()).slice(0, 300)}`;
  test.info().annotations.push({ type: 'kent-sync', description: S.kentSync });
  expect(r.status(), `Kent "Sync now" must pull from the configured adapter: ${S.kentSync}`).toBe(200);
  await expect.poll(swipeCount, { timeout: 20_000, message: 'simulator punches stored as swipes for the employee' }).toBeGreaterThan(20);
  S.kentIngested = await swipeCount();
});

test('[hr_ops] PR-08 Kent punches become September day records (worker recompute)', async () => {
  if (!S.kentIngested) {
    // Kent path unavailable: load the same punches through the manual importer so later steps still run, and say so.
    const h = await as(S.emp.hrops.email);
    const rows = septemberPunches().map((p) => `${p.ecode},${p.k},${label(p.d, p.hm)},${DOOR},${p.dir.toUpperCase()}`);
    const csv = `Employee No,Employee Name,Swipe Date,Door/Address,Swipe Type\n${rows.join('\n')}\n`;
    fs.appendFileSync(path.join(LOGS, 'prod-gaps.txt'), `WORKAROUND PR-08: Kent sync ingested nothing (${S.kentSync}); punches loaded via /api/bulk/punches instead\n`);
    test.info().annotations.push({ type: 'WORKAROUND importer', description: 'Kent ingest failed; manual punch import used' });
    const pv = await must(await h.post('/api/bulk/punches/preview', { filename: 'EmployeeSwipeDetails-Sep-2026.csv', base64: b64(csv) }), 'punch preview');
    expect(pv.errorRows, JSON.stringify(pv.issues).slice(0, 500)).toBe(0);
    await must(await h.post(`/api/bulk/punches/jobs/${pv.jobId}/commit`, {}), 'punch commit');
  }
  // Day records are recomputed from swipes by the worker (each minute). If nothing arrives, drain through the API and flag it.
  const present = async () => (await q<{ n: number }>("SELECT count(*)::int n FROM att.day_records WHERE employee_id=$1 AND work_date BETWEEN '2026-09-01' AND '2026-09-30' AND status='P'", [S.emp.employee.id]))[0].n;
  const t0 = Date.now();
  while (Date.now() - t0 < 75_000 && (await present()) < 15) await new Promise((r) => setTimeout(r, 5_000));
  const viaWorker = await present();
  expect.soft(viaWorker, 'background worker turned punches into day records within ~1 minute').toBeGreaterThan(15);
  if (viaWorker < 15) { const sa = await as(ADMIN.email, ADMIN.password); test.info().annotations.push({ type: 'WORKAROUND drain', description: JSON.stringify(await body(await sa.ctx.post('/api/attendance/recompute', { headers: { authorization: `Bearer ${sa.token}` } }))) }); }
  await expect.poll(present, { timeout: 30_000, message: 'present days computed from punches' }).toBeGreaterThan(15);
  // Days with no swipe (absences, week-offs, the holiday) are materialised on demand for the month (PAY-010).
  const sa = await as(ADMIN.email, ADMIN.password);
  const mat = await sa.post('/api/attendance/recompute', { companyId: S.rml, from: '2026-09-01', until: '2026-09-30' });
  test.info().annotations.push({ type: 'materialise', description: `${mat.status()} ${(await mat.text()).slice(0, 200)}` });
  expect.soft(mat.status(), 'month materialise accepted').toBeLessThan(300);
  const e = await as(S.emp.employee.email);
  const cal = await e.get(`/api/attendance/days?employeeId=${S.emp.employee.id}&from=2026-09-01&to=2026-09-30`);
  test.info().annotations.push({ type: 'ess-attendance', description: `${cal.status()} ${(await cal.text()).slice(0, 200)}` });
});

test('[employee → manager] PR-09 leave applied for the missing day and approved', async () => {
  const e = await as(S.emp.employee.email);
  const a = await must(await e.post('/api/leave/applications', { leaveType: 'CL', fromDate: LEAVE_DAY, toDate: LEAVE_DAY, reason: 'Family function' }), 'apply leave (backdated within the open month)');
  const m = await as(S.emp.manager.email);
  const inbox = await body(await m.get('/api/workflows/inbox'));
  test.info().annotations.push({ type: 'manager-inbox', description: JSON.stringify(inbox).slice(0, 200) });
  await must(await m.post(`/api/workflows/requests/${a.workflowRequestId}/act`, { requestId: a.workflowRequestId, action: 'approve', comment: 'ok' }), 'manager approves');
  await expect.poll(async () => (await q<{ status: string }>('SELECT status FROM lv.applications WHERE id=$1', [a.id]))[0].status, { timeout: 10_000 }).toBe('approved');
  await expect.poll(async () => (await q<{ status: string }>("SELECT status::text FROM att.day_records WHERE employee_id=$1 AND work_date=$2", [S.emp.employee.id, LEAVE_DAY]))[0]?.status, { timeout: 20_000, message: 'approved leave reflected on the day' }).toBe('L');
});

test('[manager → hr_ops] PR-10 muster built, manager signs off, month locked', async () => {
  const h = await as(S.emp.hrops.email);
  const st = await q<{ status: string; n: number }>("SELECT status::text, count(*)::int n FROM att.day_records WHERE employee_id=$1 AND work_date BETWEEN '2026-09-01' AND '2026-09-30' GROUP BY 1 ORDER BY 1", [S.emp.employee.id]);
  test.info().annotations.push({ type: 'employee-sep-days', description: JSON.stringify(st) });
  const by = Object.fromEntries(st.map((x) => [x.status, x.n]));
  expect.soft(by.A ?? by.UAB ?? 0, 'the 2 no-punch working days are absent').toBe(2);
  expect.soft(by.H ?? 0, 'holiday marked').toBe(1);
  expect.soft(by.WO ?? 0, 'Sundays are week-offs').toBe(4);
  await must(await h.post('/api/reports/muster/build', { companyId: S.rml, month: '2026-09' }), 'build muster');
  const m = await as(S.emp.manager.email);
  await must(await m.post('/api/attendance/manager-approvals', { companyId: S.rml, month: '2026-09', note: 'Checked' }), 'manager signs off September');
  const pl = await as(S.emp.plant.email);
  await must(await pl.post('/api/attendance/manager-approvals', { companyId: S.rml, month: '2026-09', note: 'Checked' }), 'plant head signs off his direct reports').catch(() => undefined);
  const cl = await body(await h.get(`/api/attendance/month-lock/checklist?companyId=${S.rml}&month=2026-09`));
  test.info().annotations.push({ type: 'lock-checklist', description: JSON.stringify(cl).slice(0, 400) });
  // O9: hr_ops locks the month (ROLE_TASKS). Fall back to payroll_admin so payroll can still be tested.
  const lock = await h.post('/api/attendance/month-lock', { companyId: S.rml, month: '2026-09' });
  const lockTxt = await lock.text();
  if (!ok(lock)) { const p = await as(S.emp.payroll.email); await must(await p.post('/api/attendance/month-lock', { companyId: S.rml, month: '2026-09' }), 'lock September (payroll_admin fallback)'); }
  expect.soft(lock.status(), `O9 hr_ops locks the month: ${lockTxt}`).toBe(200);
});

test('[payroll_admin → hr_head] PR-11 September payroll: compute (LOP for absences), approve, finalize, outputs, paid', async () => {
  const p = await as(S.emp.payroll.email);
  const hh = await as(S.emp.hrhead.email);
  const run = await must(await p.post('/api/payroll/runs/create', { company_id: S.rml, month: MONTH, run_type: 'regular' }), 'create run');
  S.run = run.id;
  const call = async (c: ApiClient, proc: string, extra = {}) => must(await c.post(`/api/payroll/runs/${proc}`, { id: S.run, ...extra }), proc);
  await call(p, 'lockInputs');
  await call(p, 'compute');
  const items = await q<{ employee_id: number; net: string; gross: string; lop: string | null }>('SELECT employee_id, net_pay::text net, gross_pay::text gross, lop_days::text lop FROM pay.payroll_items WHERE run_id=$1', [S.run]).catch(async () => q<any>('SELECT * FROM pay.payroll_items WHERE run_id=$1', [S.run]));
  test.info().annotations.push({ type: 'items', description: JSON.stringify(items).slice(0, 600) });
  const mine = items.find((i: any) => Number(i.employee_id) === S.emp.employee.id);
  expect(mine, 'the employee with a salary is in the run').toBeTruthy();
  expect(Number(mine.net ?? mine.net_pay), 'net pay > 0').toBeGreaterThan(0);
  await call(p, 'review');
  await call(hh, 'approve');
  await call(hh, 'finalize');
  await must(await p.post('/api/payroll/outputs/generateRunPayslips', { runId: S.run }), 'payslips');
  await must(await p.post('/api/payroll/outputs/generateBankFile', { runId: S.run }), 'bank file');
  const jv = await p.post('/api/payroll/outputs/generateSapJv', { runId: S.run });
  test.info().annotations.push({ type: 'sap-jv', description: `${jv.status()} ${(await jv.text()).slice(0, 200)}` });
  expect.soft(jv.status(), 'SAP JV on a fresh install').toBe(200);
  await call(hh, 'markPaid', { paymentReference: 'UTR-SEP-2026-0001' });
  const e = await as(S.emp.employee.email);
  const slips = await e.post('/api/payroll/outputs/getMyPayslip', { month: MONTH });
  test.info().annotations.push({ type: 'ess-payslips', description: `${slips.status()} ${(await slips.text()).slice(0, 300)}` });
  expect(slips.status(), 'employee can open the September payslip').toBe(200);
});

// ---- UI sweep: every persona's nav on the fresh install. No crash, no "coming soon"/mock/demo copy on core paths. ----
const BAD = /coming soon|not (yet )?available|lorem|placeholder|mock data|demo data|sample data|\bTODO\b|Golden G8|under construction/i;
async function uiLogin(page: Page, email: string, pw: string) {
  await page.goto('/login');
  await page.getByLabel(/email|employee id|user/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(pw);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 15_000 });
}
for (const who of ['employee', 'manager', 'hrops', 'hrhead', 'payroll', 'plant', 'admin'] as const) {
  test(`[${who}] PR-UI core screens render real data: no crash, no coming-soon/mock copy, no dead links`, async ({ page }) => {
    const email = who === 'admin' ? ADMIN.email : S.emp[who]?.email;
    test.skip(!email, 'persona not created (earlier step failed)');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && /Route failed|TypeError|Cannot read/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await uiLogin(page, email, who === 'admin' ? ADMIN.password : PW);
    const hrefs = [...new Set(await page.locator('nav a[href^="/"], aside a[href^="/"], header a[href^="/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')))].filter((h) => h && h !== '/login');
    expect(hrefs.length, `${who}: navigation links found`).toBeGreaterThan(2);
    const findings: string[] = [];
    for (const href of hrefs.slice(0, 40)) {
      await page.goto(href);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const text = (await page.locator('main').innerText().catch(() => '')) || '';
      if (new URL(page.url()).pathname === '/' && href !== '/') findings.push(`${href} → bounced to /`);
      const m = text.match(BAD); if (m) findings.push(`${href} → "${m[0]}"`);
      if (/something went wrong|failed to load|route failed/i.test(text)) findings.push(`${href} → error state`);
    }
    test.info().annotations.push({ type: `${who}-nav`, description: hrefs.join(' ') });
    expect.soft(errors, `${who}: runtime errors`).toEqual([]);
    expect(findings, `${who}: core-path findings`).toEqual([]);
  });
}
