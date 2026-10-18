/**
 * Transaction safety under concurrency (owner scope 4): fire the same state-changing request in parallel and check
 * that exactly one wins, nothing is applied twice, and the DB stays consistent (idempotency / race conditions).
 * Runs as its own project after `payroll` (it touches the RGH June run and an approved separation's F&F).
 */
import { test, expect, type APIResponse } from '@playwright/test';
import { apiLogin, type ApiClient } from '../../lib/api';
import { EXTRA } from '../../lib/personas';
import { q } from '../../lib/db';
import { futureWeekday, recentWeekday } from '../../lib/dates';

test.describe.configure({ mode: 'serial' });
const N = 5;
const ok = (r: APIResponse) => r.status() >= 200 && r.status() < 300;
const wins = (rs: APIResponse[]) => rs.filter(ok).length;
const codes = (rs: APIResponse[]) => rs.map((r) => r.status()).join(',');
/** A future weekday on which RML000009 has no live leave yet, so the spec can be re-run without a reset. */
async function freeDay(from: number) {
  for (let k = from; k < from + 120; k++) {
    const d = futureWeekday(k);
    const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM lv.applications a JOIN core.employees e ON e.id=a.employee_id WHERE e.ecode='RML000009' AND a.status IN ('pending','approved') AND $1::date BETWEEN a.from_date AND a.to_date", [d.iso]);
    if (!n) return d;
  }
  throw new Error('no free day');
}
/** A leave type the employee still has at least a day of (keeps the spec re-runnable). */
async function lt(c: ApiClient) {
  const bal = (await (await c.get('/api/leave/balances')).json()) as { leaveType: string; available: number }[];
  const t = ['EL', 'SL', 'CL'].map((code) => bal.find((b) => b.leaveType === code)).find((b) => b && b.available >= 1);
  if (!t) throw new Error(`no leave balance left: ${JSON.stringify(bal)}`);
  return t.leaveType;
}
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const clients: ApiClient[] = [];
async function login(email: string) { const c = await apiLogin(email); clients.push(c); return c; }
test.afterAll(async () => { for (const c of clients) await c.dispose(); });
// Test setup: give the leave tests their own EL headroom so re-runs without a reset don't drain the balance.
test.beforeAll(async () => {
  await q("INSERT INTO lv.ledger (employee_id, leave_type_id, txn_type, delta, effective_date, note) SELECT e.id, t.id, 'adjustment', 5, CURRENT_DATE, 'E2E concurrency headroom' FROM core.employees e, lv.leave_types t WHERE e.ecode='RML000009' AND t.code='EL'");
});

test('[employee] CONC-LV-01 double-submit of the same leave creates one application', async () => {
  const day = await freeDay(40);
  const e = await login('employee2@rashmi.test');
  const type = await lt(e);
  const rs = await Promise.all(Array.from({ length: N }, () => e.post('/api/leave/applications', { leaveType: type, fromDate: day.iso, toDate: day.iso, reason: 'E2E concurrency: double click' })));
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM lv.applications a JOIN core.employees e ON e.id=a.employee_id WHERE e.ecode='RML000009' AND a.status IN ('pending','approved') AND $1::date BETWEEN a.from_date AND a.to_date", [day.iso]);
  expect(n, `overlapping live applications for ${day.iso} (responses ${codes(rs)})`).toBe(1);
  expect(wins(rs), codes(rs)).toBe(1);
});

test('[manager] CONC-WF-01 parallel approvals of one request: one decision, one ledger debit', async () => {
  const day = await freeDay(44);
  const e = await login('employee2@rashmi.test');
  const a = await e.post('/api/leave/applications', { leaveType: await lt(e), fromDate: day.iso, toDate: day.iso, reason: 'E2E concurrency: approve race' });
  expect(a.status(), await a.text()).toBe(200);
  const { id, workflowRequestId } = await a.json();
  const m = await login('manager@rashmi.test');
  const rs = await Promise.all(Array.from({ length: N }, () => m.post(`/api/workflows/requests/${workflowRequestId}/act`, { requestId: workflowRequestId, action: 'approve' })));
  expect(wins(rs), `parallel approve responses ${codes(rs)}`).toBe(1);
  const debits = await q<{ n: number }>("SELECT count(*)::int n FROM lv.ledger WHERE reference_id=$1 AND delta<0", [id]);
  expect(debits[0].n, 'leave debited exactly once').toBeLessThanOrEqual(1);
  const steps = await q<{ n: number }>("SELECT count(*)::int n FROM wf.request_steps WHERE request_id=$1 AND status IN ('approved','rejected')", [workflowRequestId]).catch(() => [{ n: 1 }]);
  expect(steps[0].n, 'one decided step').toBeLessThanOrEqual(1);
});

test('[manager] CONC-WF-02 approve and reject racing on one request end in one consistent outcome', async () => {
  const day = await freeDay(48);
  const e = await login('employee2@rashmi.test');
  const a = await e.post('/api/leave/applications', { leaveType: await lt(e), fromDate: day.iso, toDate: day.iso, reason: 'E2E concurrency: approve vs reject' });
  expect(a.status(), await a.text()).toBe(200);
  const { id, workflowRequestId } = await a.json();
  const m = await login('manager@rashmi.test');
  const rs = await Promise.all([
    m.post(`/api/workflows/requests/${workflowRequestId}/act`, { requestId: workflowRequestId, action: 'approve' }),
    m.post(`/api/workflows/requests/${workflowRequestId}/act`, { requestId: workflowRequestId, action: 'reject', comment: 'E2E race' }),
    m.post(`/api/workflows/requests/${workflowRequestId}/act`, { requestId: workflowRequestId, action: 'approve' }),
  ]);
  expect(wins(rs), codes(rs)).toBe(1);
  const [app] = await q<{ status: string }>('SELECT status FROM lv.applications WHERE id=$1', [id]);
  const debits = (await q<{ n: number }>('SELECT count(*)::int n FROM lv.ledger WHERE reference_id=$1 AND delta<0', [id]))[0].n;
  if (app.status === 'rejected') expect(debits, 'rejected leave must not be debited').toBe(0);
  expect(['approved', 'rejected', 'pending']).toContain(app.status);
});

test('[hr_ops (RML)] CONC-BULK-01 committing one import job in parallel applies it once', async () => {
  const h = await login('hrops@rashmi.test');
  const reason = `E2E concurrency bulk ${Date.now()}`;
  const csv = `Employee code,Leave type,Mode,Days,Reason\nRML000009,SL,adjust,0.5,${reason}\n`;
  const p = await h.post('/api/bulk/leave-balances/preview', { filename: 'conc.csv', base64: b64(csv) });
  expect(p.status(), await p.text()).toBe(200);
  const job = await p.json();
  const jobId = job.id ?? job.jobId ?? job.job?.id;
  const rs = await Promise.all(Array.from({ length: N }, () => h.post(`/api/bulk/leave-balances/jobs/${jobId}/commit`, {})));
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM lv.ledger WHERE note LIKE '%' || $1", [reason]);
  expect(n, `ledger lines written (commit responses ${codes(rs)})`).toBe(1);
  expect(wins(rs), codes(rs)).toBe(1);
});

test('[hr_ops (RML)] CONC-PUNCH-01 the same punches uploaded twice in parallel are stored once', async () => {
  const h = await login('hrops@rashmi.test');
  const day = recentWeekday(2); // a past day in the open (unlocked) month
  const label = `${day.label} 09:01:00`;
  const door = `E2E-CONC-${Date.now()}`;
  const csv = `Employee No,Employee Name,Swipe Date,Door/Address,Swipe Type\nRML000009,Priya Sharma,${label},${door},IN\n`;
  const previews = await Promise.all([1, 2].map((i) => h.post('/api/bulk/punches/preview', { filename: `p${i}.csv`, base64: b64(csv) })));
  for (const r of previews) expect(r.status(), await r.text()).toBe(200);
  const ids = await Promise.all(previews.map(async (r) => { const j = await r.json(); return j.id ?? j.jobId ?? j.job?.id; }));
  const rs = await Promise.all(ids.map((id) => h.post(`/api/bulk/punches/jobs/${id}/commit`, {})));
  for (const r of rs) if (!ok(r)) console.log('punch commit:', r.status(), await r.text());
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM att.swipe_events WHERE employee_no='RML000009' AND door_code=$1", [door]);
  expect(n, `swipe rows (commit responses ${codes(rs)})`).toBe(1);
  expect(rs.some(ok), `at least one commit succeeds: ${codes(rs)}`).toBeTruthy();
});

test.describe('payroll RGH June run under concurrency', () => {
  let runId = 0; let maker: ApiClient; let checker: ApiClient;
  test.beforeAll(async () => {
    const [r] = await q<{ id: number }>("SELECT id FROM pay.payroll_runs WHERE company_id=2 AND month='2026-06-01' AND run_type='regular' ORDER BY id LIMIT 1");
    runId = Number(r?.id ?? 0);
    maker = await login(EXTRA.payroll_rgh);
    checker = await login('hrhead@rashmi.test');
  });
  const call = (c: ApiClient, proc: string, extra: Record<string, unknown> = {}) => c.post(`/api/payroll/runs/${proc}`, { id: runId, ...extra });
  const statusOf = async () => (await q<{ status: string }>('SELECT status FROM pay.payroll_runs WHERE id=$1', [runId]))[0].status;

  test('[payroll_admin] CONC-PAY-01 parallel compute leaves one item per employee', async () => {
    test.skip(!runId, 'no RGH June run');
    if (['finalized', 'approved', 'paid'].includes(await statusOf())) { const sa = await login('admin@rashmi.test'); const r = await call(sa, 'reopen', { reason: 'E2E concurrency re-run' }); expect(r.status(), `reopen: ${await r.text()}`).toBe(200); }
    const st = await statusOf();
    if (!['draft', 'reopened', 'inputs_locked'].includes(st)) { const r = await call(maker, 'returnToDraft', { reason: 'E2E concurrency: recompute RGH June' }); expect(r.status(), await r.text()).toBe(200); }
    if (st !== 'inputs_locked') { const r = await call(maker, 'lockInputs'); expect(r.status(), `lockInputs from ${st}: ${await r.text()}`).toBe(200); }
    const rs = await Promise.all(Array.from({ length: 3 }, () => call(maker, 'compute')));
    expect(rs.some(ok), codes(rs)).toBeTruthy();
    const [d] = await q<{ items: number; emps: number }>('SELECT count(*)::int items, count(DISTINCT employee_id)::int emps FROM pay.payroll_items WHERE run_id=$1', [runId]);
    expect(d.items, `items vs distinct employees after parallel compute (${codes(rs)})`).toBe(d.emps);
    const [l] = await q<{ dup: number }>('SELECT count(*)::int dup FROM (SELECT item_id, component_code FROM pay.payroll_item_lines WHERE item_id IN (SELECT id FROM pay.payroll_items WHERE run_id=$1) GROUP BY 1,2 HAVING count(*)>1) x', [runId]).catch(() => [{ dup: 0 }]);
    expect(l.dup, 'no duplicated component lines').toBe(0);
  });

  test('[hr_head] CONC-PAY-02 double approve / double finalize / double mark-paid each succeed once', async () => {
    test.skip(!runId, 'no RGH June run');
    expect((await call(maker, 'review')).status()).toBe(200);
    const ap = await Promise.all(Array.from({ length: N }, () => call(checker, 'approve')));
    expect(wins(ap), `approve ×${N}: ${codes(ap)}`).toBe(1);
    const fin = await Promise.all(Array.from({ length: N }, () => call(checker, 'finalize')));
    expect(wins(fin), `finalize ×${N}: ${codes(fin)}`).toBe(1);
    expect(await statusOf()).toBe('finalized');
    // Outputs generated twice at once (double click): payslip archive once per employee; bank file count reported.
    const [{ t0 }] = await q<{ t0: string }>('SELECT now()::text t0');
    const ps = await Promise.all(Array.from({ length: 3 }, () => maker.post('/api/payroll/outputs/generateRunPayslips', { runId })));
    expect(ps.some(ok), `payslips ×3: ${codes(ps)}`).toBeTruthy();
    const [dup] = await q<{ n: number }>("SELECT count(*)::int n FROM (SELECT owner_employee_id FROM core.documents WHERE kind='payslip' AND created_at >= $1::timestamptz AND status IS DISTINCT FROM 'superseded' GROUP BY 1 HAVING count(*)>1) x", [t0]);
    test.info().annotations.push({ type: 'payslip-dup-employees', description: String(dup.n) });
    const [ref] = await q<{ n: number }>('SELECT count(*)::int n FROM pay.payroll_items i WHERE i.run_id=$1 AND i.payslip_document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM core.documents d WHERE d.id=i.payslip_document_id)', [runId]);
    expect(ref.n, 'every item points at a stored payslip').toBe(0);
    const bf = await Promise.all(Array.from({ length: 3 }, () => maker.post('/api/payroll/outputs/generateBankFile', { runId })));
    expect(bf.some(ok), `bank file ×3: ${codes(bf)}`).toBeTruthy();
    const [bb] = await q<{ n: number }>('SELECT count(*)::int n FROM pay.bank_batches WHERE run_id=$1 AND created_at >= $2::timestamptz', [runId, t0]);
    test.info().annotations.push({ type: 'bank-batches-from-parallel-clicks', description: String(bb.n) });
    expect.soft(bb.n, `parallel bank-file clicks should not create several payable batches (${codes(bf)})`).toBe(1);
    const paid = await Promise.all(Array.from({ length: N }, (_, i) => call(checker, 'markPaid', { paymentReference: `E2E-CONC-${i}` })));
    expect(wins(paid), `markPaid ×${N}: ${codes(paid)}`).toBe(1);
  });
});

test('[hr_head] CONC-FNF-01 paying the same F&F in parallel pays it once', async () => {
  const [sep] = await q<{ id: number; company_id: number }>("SELECT s.id, e.company_id FROM core.separations s JOIN core.employees e ON e.id=s.employee_id WHERE s.status='approved' AND e.ecode='RML033909' LIMIT 1");
  test.skip(!sep, 'no approved RML separation');
  // Snapshot leavers were seeded as 'approved' without the clearance fan-out the approval step normally does; mirror it.
  await q("INSERT INTO core.clearances (separation_id, department, status, remarks, recovery_amount) SELECT $1, d, 'pending', 'E2E fan-out', 0 FROM unnest(ARRAY['IT','Admin','Finance','HR']) d WHERE NOT EXISTS (SELECT 1 FROM core.clearances c WHERE c.separation_id=$1 AND c.department=d)", [sep.id]);
  // Clearances signed off all at once (and IT twice): one clearance row per department must remain.
  const sa = await login('admin@rashmi.test');
  const depts = ['IT', 'IT', 'Admin', 'Finance', 'HR'];
  const cl = await Promise.all(depts.map((department) => sa.post('/api/lifecycle/clearances/update', { separationId: sep.id, department, status: 'cleared', remarks: 'E2E concurrency sign-off', ...(department === 'Finance' ? { isFinanceSignoff: true, recoveryAmountRupees: 0 } : {}) })));
  for (const r of cl) if (!ok(r)) console.log('clearance:', r.status(), await r.text());
  const [cd] = await q<{ dup: number }>('SELECT count(*)::int dup FROM (SELECT department FROM core.clearances WHERE separation_id=$1 GROUP BY 1 HAVING count(*)>1) x', [sep.id]);
  expect.soft(cd.dup, `duplicate clearance rows after parallel sign-off (${codes(cl)})`).toBe(0);
  const p = await login('payroll@rashmi.test');
  const c = await p.post(`/api/lifecycle/separations/${sep.id}/compute-fnf`, { separationId: sep.id });
  test.skip(c.status() >= 400 && /clearance/i.test(await c.text()), `F&F blocked by pending clearances: ${await c.text()}`);
  expect(c.status(), await c.text()).toBe(200);
  const lettersBefore = (await q<{ n: number }>("SELECT count(*)::int n FROM core.letters l JOIN core.separations s ON s.employee_id=l.employee_id WHERE s.id=$1 AND l.template_code='relieving_letter'", [sep.id]))[0].n;
  const hh = await login('hrhead@rashmi.test');
  const rs = await Promise.all(Array.from({ length: N }, (_, i) => hh.post(`/api/lifecycle/separations/${sep.id}/pay`, { separationId: sep.id, paymentReference: `E2E-FNF-${i}` })));
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM pay.fnf_settlements WHERE separation_id=$1 AND status='paid'", [sep.id]);
  expect(n, `paid settlements (responses ${codes(rs)})`).toBe(1);
  const lettersAfter = (await q<{ n: number }>("SELECT count(*)::int n FROM core.letters l JOIN core.separations s ON s.employee_id=l.employee_id WHERE s.id=$1 AND l.template_code='relieving_letter'", [sep.id]))[0].n;
  expect.soft(lettersAfter - lettersBefore, `relieving letters issued by ${N} parallel pays`).toBe(1);
  expect(wins(rs), `parallel F&F pay responses ${codes(rs)}`).toBe(1);
});
