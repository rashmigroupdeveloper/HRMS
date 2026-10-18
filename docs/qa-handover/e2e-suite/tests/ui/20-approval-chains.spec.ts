/** Multi-level approval chains (docs/08 §4) — each approver signs in and acts in turn through the Approvals UI. */
import { test, expect, task } from '../../lib/fixtures';
import { choose, decide, pickDate } from '../../lib/ui';
import { cohort } from '../../lib/personas';
import { futureWeekday } from '../../lib/dates';

test.describe('approval chains', () => {
  test(task('manager', 'M1', 'leave reject requires a note; employee sees the rejection reason'), async ({ as, ux }) => {
    ux.start('Reject leave with note');
    const r1 = futureWeekday(12);
    const e = await as('employee');
    await e.step(`employee applies SL for ${r1.label}`, async () => {
      await e.nav('My Leave', '/my/leave');
      await e.click(e.main().getByRole('button', { name: 'Apply for a day off' }).first());
      const dlg = e.page.getByRole('dialog', { name: /apply for a day off/i });
      await choose(e, dlg.getByRole('combobox', { name: 'Leave type' }), /Sick Leave/);
      await pickDate(e, dlg.getByRole('button', { name: /^First day/ }), r1.label);
      await pickDate(e, dlg.getByRole('button', { name: /^Last day/ }), r1.label);
      await e.fill(dlg.getByRole('textbox', { name: /why are you taking/i }), 'E2E: fever');
      await e.click(dlg.getByRole('button', { name: 'Send to my manager' }));
      await e.expectToast(/sent|submitted|manager/i);
    });
    const m = await as('manager');
    await m.step('Reject without a note is blocked', async () => {
      await m.nav('Approvals', '/approvals');
      await m.click(m.main().getByRole('button', { name: new RegExp(`Debajit Roy.*Leave.*SL · ${r1.label}`, 's') }).first());
      await m.click(m.main().getByRole('button', { name: /^Reject$/ }));
      await expect(m.main().getByText(/required|add a note|reason/i).first()).toBeVisible();
      await expect(m.main().getByRole('button', { name: new RegExp(`Debajit Roy.*SL · ${r1.label}`, 's') })).toBeVisible();
    });
    await m.step('Reject with a note', async () => {
      await decide(m, new RegExp(`Debajit Roy.*Leave.*SL · ${r1.label}`, 's'), 'Reject', 'E2E: critical audit that day, please re-plan');
      await m.expectToast(/reject|decision|recorded/i);
    });
    await e.step('employee sees "rejected" and the reason', async () => {
      await e.goto('/my/leave');
      const row = e.main().getByRole('listitem').filter({ hasText: new RegExp(`SL · ${r1.label}`) });
      await expect(row).toContainText(/rejected/i);
      await e.click(row.getByRole('link'));
      await expect(e.main()).toContainText(/critical audit/);
    });
  });

  test(task('hr_ops (RML)', 'M13', 'claim chain: employee → manager → HR ops verify → payroll pay'), async ({ as, ux }) => {
    ux.start('Claim 3-step chain');
    const e = await as(cohort('RML033910'));
    await e.step('employee submits a local-conveyance claim for October', async () => {
      await e.nav('My Claims', '/my/claims');
      await e.click(e.main().getByRole('button', { name: 'Submit Claim' }));
      const dlg = e.page.getByRole('dialog', { name: /submit reimbursement claim/i });
      await choose(e, dlg.getByRole('combobox', { name: 'Claim Type' }), /conveyance/i);
      await e.fill(dlg.getByRole('textbox', { name: 'Period From' }), '2026-10-01');
      await e.fill(dlg.getByRole('textbox', { name: 'Period To' }), '2026-10-31');
      await e.fill(dlg.getByRole('textbox', { name: 'Bill No' }), 'E2E-CONV-01');
      await e.fill(dlg.getByRole('textbox', { name: 'Bill Date' }), '2026-10-10');
      await e.fill(dlg.getByRole('spinbutton', { name: /Amount/ }), '1250');
      await e.click(dlg.getByRole('button', { name: 'Submit for Approval' }));
      await e.expectToast(/claim|submitted/i);
    });
    const m = await as('manager');
    await m.step('step 1 — reporting manager approves', async () => { await decide(m, /Sanjay Paul.*Claim/is, 'Approve'); await m.expectToast(/approved|recorded|decision/i); });
    const h = await as('hr_ops_rml');
    await h.step('step 2 — HR ops verifies', async () => { await decide(h, /Sanjay Paul.*Claim/is, 'Approve'); await h.expectToast(/approved|recorded|decision|verified/i); });
    const p = await as('payroll_admin');
    await p.step('step 3 — payroll approves for payment', async () => { await decide(p, /Sanjay Paul.*Claim/is, 'Approve'); await p.expectToast(/approved|recorded|decision|paid/i); });
    await e.step('employee sees the claim approved', async () => {
      await e.goto('/my/claims');
      await expect(e.main().getByRole('row').filter({ hasText: /1,250/ }).first()).toContainText(/approved|paid|payout/i);
    });
  });

  test(task('hr_head', 'HH2-loan', 'loan chain: employee → manager → HR head → payroll'), async ({ as, ux }) => {
    ux.start('Loan 3-step chain');
    const e = await as(cohort('RML033906'));
    await e.step('employee applies for a ₹30,000 loan from December', async () => {
      await e.nav(/Loans/, '/loans');
      await e.click(e.main().getByRole('button', { name: /^Apply$/ }));
      await e.fill(e.main().getByRole('spinbutton', { name: /Principal/ }), '30000');
      await e.fill(e.main().getByRole('spinbutton', { name: /Tenure/ }), '10');
      await e.fill(e.main().getByRole('textbox', { name: /First Deduction Month/ }), '2026-12-01');
      await e.click(e.main().getByRole('button', { name: 'Submit Loan Request' }));
      await e.expectToast(/loan|submitted|request/i);
    });
    await e.step('loan is pending approval, NOT active', async () => {
      await e.click(e.main().getByRole('button', { name: 'My Loans' }));
      const row = e.main().getByRole('row').filter({ hasText: /30,000/ }).first();
      await expect(row).toBeVisible();
      await expect(row).not.toContainText(/active/i);
    });
    const m = await as('manager');
    await m.step('step 1 — manager approves', async () => { await decide(m, /Sneha Kumari.*Loan/is, 'Approve'); await m.expectToast(/approved|recorded|decision/i); });
    const hh = await as('hr_head');
    await hh.step('step 2 — HR head approves', async () => { await decide(hh, /Sneha Kumari.*Loan/is, 'Approve'); await hh.expectToast(/approved|recorded|decision/i); });
    const p = await as('payroll_admin');
    await p.step('step 3 — payroll approves (disburse)', async () => { await decide(p, /Sneha Kumari.*Loan/is, 'Approve'); await p.expectToast(/approved|recorded|decision/i); });
    await e.step('loan now active with EMI schedule', async () => {
      await e.goto('/loans');
      await expect(e.main().getByRole('row').filter({ hasText: /30,000/ }).first()).toContainText(/active/i);
    });
  });

  test(task('hod', 'H2', 'travel advance chain: employee → manager → department head (HOD)'), async ({ as, ux }) => {
    ux.start('Travel advance 2-step chain');
    const e = await as('employee');
    await e.step('employee plans a trip and requests a ₹4,000 advance', async () => {
      await e.nav(/Travel/, '/travel');
      await e.click(e.main().getByRole('button', { name: 'Plan New Trip' }));
      const dlg = e.page.getByRole('dialog').last();
      await e.fill(dlg.getByRole('textbox', { name: 'Trip Title' }), 'E2E Paradip port visit');
      await e.fill(dlg.getByRole('textbox', { name: 'Destination City' }), 'Paradip');
      await e.fill(dlg.getByRole('textbox', { name: 'Departure Date' }), '2026-11-26');
      await e.fill(dlg.getByRole('textbox', { name: 'Return Date' }), '2026-11-27');
      await e.fill(dlg.getByRole('textbox', { name: 'Purpose of Travel' }), 'Export shipment inspection');
      await e.click(dlg.getByRole('button', { name: 'Submit Trip Requisition' }));
      await e.expectToast(/trip|submitted|created/i);
      await e.click(e.main().getByRole('button', { name: 'Advances' }));
      await e.click(e.main().getByRole('button', { name: /request|new advance|apply/i }).first());
      const adv = e.page.getByRole('dialog').last();
      const trip = adv.getByRole('combobox').first();
      if (await trip.count()) await choose(e, trip, /Paradip/);
      await e.fill(adv.getByRole('spinbutton').first(), '4000');
      const why = adv.getByRole('textbox').last(); if (await why.count()) await e.fill(why, 'Local transport and lodging');
      await e.click(adv.getByRole('button', { name: /submit|request/i }).last());
      await e.expectToast(/advance|submitted|request/i);
    });
    const m = await as('manager');
    await m.step('manager approves the trip requisition', async () => {
      await decide(m, /Debajit Roy.*Trip(?!.*Advance)/is, 'Approve'); await m.expectToast(/approved|recorded|decision/i);
    });
    await m.step('step 1 — reporting manager approves the advance (manager does NOT need payroll permission)', async () => {
      await decide(m, /Debajit Roy.*Advance/is, 'Approve'); await m.expectToast(/approved|recorded|decision/i);
    });
    const hod = await as('hod');
    await hod.step('step 2 — department head (functional manager) approves the advance', async () => {
      await decide(hod, /Debajit Roy.*Advance/is, 'Approve'); await hod.expectToast(/approved|recorded|decision/i);
    });
    await e.step('employee sees the advance approved', async () => {
      await e.goto('/travel');
      await e.click(e.main().getByRole('button', { name: 'Advances' }));
      await expect(e.main().getByRole('row').filter({ hasText: /4,000/ }).first()).toContainText(/approved|disbursed/i);
    });
  });

  test(task('hr_head', 'HH2-resign', 'resignation chain: employee → manager → HR head → HR ops'), async ({ as, ux }) => {
    ux.start('Resignation 3-step chain');
    const e = await as(cohort('RML033923'));
    await e.step('employee submits resignation', async () => {
      await e.goto('/lifecycle/separation');
      await e.click(e.main().getByRole('button', { name: /apply resignation/i }));
      const dlg = e.page.getByRole('dialog').last();
      await e.fill(dlg.getByRole('textbox', { name: /Requested Last Working Day/ }), '2027-01-15');
      await e.fill(dlg.getByRole('textbox', { name: 'Reason for Resignation' }), 'E2E: higher studies');
      await e.click(dlg.getByRole('button', { name: 'Submit Resignation' }));
      await e.expectToast(/resignation|submitted/i);
    });
    const m = await as('manager');
    await m.step('step 1 — manager approves', async () => { await decide(m, /Pooja Singh.*(Resign|Separation)/is, 'Approve'); await m.expectToast(/approved|recorded|decision/i); });
    const hh = await as('hr_head');
    await hh.step('step 2 — HR head approves', async () => { await decide(hh, /Pooja Singh.*(Resign|Separation)/is, 'Approve'); await hh.expectToast(/approved|recorded|decision/i); });
    const ho = await as('hr_ops_rml');
    await ho.step('step 3 — HR ops admin closure', async () => { await decide(ho, /Pooja Singh.*(Resign|Separation)/is, 'Approve'); await ho.expectToast(/approved|recorded|decision/i); });
  });

  test(task('senior_manager', 'S1', 'senior manager sees the whole subtree and can act on a skip-level request'), async ({ as, ux }) => {
    ux.start('Subtree visibility');
    const s = await as('senior_manager');
    await s.step('My Team lists skip-level reports (e.g. Debajit Roy under Amit)', async () => {
      await s.nav('My Team', '/my/team');
      const toggle = s.main().getByRole('button', { name: /entire team|whole team|all levels/i }).or(s.main().getByRole('switch', { name: /entire team/i }));
      if (await toggle.count()) await s.click(toggle.first()); else ux.unclear(1, 'no "entire team (N)" toggle (docs/08 §3)');
      await expect(s.main()).toContainText(/Debajit Roy/);
    });
  });

  test(task('manager', 'M1b', 'batch approve two requests from the inbox'), async ({ as, ux }) => {
    ux.start('Batch approve');
    const m = await as('manager');
    await m.nav('Approvals', '/approvals');
    const boxes = m.main().getByRole('checkbox', { name: /^Select / });
    test.skip((await boxes.count()) < 2, 'fewer than two pending requests in the inbox');
    await m.click(boxes.nth(0)); await m.click(boxes.nth(1));
    await m.click(m.main().getByRole('button', { name: /approve (selected|2)|batch approve/i }));
    await m.expectToast(/approved|2/i);
  });
});
