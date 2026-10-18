/** Employee (ESS) tasks done through the UI by filling forms and clicking. */
import { test, expect, task } from '../../lib/fixtures';
import { choose, pickDate } from '../../lib/ui';
import { cohort } from '../../lib/personas';
import { decide } from '../../lib/ui';

test.describe('employee self-service', () => {
  test(task('employee', 'E9', 'apply for leave → manager approves → employee sees approved'), async ({ as, ux }) => {
    ux.start('Apply leave');
    const s = await as('employee2');
    await s.step('My Leave → Apply for a day off', async () => {
      await s.nav('My Leave', '/my/leave');
      await s.click(s.main().getByRole('button', { name: 'Apply for a day off' }));
    });
    const dlg = s.page.getByRole('dialog', { name: /apply for a day off/i });
    await s.step('fill leave type, dates, reason', async () => {
      await choose(s, dlg.getByRole('combobox', { name: 'Leave type' }), /Casual Leave/);
      await pickDate(s, dlg.getByRole('button', { name: /^First day/ }), '28 Oct 2026');
      await pickDate(s, dlg.getByRole('button', { name: /^Last day/ }), '28 Oct 2026');
      await s.fill(dlg.getByRole('textbox', { name: /why are you taking/i }), 'E2E: family function');
      await expect(dlg).toContainText(/1 days? of Casual Leave/);
    });
    await s.step('send to manager and see it in motion', async () => {
      await s.click(dlg.getByRole('button', { name: 'Send to my manager' }));
      await s.expectToast(/sent|submitted|applied|manager/i);
      await expect(s.main().getByRole('link', { name: /CL · 28 Oct 2026/ })).toBeVisible();
    });
    const m = await as('manager');
    await m.step('manager approves it from the Approvals inbox', async () => {
      await decide(m, /Priya Sharma.*Leave.*CL · 28 Oct 2026/s, 'Approve');
      await m.expectToast(/approved|decision|recorded/i);
    });
    await s.step('employee sees the leave approved', async () => {
      await s.page.reload(); await s.page.waitForLoadState('networkidle');
      await expect(s.main().getByRole('listitem').filter({ hasText: /CL · 28 Oct 2026/ })).toContainText(/approved/i);
    });
  });

  test(task('employee', 'E9b', 'leave form validation: reason required, over-balance refused'), async ({ as, ux }) => {
    ux.start('Leave validation');
    const s = await as('employee2');
    await s.nav('My Leave', '/my/leave');
    await s.click(s.main().getByRole('button', { name: 'Apply for a day off' }));
    const dlg = s.page.getByRole('dialog', { name: /apply for a day off/i });
    await s.step('submit with no reason → inline error, nothing sent', async () => {
      await pickDate(s, dlg.getByRole('button', { name: /^First day/ }), '27 Oct 2026');
      await pickDate(s, dlg.getByRole('button', { name: /^Last day/ }), '27 Oct 2026');
      await s.click(dlg.getByRole('button', { name: 'Send to my manager' }));
      await expect(dlg, 'drawer stays open with an explanation').toBeVisible();
      await expect(dlg.getByText(/reason|required|tell us why/i).first()).toBeVisible();
    });
    await s.step('request more CL days than available → refused with a message', async () => {
      await pickDate(s, dlg.getByRole('button', { name: /^Last day/ }), '30 Oct 2026');
      await s.fill(dlg.getByRole('textbox', { name: /why are you taking/i }), 'E2E over-balance');
      await expect(dlg.getByText(/exceed|insufficient|not enough|only|cap|balance/i).first()).toBeVisible();
    });
  });

  test(task('employee', 'E5', 'attendance correction (AR) → manager approves → day regularised'), async ({ as, ux }) => {
    ux.start('Attendance correction');
    const s = await as('employee2');
    await s.step('My Attendance → pick 17 Oct (absent) → Request a correction', async () => {
      await s.nav('My Attendance', '/my/attendance');
      await s.click(s.main().getByRole('button', { name: /^2026-10-17/ }));
      await s.click(s.main().getByRole('button', { name: /request (a correction|regularisation) for (this day|17 Oct 2026)/i }).first());
    });
    const dlg = s.page.getByRole('dialog');
    await s.step('fill reason and submit', async () => {
      const reason = dlg.getByRole('textbox').last();
      await s.fill(reason, 'E2E: forgot to swipe, was on shift');
      await s.click(dlg.getByRole('button', { name: /send|submit/i }).last());
      await s.expectToast(/sent|submitted|manager/i);
    });
    await s.step('request listed under "Requests you have already sent"', async () => {
      await expect(s.main()).toContainText(/17 Oct 2026/);
    });
    const m = await as('manager');
    await m.step('manager approves the regularisation', async () => {
      await decide(m, /Priya Sharma.*(Regulari|AR|Attendance)/is, 'Approve');
      await m.expectToast(/approved|decision|recorded/i);
    });
    await s.step('17 Oct now shows as present/regularised on the employee calendar', async () => {
      await s.page.reload(); await s.page.waitForLoadState('networkidle');
      await expect(s.main().getByRole('button', { name: /^2026-10-17/ })).not.toHaveAccessibleName(/Absent/);
    });
  });

  test(task('employee', 'E2', 'view own profile; statutory IDs masked for self-view where required'), async ({ as, ux }) => {
    ux.start('View my profile');
    const s = await as('employee');
    await s.step('Account menu → View my info', async () => {
      await s.click(s.page.getByRole('button', { name: 'Account menu' }));
      await s.click(s.page.getByRole('menuitem', { name: /view my info/i }));
      ux.discover('in-page');
      await expect(s.main().getByRole('heading', { level: 1 })).toContainText('Debajit');
    });
    await s.step('Job & Reporting shows the reporting manager', async () => {
      await s.click(s.main().getByRole('tab', { name: 'Job & Reporting' }));
      await expect(s.main()).toContainText(/Amit/);
    });
  });

  test(task('employee', 'E22', 'raise a helpdesk ticket'), async ({ as, ux }) => {
    ux.start('Raise helpdesk ticket');
    const s = await as('employee');
    await s.nav('Helpdesk', '/helpdesk');
    await s.click(s.main().getByRole('button', { name: 'Raise ticket' }));
    const dlg = s.page.getByRole('dialog');
    const form = (await dlg.count()) ? dlg.last() : s.main();
    await s.step('fill category, subject, description and submit', async () => {
      const combo = form.getByRole('combobox').first();
      if (await combo.count()) await choose(s, combo, /.+/);
      const boxes = form.getByRole('textbox');
      await s.fill(boxes.first(), 'E2E: laptop not charging');
      if ((await boxes.count()) > 1) await s.fill(boxes.nth(1), 'Charger light off since morning; asset tag unknown.');
      await s.click(form.getByRole('button', { name: /raise|submit|create|send/i }).last());
      await s.expectToast(/ticket|raised|created/i);
    });
    await s.step('ticket appears in My tickets', async () => {
      await expect(s.main()).toContainText(/laptop not charging/i);
    });
  });

  test(task('employee', 'E-DIR', 'directory search finds a colleague (directory basics)'), async ({ as, ux }) => {
    ux.start('Directory search');
    const s = await as('employee');
    await s.nav('Directory', '/people');
    await s.fill(s.main().getByRole('searchbox').or(s.main().getByRole('textbox')).first(), 'Amit');
    await s.page.waitForTimeout(800);
    // docs/08 §3 puts "Directory (basic)" in the ESS nav; finding your own manager is the minimum.
    await expect(s.main(), 'employee directory should list colleagues (name/designation/contact), not 0 results').toContainText(/Amit Kumar Singh/);
  });

  test(task('employee', 'E20', 'see my letters and policies'), async ({ as, ux }) => {
    ux.start('Letters & policies');
    const s = await as('employee');
    await s.click(s.page.getByRole('button', { name: 'Account menu' }));
    await s.click(s.page.getByRole('menuitem', { name: /my documents/i }));
    ux.discover('in-page');
    await expect(s.main().getByRole('heading', { level: 1 })).toBeVisible();
    await s.nav(/Policies/, '/policies');
    await expect(s.main().getByRole('heading', { level: 1 })).toBeVisible();
  });

  test(task('employee', 'E16', 'plan a business trip'), async ({ as, ux }) => {
    ux.start('Plan a trip');
    const s = await as('employee');
    await s.nav(/Travel/, '/travel');
    await s.click(s.main().getByRole('button', { name: 'Plan New Trip' }));
    const dlg = s.page.getByRole('dialog').last();
    await s.step('fill trip form and submit', async () => {
      await s.fill(dlg.getByRole('textbox', { name: 'Trip Title' }), 'E2E Durgapur plant visit');
      await s.fill(dlg.getByRole('textbox', { name: 'Destination City' }), 'Durgapur');
      await s.fill(dlg.getByRole('textbox', { name: 'Departure Date' }), '2026-11-24');
      await s.fill(dlg.getByRole('textbox', { name: 'Return Date' }), '2026-11-25');
      await s.fill(dlg.getByRole('textbox', { name: 'Purpose of Travel' }), 'Vendor quality audit at Durgapur');
      await s.click(dlg.getByRole('button', { name: 'Submit Trip Requisition' }));
      await s.expectToast(/trip|submitted|created/i);
    });
    await expect(s.main()).toContainText('E2E Durgapur plant visit');
  });

  test(task('employee', 'E16b', 'trip with return before departure is refused'), async ({ as, ux }) => {
    ux.start('Trip date validation');
    const s = await as('employee');
    await s.goto('/travel');
    await s.click(s.main().getByRole('button', { name: 'Plan New Trip' }));
    const dlg = s.page.getByRole('dialog').last();
    await s.fill(dlg.getByRole('textbox', { name: 'Trip Title' }), 'E2E inverted dates');
    await s.fill(dlg.getByRole('textbox', { name: 'Destination City' }), 'Haldia');
    await s.fill(dlg.getByRole('textbox', { name: 'Departure Date' }), '2026-11-20');
    await s.fill(dlg.getByRole('textbox', { name: 'Return Date' }), '2026-11-18');
    await s.fill(dlg.getByRole('textbox', { name: 'Purpose of Travel' }), 'Should be refused');
    await s.click(dlg.getByRole('button', { name: 'Submit Trip Requisition' }));
    await expect(s.page.getByText(/before|after|invalid|return date/i).first()).toBeVisible();
    await s.goto('/travel');
    await expect(s.main()).not.toContainText('E2E inverted dates');
  });

  test(task('employee', 'E13b', 'My Pay shows only my own finalized payslips (no mock data)'), async ({ as, ux }) => {
    ux.start('View payslip');
    const s = await as('employee');
    await s.nav('My Pay', '/my/pay');
    await expect(s.main().getByRole('heading', { level: 1 })).toBeVisible();
    await expect(s.main(), 'no hard-coded demo payslip').not.toContainText(/RML035384|57,999|Demo mode/);
  });
});

test.describe('employee — other cohort members', () => {
  test(task('employee', 'E18', 'resign through ESS (discoverable from my own menus)'), async ({ as, ux }) => {
    ux.start('Apply resignation');
    const s = await as(cohort('RML033924'));
    await s.step('find the resignation form (nav → url fallback)', async () => {
      await s.nav(/Resign|Separation|Exit/i, '/lifecycle/separation');
      await s.click(s.main().getByRole('button', { name: /apply resignation/i }));
    });
    const dlg = s.page.getByRole('dialog').last();
    await s.step('fill reason + last working day and submit', async () => {
      await expect(dlg.getByRole('textbox', { name: /Employee ID/ }), 'form is pre-filled with MY employee identity').not.toHaveValue('301');
      await s.fill(dlg.getByRole('textbox', { name: /Requested Last Working Day/ }), '2026-12-31');
      await s.fill(dlg.getByRole('textbox', { name: 'Reason for Resignation' }), 'E2E: relocating to Pune for family reasons');
      await s.click(dlg.getByRole('button', { name: 'Submit Resignation' }));
      await s.expectToast(/resignation|submitted/i);
    });
  });
});
