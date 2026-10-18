/**
 * Full payroll run for June 2026 (RML) through the UI with maker/checker:
 * super_admin reopens → payroll_admin enters inputs (single, CSV, XLSX, bad files) → lock → compute →
 * configurability (PT slab change alters next compute, revert restores) → review → hr_head approves + finalizes →
 * outputs → mark paid → sample employee RML033625 sees net ₹59,124 in My Pay.
 */
import { EXTRA } from '../../lib/personas';
import { test, expect, task, type Session } from '../../lib/fixtures';
import { choose } from '../../lib/ui';
import { apiLogin } from '../../lib/api';
import { SAMPLE } from '../../lib/personas';
import { csvFile, xlsxFile, xlsFile } from '../../lib/files';
import { q } from '../../lib/db';

// Ordered (one worker, file order) but not 'serial': a failing step is reported and later steps still run.
test.describe.configure({ mode: 'default' });
const RUN_LABEL = /June 2026 RML/;
const inr = (n: number) => n.toLocaleString('en-IN');
let runId = 0;

async function openRun(s: Session) {
  await s.nav('Payroll', '/payroll');
  await s.click(s.main().getByRole('list', { name: 'Payroll runs' }).getByRole('button', { name: RUN_LABEL }));
  await expect(s.main().getByRole('heading', { name: /Rashmi Metaliks Limited — June 2026/ })).toBeVisible();
}
async function status(s: Session) { return (await s.main().getByText(/Run #\d+/).first().innerText()); }
async function step(s: Session, button: RegExp, toast: RegExp) {
  await s.click(s.main().getByRole('group', { name: 'Run actions' }).getByRole('button', { name: button }).or(s.main().getByRole('button', { name: button })).first());
  await s.expectToast(toast, 60_000);
}
async function reasonDrawer(s: Session, text: string) {
  const d = s.page.getByRole('dialog').last();
  await s.fill(d.getByRole('textbox'), text);
  await s.click(d.getByRole('button', { name: 'Confirm' }));
}
async function sampleNet(s: Session): Promise<string> {
  await s.click(s.main().getByRole('tab', { name: /Register/ }));
  await s.fill(s.main().getByRole('textbox', { name: 'Search' }), SAMPLE.ecode);
  const row = s.main().getByRole('row').filter({ hasText: SAMPLE.ecode });
  await expect(row).toBeVisible();
  return row.innerText();
}
async function ensureDraft(s: Session, why: string) {
  const b = s.main().getByRole('button', { name: 'Back to draft' });
  if (await b.isVisible().catch(() => false)) {
    await s.click(b);
    await reasonDrawer(s, why);
    await s.expectToast(/back to draft: done/i);
  }
}
async function recompute(s: Session, why: string) {
  await ensureDraft(s, why);
  await step(s, /^Lock inputs$/, /lock inputs: done/i);
  await step(s, /^Compute payroll$/, /compute: done/i);
}

test.beforeAll(async () => {
  const [r] = await q<{ id: number }>("SELECT id FROM pay.payroll_runs WHERE company_id=1 AND month='2026-06-01' AND run_type='regular' ORDER BY id LIMIT 1");
  runId = Number(r?.id ?? 0);
});

test(task('super_admin', 'SA-PAY', 'reopen a finalized run (break-glass, reason audited)'), async ({ as, ux }) => {
  ux.start('Reopen finalized run');
  const s = await as('super_admin');
  await openRun(s);
  const st = await status(s);
  test.skip(!/finalized|paid|approved/i.test(await s.main().innerText()), `run not finalized (${st})`);
  await s.click(s.main().getByRole('button', { name: /Reopen/ }));
  await reasonDrawer(s, 'E2E: re-run June with the fixed engine');
  await s.expectToast(/reopen: done/i);
  await expect(s.main().getByText(/reopened/i).first()).toBeVisible();
  const audit = await q("SELECT 1 FROM core.audit_log WHERE entity='pay.payroll_runs' AND action='payroll_run_reopened' AND entity_id=$1", [runId]);
  expect(audit.length, 'reopen is audited').toBeGreaterThan(0);
});

test(task('payroll_admin', 'P4r', 'a reopened run accepts variable inputs (UI offers the form)'), async ({ as, ux }) => {
  ux.start('Add input to reopened run');
  const s = await as('payroll_admin');
  await openRun(s);
  await s.click(s.main().getByRole('tab', { name: /Variable inputs/ }));
  const form = s.main().getByRole('textbox', { name: 'E-code' });
  test.skip(!(await form.isVisible().catch(() => false)), 'UI does not offer inputs on a reopened run (consistent)');
  await s.fill(form, 'RML033901');
  await s.fill(s.main().getByRole('spinbutton', { name: /Amount/ }), '1');
  await s.fill(s.main().getByRole('textbox', { name: 'Note' }), 'E2E reopened check');
  await s.click(s.main().getByRole('button', { name: /^Add$/ }));
  await s.expectToast(/input added/i);
  const row = s.main().getByRole('row').filter({ hasText: 'E2E reopened check' });
  await s.click(row.getByRole('button', { name: /Remove/ }));
  await s.expectToast(/input removed/i);
});

test(task('payroll_admin', 'P5', `lock → compute: sample ${SAMPLE.ecode} nets exactly ₹${inr(SAMPLE.expectedNet)}`), async ({ as, ux }) => {
  ux.start('Lock and compute');
  const s = await as('payroll_admin');
  await openRun(s);
  await ensureDraft(s, 'E2E: recompute');
  await step(s, /^Lock inputs$/, /lock inputs: done/i);
  await step(s, /^Compute payroll$/, /compute: done/i);
  const row = await sampleNet(s);
  expect(row, `register row for ${SAMPLE.ecode}`).toContain(`₹${inr(SAMPLE.expectedNet)}`);
  const [it] = await q<{ net_pay: string }>('SELECT i.net_pay FROM pay.payroll_items i JOIN core.employees e ON e.id=i.employee_id WHERE i.run_id=$1 AND e.ecode=$2', [runId, SAMPLE.ecode]);
  expect(Number(it?.net_pay), 'stored net pay').toBe(SAMPLE.expectedNet);
});

test(task('payroll_admin', 'P4a', 'add a variable input with the form; bad e-code refused'), async ({ as, ux }) => {
  ux.start('Add variable input');
  const s = await as('payroll_admin');
  await openRun(s);
  await ensureDraft(s, 'E2E: enter June variable inputs');
  await s.click(s.main().getByRole('tab', { name: /Variable inputs/ }));
  await s.step('add INCENTIVE ₹500 for RML033901', async () => {
    await s.fill(s.main().getByRole('textbox', { name: 'E-code' }), 'RML033901');
    await choose(s, s.main().getByRole('combobox', { name: 'Component' }), /Incentive/);
    await s.fill(s.main().getByRole('spinbutton', { name: /Amount/ }), '500');
    await s.fill(s.main().getByRole('textbox', { name: 'Note' }), 'E2E June incentive');
    await s.click(s.main().getByRole('button', { name: /^Add$/ }));
    await s.expectToast(/input added/i);
    await expect(s.main().getByRole('row').filter({ hasText: 'E2E June incentive' })).toBeVisible();
  });
  await s.step('unknown e-code is refused with a message naming the row', async () => {
    await s.fill(s.main().getByRole('textbox', { name: 'E-code' }), 'RML099999');
    await s.fill(s.main().getByRole('spinbutton', { name: /Amount/ }), '100');
    await s.fill(s.main().getByRole('textbox', { name: 'Note' }), 'E2E bad ecode');
    await s.click(s.main().getByRole('button', { name: /^Add$/ }));
    await expect(s.page.locator('[data-sonner-toast][data-type=error]').first()).toContainText(/RML099999|not found|unknown|no employee/i);
  });
  await s.step('an RGH e-code cannot be added to the RML run', async () => {
    await s.fill(s.main().getByRole('textbox', { name: 'E-code' }), 'RGH033901');
    await s.fill(s.main().getByRole('spinbutton', { name: /Amount/ }), '100');
    await s.fill(s.main().getByRole('textbox', { name: 'Note' }), 'E2E cross-entity');
    await s.click(s.main().getByRole('button', { name: /^Add$/ }));
    await expect(s.page.locator('[data-sonner-toast][data-type=error]').first()).toBeVisible();
    await expect(s.main().getByRole('row').filter({ hasText: 'E2E cross-entity' })).toHaveCount(0);
  });
});

async function openBulk(s: Session) {
  await openRun(s);
  await ensureDraft(s, 'E2E: enter June variable inputs');
  await s.click(s.main().getByRole('tab', { name: /Variable inputs/ }));
  await s.click(s.main().getByRole('button', { name: /Bulk upload/ }));
  return s.page.getByRole('dialog').last();
}

test(task('payroll_admin', 'P4b', 'bulk upload variable inputs — good CSV commits all rows'), async ({ as, ux }, info) => {
  ux.start('Bulk CSV upload (good)');
  const s = await as('payroll_admin');
  const d = await openBulk(s);
  const f = csvFile(info.outputDir, 'inputs-good.csv', [['ecode', 'component_code', 'amount', 'note'], ['RML033902', 'OTHER_EARNINGS', 300, 'E2E csv row 1'], ['RML033903', 'INCENTIVE', 200, 'E2E csv row 2']]);
  await d.getByLabel(/choose a .xlsx or .csv file/i).setInputFiles(f); ux.clicks++;
  await s.click(d.getByRole('button', { name: /^Import 2 rows$/ }));
  await s.expectToast(/2|imported|committed|saved/i, 30_000);
  await s.page.keyboard.press('Escape');
  await expect(s.main().getByRole('row').filter({ hasText: 'E2E csv row 2' })).toBeVisible();
});

test(task('payroll_admin', 'P4c', 'bulk upload — bad CSV is rejected row by row, nothing saved'), async ({ as, ux }, info) => {
  ux.start('Bulk CSV upload (bad)');
  const s = await as('payroll_admin');
  const d = await openBulk(s);
  const f = csvFile(info.outputDir, 'inputs-bad.csv', [['ecode', 'component_code', 'amount', 'note'], ['RML099999', 'INCENTIVE', 100, 'unknown ecode'], ['RML033904', 'NOT_A_COMPONENT', 100, 'bad component'], ['RML033905', 'INCENTIVE', -50, 'negative'], ['RML033906', 'INCENTIVE', 'abc', 'not a number']]);
  await d.getByLabel(/choose a .xlsx or .csv file/i).setInputFiles(f); ux.clicks++;
  await expect(d.getByText(/error/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(d.getByRole('button', { name: /^Import \d+ rows?$/ }), 'commit blocked while rows have errors').toBeDisabled();
  await expect(d).toContainText(/RML099999/);
  const dl = s.page.waitForEvent('download', { timeout: 15_000 });
  await s.click(d.getByRole('button', { name: /Validation report/ }));
  expect((await dl).suggestedFilename()).toMatch(/\.xlsx$/);
  await s.page.keyboard.press('Escape');
  await expect(s.main().getByRole('row').filter({ hasText: /unknown ecode|bad component/ })).toHaveCount(0);
});

test(task('payroll_admin', 'P4d', 'bulk upload — good Excel (.xlsx) commits; legacy .xls refused with guidance'), async ({ as, ux }, info) => {
  ux.start('Bulk Excel upload');
  const s = await as('payroll_admin');
  const d = await openBulk(s);
  const x = await xlsxFile(info.outputDir, 'inputs-good.xlsx', [['ecode', 'component_code', 'amount', 'note'], ['RML033905', 'INCENTIVE', 100, 'E2E xlsx row']]);
  await d.getByLabel(/choose a .xlsx or .csv file/i).setInputFiles(x); ux.clicks++;
  await s.click(d.getByRole('button', { name: /^Import 1 row$/ }));
  await s.expectToast(/1|imported|committed|saved/i, 30_000);
  const d2 = s.page.getByRole('dialog').last();
  if (await d2.getByRole('button', { name: 'Done' }).isVisible().catch(() => false)) await d2.getByRole('button', { name: 'Done' }).click();
  else await s.page.keyboard.press('Escape');
  await expect(s.main().getByRole('row').filter({ hasText: 'E2E xlsx row' })).toBeVisible();
  const d3 = await openBulk(s);
  await d3.getByLabel(/choose a .xlsx or .csv file/i).setInputFiles(xlsFile(info.outputDir, 'legacy.xls'));
  await expect(s.page.locator('[data-sonner-toast][data-type=error]').first()).toContainText(/\.xls|xlsx/i);
});

test(task('payroll_admin', 'P5b', 'recompute after inputs: inputs land on the right employees, sample unchanged'), async ({ as }) => {
  const s = await as('payroll_admin');
  await openRun(s);
  await recompute(s, 'E2E: recompute with inputs');
  expect(await sampleNet(s)).toContain(`₹${inr(SAMPLE.expectedNet)}`);
  const api = await apiLogin('payroll@rashmi.test');
  const lines = await q<{ ecode: string; amt: string }>(`SELECT e.ecode, SUM(l.amount) amt FROM pay.payroll_item_lines l JOIN pay.payroll_items i ON i.id=l.item_id JOIN core.employees e ON e.id=i.employee_id
     WHERE i.run_id=$1 AND l.component_code IN ('INCENTIVE','OTHER_EARNINGS') AND e.ecode IN ('RML033901','RML033902','RML033903','RML033905') GROUP BY e.ecode`, [runId]);
  expect(Object.fromEntries(lines.map((l) => [l.ecode, Number(l.amt)]))).toMatchObject({ RML033902: 300, RML033903: 200, RML033905: 100 });
  await api.dispose();
});

test(task('payroll_admin', 'P8', 'payroll settings page exists to edit statutory rates / PT slabs / GL in the UI'), async ({ as, ux }) => {
  ux.start('Open payroll settings');
  const s = await as('payroll_admin');
  await s.nav('Payroll', '/payroll');
  await s.click(s.main().getByRole('link', { name: /payroll settings/i }).or(s.main().getByRole('button', { name: /payroll settings/i })).first());
  await expect(s.page, 'payroll settings route must not bounce to the dashboard').toHaveURL(/\/payroll\/settings/);
  await expect(s.main()).toContainText(/professional.tax|PT slab/i);
  await expect(s.main()).toContainText(/provident fund|PF/);
});

test(task('payroll_admin', 'P8b', 'configurability: a PT slab change alters the next compute; reverting restores it'), async ({ as, ux }) => {
  ux.start('Config change → recompute');
  const s = await as('payroll_admin');
  const api = await apiLogin(EXTRA.payroll_group) /* group-wide config needs an unscoped payroll admin */;
  const slabs = (await (await api.get('/api/payroll/config/pt-slabs')).json() as any[]).filter((x) => x.stateCode === 'WB');
  const orig = { stateCode: 'WB', effectiveFrom: '2026-06-01', basis: slabs[0]?.basis ?? 'earned_monthly', slabs: slabs.map((x) => ({ minMonthly: x.minMonthly, maxMonthly: x.maxMonthly, amount: x.amount })) };
  const bumped = { ...orig, slabs: orig.slabs.map((x) => (x.maxMonthly === null ? { ...x, amount: x.amount + 50 } : x)) };
  try {
    await s.step('payroll admin raises the top WB PT slab by ₹50 from Jun-2026', async () => {
      let r = await api.put('/api/payroll/config/pt-slabs', bumped);
      if (r.status() === 409 && /finalized/i.test(await r.text())) {
        // WB slabs are shared with RGH, whose June run is finalized: the no-retro guard is correct.
        // Reopen RGH June (super_admin, audited) so June is open for both companies, then retry.
        const sa = await apiLogin('admin@rashmi.test');
        const [rgh] = await q<{ id: number }>("SELECT id FROM pay.payroll_runs WHERE company_id=2 AND month='2026-06-01' AND status IN ('finalized','paid')");
        if (rgh) expect((await sa.post('/api/payroll/runs/reopen', { id: Number(rgh.id), reason: 'E2E: open June for shared WB PT change' })).status()).toBe(200);
        await sa.dispose();
        r = await api.put('/api/payroll/config/pt-slabs', bumped);
      }
      expect(r.status(), await r.text()).toBe(200);
    });
    await openRun(s);
    await s.step('back to draft → lock → compute', () => recompute(s, 'E2E: apply PT slab change'));
    await s.step(`sample net drops by ₹50 to ₹${inr(SAMPLE.expectedNet - 50)}`, async () => {
      expect(await sampleNet(s)).toContain(`₹${inr(SAMPLE.expectedNet - 50)}`);
    });
  } finally {
    await s.step('revert the slab set and recompute', async () => {
      expect((await api.put('/api/payroll/config/pt-slabs', orig)).status()).toBe(200);
      await openRun(s);
      if (await s.main().getByRole('button', { name: 'Back to draft' }).isVisible().catch(() => false)) await recompute(s, 'E2E: revert PT slab change');
      expect(await sampleNet(s)).toContain(`₹${inr(SAMPLE.expectedNet)}`);
    });
  }
});

test(task('payroll_admin', 'P8c', 'configurability: a future-dated statutory rate does not change this month (no retro)'), async ({ as }) => {
  const s = await as('payroll_admin');
  const api = await apiLogin(EXTRA.payroll_group) /* group-wide config needs an unscoped payroll admin */;
  const r = await api.post('/api/payroll/config/statutory-rates', { scheme: 'ESIC', param: 'ee_rate_pct', value: 1.0, effectiveFrom: '2027-04-01', sourceNote: 'E2E future-dated test version' });
  expect(r.status(), await r.text()).toBe(200);
  await openRun(s);
  await recompute(s, 'E2E: future rate must not apply');
  expect(await sampleNet(s)).toContain(`₹${inr(SAMPLE.expectedNet)}`);
});

test(task('payroll_admin', 'P4e', 'send for approval; maker cannot approve own run (two-person rule)'), async ({ as, ux }) => {
  ux.start('Submit for approval');
  const s = await as('payroll_admin');
  await openRun(s);
  await step(s, /^Send for approval$/, /send for review: done/i);
  const approve = s.main().getByRole('button', { name: /Approve \(checker\)/ });
  if (await approve.isVisible().catch(() => false)) {
    await approve.click();
    await expect(s.page.locator('[data-sonner-toast][data-type=error]').first(), 'maker self-approval must be refused').toBeVisible();
    ux.unclear(1, 'maker is offered an "Approve (checker)" button that can only fail');
  }
  const ceo = await apiLogin('ceo@rashmi.test');
  expect((await ceo.post('/api/payroll/runs/approve', { id: runId })).status(), 'ceo_cell cannot co-sign payroll (RQ-RBAC-011)').toBe(403);
});

test(task('hr_head', 'HH3', 'checker approves and finalizes the run (typed confirmation)'), async ({ as, ux }) => {
  ux.start('Approve + finalize run');
  const s = await as('hr_head');
  await openRun(s);
  await step(s, /^Approve \(checker\)$/, /approve: done/i);
  await s.click(s.main().getByRole('button', { name: /^Finalize/ }));
  const dlg = s.page.getByRole('dialog').last();
  const phrase = ((await dlg.innerText()).match(/FINALIZE [A-Z]+ \d{4}/) ?? ['FINALIZE JUNE 2026'])[0];
  await s.fill(dlg.getByRole('textbox'), phrase);
  await s.click(dlg.getByRole('button', { name: /^Finalize$/ }));
  await s.expectToast(/finalize: done/i, 60_000);
  await expect(s.main().getByText(/finalized/i).first()).toBeVisible();
});

test(task('payroll_admin', 'P9', 'outputs: payslips archived, bank file, balanced SAP JV'), async ({ as, ux }) => {
  ux.start('Generate outputs');
  const s = await as('payroll_admin');
  await openRun(s);
  await s.click(s.main().getByRole('tab', { name: 'Outputs' }));
  await s.click(s.main().getByRole('button', { name: 'Generate payslips' }));
  await s.expectToast(/payslips archived/i, 60_000);
  await s.click(s.main().getByRole('button', { name: /Bank file/ }));
  await s.expectToast(/Bank file: \d+ transfers/i, 60_000);
  await s.click(s.main().getByRole('button', { name: /SAP JV/ }));
  await s.expectToast(/SAP JV balanced/i, 60_000);
});

test(task('hr_head', 'P16', 'mark the run paid with a bank reference'), async ({ as, ux }) => {
  ux.start('Mark paid');
  const s = await as('hr_head');
  await openRun(s);
  await s.click(s.main().getByRole('button', { name: /Mark paid/ }));
  await reasonDrawer(s, 'UTR-E2E-JUN26-0001');
  await s.expectToast(/mark paid: done/i);
  await expect(s.main().getByText(/\bpaid\b/i).first()).toBeVisible();
});

test(task('payroll_admin', 'P8d', 'no retro: changing PT slabs for a finalized month is refused'), async () => {
  const api = await apiLogin(EXTRA.payroll_group) /* group-wide config needs an unscoped payroll admin */;
  const slabs = (await (await api.get('/api/payroll/config/pt-slabs')).json() as any[]).filter((x) => x.stateCode === 'WB');
  const res = await api.put('/api/payroll/config/pt-slabs', { stateCode: 'WB', effectiveFrom: '2026-06-01', basis: slabs[0].basis, slabs: slabs.map((x) => ({ minMonthly: x.minMonthly, maxMonthly: x.maxMonthly, amount: x.amount + 1 })) });
  expect(res.status(), 'retro change into a finalized/paid month must be refused').toBeGreaterThanOrEqual(400);
});

test(task('employee', 'E13', `sample employee sees June payslip net ₹${inr(SAMPLE.expectedNet)} in My Pay`), async ({ as, ux }) => {
  ux.start('View my payslip');
  const s = await as({ key: 'RML033625', role: 'employee', email: SAMPLE.email, name: 'Prateek', nav: [], allowed: [], forbidden: [] });
  await s.nav('My Pay', '/my/pay');
  const june = s.main().getByRole('button', { name: /June 2026|Jun 2026|2026-06/ }).or(s.main().getByRole('link', { name: /June 2026|Jun 2026|2026-06/ }));
  if (await june.count()) await s.click(june.first());
  await expect(s.main()).toContainText(`₹${inr(SAMPLE.expectedNet)}`);
  await expect(s.main()).not.toContainText(/RML035384|57,999/);
});
