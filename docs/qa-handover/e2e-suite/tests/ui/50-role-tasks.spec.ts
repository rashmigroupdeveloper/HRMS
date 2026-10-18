/**
 * ROLE_TASKS catalogue: every task ID in /workspace/hrms-test/requirements/ROLE_TASKS.md that is not driven
 * end-to-end by a deep-flow spec gets an entry-point test here: the role logs in, finds the screen through the
 * navigation (falls back to URL — which lowers the discoverability score), the page renders without denial or
 * errors, and the capability the task needs is present (a control or the expected content).
 * Deep flows elsewhere: E1 auth · E2/E5/E9/E16/E18/E20-22 employee · M1/M10/M13/S1/H2/O13/HH2/E15 chains ·
 * P4/P5/P8/P9/P16/HH3/HH7/HH10/E13 payroll run · O/HH/I/SA deep flows in 60-admin-flows.
 */
import { test, expect, task } from '../../lib/fixtures';
import { PERSONAS } from '../../lib/personas';
type PersonaKey = keyof typeof PERSONAS;

type T = { id: string; role: PersonaKey; title: string; nav: [string, string]; need: RegExp; control?: RegExp; tab?: RegExp; /** click this first; control is then looked up in the dialog */ open?: RegExp; /** open this combobox (in the dialog) before looking for the control among its options */ expand?: RegExp };
const DENIED = /missing permission|not allowed|access denied|don.t have|forbidden|not authori[sz]ed|no access/i;

const TASKS: T[] = [
  // Employee
  { id: 'E3', role: 'employee', title: 'request a family/nominee change', nav: ['My Profile', '/me'], need: /nominee|family/i, control: /request (a )?change|edit (family|nominee)|add (family|nominee)/i },
  { id: 'E4', role: 'employee', title: 'own attendance calendar and day detail', nav: ['My Attendance', '/my/attendance'], need: /in|out|worked|present|absent/i },
  { id: 'E6', role: 'employee', title: 'apply Permission (short duration)', nav: ['My Attendance', '/my/attendance'], need: /attendance/i, open: /request (a correction|regularisation)/i, expand: /what do you need/i, control: /short permission/i },
  { id: 'E7', role: 'employee', title: 'apply OD (incl. future date)', nav: ['My Attendance', '/my/attendance'], need: /attendance/i, open: /request (a correction|regularisation)/i, expand: /what do you need/i, control: /official duty|on duty/i },
  { id: 'E8', role: 'employee', title: 'claim comp-off', nav: ['My Leave', '/my/leave'], need: /comp.?off|compensatory/i },
  { id: 'E10', role: 'employee', title: 'cancel an approved leave', nav: ['My Leave', '/my/leave'], need: /cancel/i },
  { id: 'E11', role: 'employee', title: 'request leave encashment', nav: ['My Leave', '/my/leave'], need: /encash/i, control: /encash/i },
  { id: 'E12', role: 'employee', title: 'leave balances and ledger', nav: ['My Leave', '/my/leave'], need: /ledger/i },
  { id: 'E14', role: 'employee', title: 'investment declaration', nav: ['My Pay', '/my/pay'], need: /investment|declaration|80C/i, control: /declar/i },
  { id: 'E17', role: 'employee', title: 'expense claim with bills', nav: ['My Claims', '/my/claims'], need: /claim/i, control: /new claim|submit claim|raise claim|add claim/i },
  { id: 'E19', role: 'employee', title: 'alumni portal (payslips/letters only)', nav: ['Alumni', '/alumni'], need: /payslip|letter|alumni/i },
  { id: 'E23', role: 'employee', title: 'mobile ESS home and geo check-in', nav: ['Home', '/'], need: /check.?in|punch/i, control: /check.?in/i },
  { id: 'E24', role: 'employee', title: 'prejoin portal opens (link-gated)', nav: ['Prejoin', '/onboard/prejoin'], need: /link|token|invalid|expired|prejoin|application/i },
  // Manager
  { id: 'M2', role: 'manager', title: 'approvals inbox lists AR/leave/OD types', nav: ['Approvals', '/approvals'], need: /approv/i },
  { id: 'M3', role: 'manager', title: 'OT decisions within 48h', nav: ['OT Decisions', '/my/team/overtime'], need: /overtime|\bOT\b/i },
  { id: 'M4', role: 'manager', title: 'pre-approve OT (OT plan)', nav: ['OT Decisions', '/my/team/overtime'], need: /pre.?approv|OT plan/i, control: /plan|pre.?approv/i },
  { id: 'M5', role: 'manager', title: 'maintain next month team roster', nav: ['My Team', '/my/team'], need: /roster|shift/i, control: /roster/i },
  { id: 'M6', role: 'manager', title: 'monthly team attendance attestation', nav: ['My Team', '/my/team'], need: /attest|sign|approve month|month grid/i },
  { id: 'M7', role: 'manager', title: 'team muster grid and Excel export', nav: ['My Team', '/my/team'], need: /team/i, control: /export|excel|download/i },
  { id: 'M8', role: 'manager', title: 'absence/late/UAB alerts for reports', nav: ['My Team', '/my/team'], need: /absent|UAB|late/i },
  { id: 'M9', role: 'manager', title: 'probation review form', nav: ['Probation', '/lifecycle/probation'], need: /probation/i },
  { id: 'M11', role: 'manager', title: 'delegate approvals for a date range', nav: ['Approvals', '/approvals'], need: /delegat/i, control: /delegat/i },
  { id: 'M12', role: 'manager', title: 'raise a manpower requisition', nav: ['Recruitment', '/recruitment'], need: /requisition/i, control: /requisition|new/i },
  // Senior manager
  { id: 'S2', role: 'senior_manager', title: 'escalated items marked in inbox', nav: ['Approvals', '/approvals'], need: /approv/i },
  { id: 'S3', role: 'senior_manager', title: 'UAB alerts up the hierarchy', nav: ['My Team', '/my/team'], need: /absent|UAB/i },
  // HOD
  { id: 'H1', role: 'super_admin', title: 'assign HOD per department', nav: ['Users & Roles', '/admin/users'], need: /HOD|head of department|department head/i },
  { id: 'H3', role: 'hod', title: 'department muster/attendance/leave/OT reports', nav: ['Reports', '/reports'], need: /department/i },
  { id: 'H4', role: 'hod', title: 'department dashboard', nav: ['Home', '/'], need: /department/i },
  // HR Ops
  { id: 'O1', role: 'hr_ops_rml', title: 'HR dashboard counts', nav: ['Home', '/'], need: /joiner|exit|probation|absence/i },
  { id: 'O2', role: 'hr_ops_rml', title: 'search people and export directory', nav: ['People', '/people'], need: /RML/, control: /export|excel|download/i },
  { id: 'O3', role: 'hr_ops_rml', title: 'create/edit employee master', nav: ['People', '/people'], need: /people|employee/i, control: /add employee|new employee|create employee/i },
  { id: 'O4', role: 'hr_ops_rml', title: 'bulk import employees from Excel', nav: ['Data imports', '/admin/imports'], need: /employee/i, control: /upload|import/i },
  { id: 'O5', role: 'hr_ops_rml', title: 'shifts, schemes, holidays', nav: ['Masters', '/admin/masters'], need: /shift|holiday/i },
  { id: 'O6', role: 'hr_ops_rml', title: 'resolve unmatched swipes', nav: ['Exceptions', '/attendance/exceptions'], need: /unmatched|quarantin|swipe|exception/i },
  { id: 'O7', role: 'hr_ops_rml', title: 'manual attendance correction', nav: ['Attendance', '/attendance'], need: /attendance/i, control: /correct|edit|override/i },
  { id: 'O8', role: 'hr_ops_rml', title: 'recompute attendance for a range', nav: ['Attendance', '/attendance'], need: /attendance/i, control: /recompute/i },
  { id: 'O9', role: 'hr_ops_rml', title: 'month-lock checklist and lock', nav: ['Month lock', '/attendance/month-lock'], need: /checklist|lock/i, control: /lock|run checklist/i },
  { id: 'O10', role: 'hr_ops_rml', title: 'absence cases → show-cause', nav: ['Absence cases', '/attendance/absence-cases'], need: /absence|show.?cause/i },
  { id: 'O11', role: 'hr_ops_rml', title: 'muster 26th–25th with Excel export', nav: ['Muster', '/attendance/muster'], need: /muster/i, open: /^rebuild & view$/i, control: /export|excel|download/i },
  { id: 'O12', role: 'hr_ops_rml', title: 'leave types, accrual, adjustments', nav: ['Leave', '/leave'], need: /accrual|adjust|leave type/i, control: /adjust|accrual|run/i },
  { id: 'O14', role: 'hr_ops_rml', title: 'onboarding board and prejoin link', nav: ['Onboarding', '/lifecycle/onboarding'], need: /onboard|candidate/i },
  { id: 'O15', role: 'hr_ops_rml', title: 'onboarding task follow-up', nav: ['Onboarding', '/lifecycle/onboarding'], need: /task/i },
  { id: 'O16', role: 'hr_ops_rml', title: 'daily boarding/exit report', nav: ['Reports', '/reports/r24-boarding'], need: /boarding|joiner|exit/i, control: /export|excel|download|send/i },
  { id: 'O17', role: 'hr_ops_rml', title: 'probation board', nav: ['Probation', '/lifecycle/probation'], need: /probation/i },
  { id: 'O18', role: 'hr_ops_rml', title: 'transfers with future effective date', nav: ['Transfers', '/lifecycle/transfers'], need: /transfer/i, control: /new transfer|initiate|transfer/i },
  { id: 'O19', role: 'hr_ops_rml', title: 'separations and clearances', nav: ['Separation', '/lifecycle/separation'], need: /clearance|separation|resign/i },
  { id: 'O20', role: 'hr_ops_rml', title: 'letters templates and issue', nav: ['Letters', '/letters'], need: /template|letter/i, control: /issue letter/i },
  { id: 'O21', role: 'hr_ops_rml', title: 'policies publish + acknowledgement report', nav: ['Policies', '/policies'], need: /acknowledg|policy/i, control: /publish|new policy|create/i },
  { id: 'O22', role: 'hr_ops_rml', title: 'helpdesk queue', nav: ['Helpdesk', '/helpdesk'], need: /ticket|queue/i },
  { id: 'O23', role: 'hr_ops_rml', title: 'assets register/assign/return', nav: ['Assets', '/assets'], need: /asset/i, control: /add asset|register|new asset/i },
  { id: 'O24', role: 'hr_ops_rml', title: 'reports with Excel export', nav: ['Reports', '/reports/r27-headcount'], need: /headcount/i, control: /export|excel|download/i },
  { id: 'O25', role: 'hr_ops_rml', title: 'routing-hold queue', nav: ['Approval chains', '/admin/workflows'], need: /routing|hold|retry/i },
  { id: 'O26', role: 'hr_ops_rml', title: 'create offer/LOI draft', nav: ['Recruitment', '/recruitment'], need: /offer|LOI/i, control: /new offer|create offer|offer/i },
  { id: 'O-RGH', role: 'hr_ops_rgh', title: 'RGH HR Ops sees only RGH people', nav: ['People', '/people'], need: /RGH/ },
  // HR Head
  { id: 'HH1', role: 'hr_head', title: 'group-wide people (RML + RGH)', nav: ['People', '/people'], need: /RML[\s\S]*RGH|RGH[\s\S]*RML|Rashmi Green|company/i },
  { id: 'HH4', role: 'hr_head', title: 'configure workflows (steps, SLA)', nav: ['Approval chains', '/admin/workflows'], need: /SLA|step/i, control: /edit|save|configure/i },
  { id: 'HH5', role: 'hr_head', title: 'access-control matrix export', nav: ['Users & Roles', '/admin/users'], need: /role|permission/i, control: /export|matrix|download/i },
  { id: 'HH6', role: 'hr_head', title: 'audit log and chain verification', nav: ['Audit log', '/admin/audit'], need: /audit/i, control: /verify/i },
  { id: 'HH8', role: 'hr_head', title: 'executive dashboards', nav: ['Executive', '/executive'], need: /headcount|attrition/i },
  { id: 'HH9', role: 'hr_head', title: 'org masters and entity statutory IDs', nav: ['Masters', '/admin/masters'], need: /compan|entity|department/i },
  // Payroll
  { id: 'P1', role: 'payroll_admin', title: 'components/structures + G1 sample preview', nav: ['Payroll', '/payroll/structures'], need: /structure|component/i, control: /preview|create structure/i },
  { id: 'P2', role: 'payroll_admin', title: 'salary assignment and revisions', nav: ['Payroll', '/payroll/revisions'], need: /revision|CTC|salary/i },
  { id: 'P3', role: 'payroll_admin', title: 'probation % salary', nav: ['Payroll', '/payroll/structures'], need: /probation/i },
  { id: 'P6', role: 'payroll_admin', title: 'holds, LOP reversal', nav: ['Payroll', '/payroll'], need: /hold|LOP/i, open: /June 2026 RML/ },
  { id: 'P10', role: 'payroll_admin', title: 'Form 24Q / Form 16 / challans', nav: ['Payroll', '/payroll'], need: /24Q|Form 16|challan/i },
  { id: 'P11', role: 'payroll_admin', title: 'verify investment declarations', nav: ['Payroll', '/payroll'], need: /declaration|proof/i },
  { id: 'P12', role: 'payroll_admin', title: 'loans, legacy import', nav: ['Loans', '/loans'], need: /loan/i, tab: /company loans/i, control: /import|upload|legacy/i },
  { id: 'P13', role: 'payroll_admin', title: 'off-cycle run', nav: ['Payroll', '/payroll'], need: /new run/i, open: /^New run$/, control: /off.?cycle|run type|supplementary/i },
  { id: 'P14', role: 'payroll_admin', title: 'F&F compute', nav: ['Separation', '/lifecycle/separation'], need: /F&F|full (and|&) final|settlement/i },
  { id: 'P15', role: 'payroll_admin', title: 'bonus true-up / increment batch', nav: ['Payroll', '/payroll/revisions'], need: /increment|bonus|revision/i, control: /upload|import|batch/i },
  { id: 'P17', role: 'payroll_admin', title: 'claims payout batch', nav: ['Claims', '/claims'], need: /claim/i },
  { id: 'P18', role: 'payroll_admin', title: 'parallel-run register import', nav: ['Payroll', '/payroll/parallel-run'], need: /parallel|register|variance/i, control: /upload|import/i },
  // Plant head
  { id: 'PH1', role: 'plant_head', title: 'boarding & exit report for own plant', nav: ['Reports', '/reports/r24-boarding'], need: /boarding|joiner|exit/i },
  { id: 'PH2', role: 'plant_head', title: 'BU dashboard + attendance reports (read-only)', nav: ['Home', '/'], need: /attendance|headcount|present/i },
  { id: 'PH3', role: 'plant_head', title: 'approve offers for own plant', nav: ['Approvals', '/approvals'], need: /offer|LOI/i },
  { id: 'PH4', role: 'plant_head', title: 'plant muster and absentee pivot', nav: ['Muster', '/attendance/muster'], need: /muster|cost cent/i },
  // CEO cell
  { id: 'C1', role: 'ceo_cell', title: 'CEO dashboard KPIs', nav: ['Executive', '/executive'], need: /headcount|attrition|KPI/i },
  { id: 'C2', role: 'ceo_cell', title: 'group boarding/exit report', nav: ['Reports', '/reports/r24-boarding'], need: /boarding|joiner|exit/i },
  { id: 'C3', role: 'ceo_cell', title: 'final offer approval step', nav: ['Approvals', '/approvals'], need: /offer|LOI/i },
  { id: 'C4', role: 'ceo_cell', title: 'group headcount/attrition, no salary column', nav: ['Reports', '/reports/r26-attrition'], need: /attrition|leaver/i },
  // IT admin
  { id: 'I2', role: 'it_admin', title: 'device health', nav: ['Devices', '/attendance/devices'], need: /device|sync|online|offline/i },
  { id: 'I3', role: 'it_admin', title: 'Kent sync trigger (fails closed)', nav: ['Devices', '/attendance/devices'], need: /sync/i, control: /sync/i },
  { id: 'I4', role: 'it_admin', title: 'onboarding IT tasks', nav: ['Onboarding', '/lifecycle/onboarding'], need: /task|IT/i },
  { id: 'I5', role: 'it_admin', title: 'exit clearance IT items', nav: ['Separation', '/lifecycle/separation'], need: /clearance/i },
  { id: 'I6', role: 'it_admin', title: 'settings and SMTP', nav: ['Settings', '/admin/settings'], need: /SMTP|mail|email/i },
  { id: 'I7', role: 'it_admin', title: 'backup/restore drill evidence', nav: ['Settings', '/admin/settings'], need: /backup|restore/i },
  // Super admin
  { id: 'SA1', role: 'super_admin', title: 'roles/permissions grid, workflows, settings', nav: ['Users & Roles', '/admin/users'], need: /role/i, control: /add role|grant |assign/i },
  { id: 'SA3', role: 'super_admin', title: 'audit verification and export', nav: ['Audit log', '/admin/audit'], need: /audit/i, control: /verify|export|download/i },
];

for (const t of TASKS) {
  test(task(PERSONAS[t.role].role, t.id, t.title), async ({ as, ux, diag }) => {
    ux.start(t.title);
    const s = await as(t.role);
    await s.nav(t.nav[0], t.nav[1]);
    if (new URL(s.page.url()).pathname !== t.nav[1]) {
      // Landed on the section root: look for an in-page link to the sub-screen, else type the URL.
      const link = s.page.locator(`main a[href="${t.nav[1]}"]`).or(s.page.locator(`nav a[href="${t.nav[1]}"]`));
      let clicked = false;
      if (await link.first().isVisible().catch(() => false)) {
        clicked = await s.click(link.first(), { timeout: 4000 }).then(() => true, () => false);
        if (clicked) ux.discover('in-page');
      }
      if (!clicked || new URL(s.page.url()).pathname !== t.nav[1]) { await s.goto(t.nav[1]); ux.discover('url'); }
    }
    await s.page.waitForLoadState('networkidle').catch(() => {});
    expect(new URL(s.page.url()).pathname, `${t.id}: ${t.nav[1]} must not redirect away`).toBe(t.nav[1]);
    const main = s.main();
    await expect(main).not.toContainText(DENIED, { timeout: 3000 });
    if (t.tab) await s.click(main.getByRole('tab', { name: t.tab }));
    await expect(main, `${t.id}: screen ${t.nav[1]} must show ${t.need}`).toContainText(t.need, { timeout: 6000 });
    if (t.open) await s.click(main.getByRole('button', { name: t.open }).first());
    if (t.control && t.open && await s.page.getByRole('dialog').last().isVisible().catch(() => false)) {
      const dlg = s.page.getByRole('dialog').last();
      if (t.expand) await s.click(dlg.getByRole('combobox', { name: t.expand }));
      const c = dlg.getByRole('button', { name: t.control }).or(dlg.getByRole('radio', { name: t.control })).or(dlg.getByRole('option', { name: t.control })).or(dlg.getByText(t.control));
      await expect(c.first(), `${t.id}: the dialog must offer ${t.control}`).toBeVisible({ timeout: 3000 });
    } else if (t.control) {
      if (t.open) await s.page.waitForLoadState('networkidle').catch(() => {});
      const c = main.getByRole('button', { name: t.control }).or(main.getByRole('link', { name: t.control })).or(main.getByRole('tab', { name: t.control })).or(main.getByRole('checkbox', { name: t.control }));
      await expect(c.first(), `${t.id}: a control matching ${t.control} must be offered`).toBeVisible({ timeout: 3000 });
    }
    expect(diag.filter((d) => d.kind === 'http' && /\b5\d\d\b/.test(d.text)).map((d) => d.text), 'no 5xx while loading').toEqual([]);
  });
}
