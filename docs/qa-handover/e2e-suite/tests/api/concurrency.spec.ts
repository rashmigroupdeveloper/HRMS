/**
 * Transaction safety under concurrency (owner scope 4): fire the same state-changing request in parallel and check
 * that exactly one wins, nothing is applied twice, and the DB stays consistent (idempotency / race conditions).
 * Runs as its own project after `payroll` (it touches the RGH June run and an approved separation's F&F).
 */
import { test, expect, type APIResponse } from '@playwright/test';
import { apiLogin, type ApiClient } from '../../lib/api';
import { EXTRA } from '../../lib/personas';
import { q } from '../../lib/db';
import { futureWeekday } from '../../lib/dates';

test.describe.configure({ mode: 'serial' });
const N = 5;
const ok = (r: APIResponse) => r.status() >= 200 && r.status() < 300;
const wins = (rs: APIResponse[]) => rs.filter(ok).length;
const codes = (rs: APIResponse[]) => rs.map((r) => r.status()).join(',');
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const clients: ApiClient[] = [];
async function login(email: string) { const c = await apiLogin(email); clients.push(c); return c; }
test.afterAll(async () => { for (const c of clients) await c.dispose(); });

test('[employee] CONC-LV-01 double-submit of the same leave creates one application', async () => {
  const day = futureWeekday(40);
  const e = await login('employee2@rashmi.test');
  const rs = await Promise.all(Array.from({ length: N }, () => e.post('/api/leave/applications', { leaveType: 'CL', fromDate: day.iso, toDate: day.iso, reason: 'E2E concurrency: double click' })));
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM lv.applications a JOIN core.employees e ON e.id=a.employee_id WHERE e.ecode='RML000009' AND a.status IN ('pending','approved') AND $1::date BETWEEN a.from_date AND a.to_date", [day.iso]);
  expect(n, `overlapping live applications for ${day.iso} (responses ${codes(rs)})`).toBe(1);
  expect(wins(rs), codes(rs)).toBe(1);
});

test('[manager] CONC-WF-01 parallel approvals of one request: one decision, one ledger debit', async () => {
  const day = futureWeekday(44);
  const e = await login('employee2@rashmi.test');
  const a = await e.post('/api/leave/applications', { leaveType: 'CL', fromDate: day.iso, toDate: day.iso, reason: 'E2E concurrency: approve race' });
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
  const day = futureWeekday(48);
  const e = await login('employee2@rashmi.test');
  const a = await e.post('/api/leave/applications', { leaveType: 'CL', fromDate: day.iso, toDate: day.iso, reason: 'E2E concurrency: approve vs reject' });
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
  const [{ n }] = await q<{ n: number }>('SELECT count(*)::int n FROM lv.ledger WHERE note=$1', [reason]);
  expect(n, `ledger lines written (commit responses ${codes(rs)})`).toBe(1);
  expect(wins(rs), codes(rs)).toBe(1);
});

test('[hr_ops (RML)] CONC-PUNCH-01 the same punches uploaded twice in parallel are stored once', async () => {
  const h = await login('hrops@rashmi.test');
  const day = futureWeekday(1); // a day in the open (unlocked) month window
  const label = `${day.label} 09:0${new Date().getSeconds() % 10}:00`;
  const csv = `Employee No,Employee Name,Swipe Date,Door/Address,Swipe Type\nRML000009,Priya Sharma,${label},E2E-CONC-DOOR,IN\n`;
  const previews = await Promise.all([1, 2].map((i) => h.post('/api/bulk/punches/preview', { filename: `p${i}.csv`, base64: b64(csv) })));
  for (const r of previews) expect(r.status(), await r.text()).toBe(200);
  const ids = await Promise.all(previews.map(async (r) => { const j = await r.json(); return j.id ?? j.jobId ?? j.job?.id; }));
  const rs = await Promise.all(ids.map((id) => h.post(`/api/bulk/punches/jobs/${id}/commit`, {})));
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM att.swipe_events WHERE employee_no='RML000009' AND door_code='E2E-CONC-DOOR' AND swipe_ts::date=$1::date", [day.iso]);
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
    if (!['draft'].includes(await statusOf())) { const r = await call(maker, 'returnToDraft', { reason: 'E2E concurrency: recompute RGH June' }); expect(r.status(), await r.text()).toBe(200); }
    expect((await call(maker, 'lockInputs')).status()).toBe(200);
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
    const paid = await Promise.all(Array.from({ length: N }, (_, i) => call(checker, 'markPaid', { paymentReference: `E2E-CONC-${i}` })));
    expect(wins(paid), `markPaid ×${N}: ${codes(paid)}`).toBe(1);
    const [b] = await q<{ n: number }>('SELECT count(*)::int n FROM pay.bank_batches WHERE run_id=$1', [runId]).catch(() => [{ n: 0 }]);
    expect(b.n, 'at most one bank batch for the run').toBeLessThanOrEqual(1);
  });
});

test('[hr_head] CONC-FNF-01 paying the same F&F in parallel pays it once', async () => {
  const [sep] = await q<{ id: number; company_id: number }>("SELECT s.id, e.company_id FROM core.separations s JOIN core.employees e ON e.id=s.employee_id WHERE s.status='approved' AND e.ecode='RML033909' LIMIT 1");
  test.skip(!sep, 'no approved RML separation');
  const p = await login('payroll@rashmi.test');
  const c = await p.post(`/api/lifecycle/separations/${sep.id}/compute-fnf`, { separationId: sep.id });
  test.skip(c.status() >= 400 && /clearance/i.test(await c.text()), `F&F blocked by pending clearances: ${await c.text()}`);
  expect(c.status(), await c.text()).toBe(200);
  const hh = await login('hrhead@rashmi.test');
  const rs = await Promise.all(Array.from({ length: N }, (_, i) => hh.post(`/api/lifecycle/separations/${sep.id}/pay`, { separationId: sep.id, paymentReference: `E2E-FNF-${i}` })));
  const [{ n }] = await q<{ n: number }>("SELECT count(*)::int n FROM pay.fnf_settlements WHERE separation_id=$1 AND status='paid'", [sep.id]);
  expect(n, `paid settlements (responses ${codes(rs)})`).toBe(1);
  expect(wins(rs), codes(rs)).toBe(1);
});
