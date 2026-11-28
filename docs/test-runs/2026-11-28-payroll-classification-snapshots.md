# Payroll classification snapshots and visual refinement — 28 November 2026

## Slice and authority

The user approved exactly three fields on PayrollRunLine: kind, statutoryRole and stateCode. This slice captures
those fields on calculation and uses them when classifying saved results. Statutory totals/deposits and the exit
workflow remain subsequent slices; no deposit model, due-date rule or real payment was created.

During implementation the user rejected the flat appearance and requested the local Crextio reference's visual
quality. Payroll overview/run detail were refined within the existing Warm Editorial palette and component system.
Reference images inspected: crextio-02, crextio-010, crextio-011, crextio-021 and crextio-023; no reference assets reused.

## Data and migration

- Branch hrms-new; initially clean at d77ee0d. Independent account/config/master-control work appeared later in the
  shared checkout and was preserved. One missing accountId in the concurrent login-toMe assembly was filled from the
  authenticated account to fix its type error; no authentication policy was changed by this payroll slice.
- Local app target verified as localhost / hrms_new. `npm run db:migrate -- --name payroll_line_classifications`
  generated/applied 20261128044054_payroll_line_classifications and regenerated Prisma. Five already committed,
  previously pending payroll migrations (stage3 amounts through stage6 payments) were also applied by that command.
- Migration adds three nullable columns only, with no default classification or data backfill. Null kind identifies
  pre-snapshot results. A normal non-statutory new line has a kind and a null statutoryRole.
- Calculation uses the same component classifications and end-of-period location State as deductions, including
  typed inputs and earnings retained for held people. New payments/registers/payslip renders use saved kinds.
- Unverified runs retain a readable header, explanatory notice, null classified totals and draft recovery controls.
  Draft recalculation captures the fields. Final runs remain unchanged; reviewed historical reconciliation is still
  needed. New classified outputs refuse unknown history. Stored PDF downloads/existing payment snapshots still work.
- TDS history uses saved kind/role, but taxable flags remain current; PF-wage flags, labels and establishment codes are
  not snapshotted by these three approved fields. These limits are recorded in BACKLOG.md and the rules/setup docs.

## Automated evidence

- Focused payroll deduction/payment/payslip regressions: 3 files / 19 tests passed.
- Full backend run: 70 files / 401 tests passed (331.54 seconds during concurrent local work).
- Follow-up payroll + login run: 4 files / 21 tests passed, including the small login assembly fix.
- Added regressions cover capture of earning/deduction/employer classifications and State; held earnings/typed TDS;
  changed component kinds, removed statutory roles and changed State masters; unknown legacy rows, scoped refusal,
  draft recalculation, immutable final runs, new payment refusal and continued access to stored payslips.
- Typecheck, frontend lint, build, API tracker and data-access checks were run. Early setup/parallel-work failures
  (stale app migrations, missing login accountId and missing concurrent Master Control API entries) were resolved.
  Frontend lint retains the existing HodDialogs.tsx Fast Refresh warning; build retains the large-chunk warning.
- API scopes remain whole-company Payroll / Payroll payments, with Salary View for salary figures. The payment creator
  now rejects another company's picked person before reading their classification state or net amount.

## Browser path and visual review

Local development API/frontend only; no worker was started for this run. Used the existing development Super Admin
login. Synthetic app records under **Payroll Snapshot QA TCXLRF601**, employee **Snapshot Example**, supported browser
checks: run 2 final/unverified, run 3 draft/unverified, run 4 final/captured. They are deliberately made-up UI fixtures,
not calculation or compliance acceptance evidence; the automated tests exercise actual computation separately.

1. Baseline desktop/phone payroll and run screenshots showed equal-weight metric boxes and dispersed instructions.
   The local database initially lacked five payroll migrations, causing errors before migration; these were resolved.
2. Final/unverified run: the notice appears once, classified amounts are unavailable, new register/release controls
   are absent and the header remains readable. Draft/unverified: refresh remains available; Work out pay follows the
   existing attendance lock requirement and sending remains blocked.
3. Captured run: displayed the synthetic saved INR 28,000 gross/net. Salary register downloaded through the browser as
   salary-register-TCXLRF601-2026-11.xlsx. No payslip release or money transfer was performed.
4. Reviewed at requested desktop 1440 and phone 390 widths. One intermediate phone header clipped Payroll behind its
   actions; fixed by wrapping actions onto their own row. One intermediate warning repeated in the People section;
   fixed by presenting one notice with unavailable breakdown hidden.
5. Refined run page: unboxed People/Inputs/To check numbers, one pay summary, charcoal preparation steps, meaningful
   warnings and expandable Run details. Progress navigation opened Checks; Run details expanded the exact timestamps
   and calculation notes. Salary gating remains driven by the API.
6. Refined overview: open month/headcount/period layout, one charcoal status panel, a scoped segmented Final / In
   approval / Draft strip, company marks, round navigation and a gold primary creation action. Counts explicitly mean
   the latest month within the returned page; no group-wide totals or invented percentages.
7. Loaded/loading screenshots were inspected at both widths. Skeletons preserve real labels, columns and the new
   summary/progress structures. No extra page queries or new loading waterfall were added.
8. Phone run geometry measured innerWidth/clientWidth/scrollWidth = 390/390/390. Browser viewport overrides were reset.
   Concurrent browser activity briefly interfered with one overview size capture; captures were repeated.

UI critic outcome: the repeated-card hierarchy and mobile title clipping were fixed. The changed notices and labels
are readable, the run's next stages are visible, and controls keep their existing behavior. This is a scoped payroll
refinement; whole-app visual parity with the Crextio reference and user taste acceptance are not claimed.

## Still open

Statutory totals by registration/State/period, deposit/challan records and deadlines need the next agreed model/process.
Historical classification reconciliation, other frozen facts and external bank/SAP/statutory upload formats remain
in BACKLOG.md. This local evidence does not establish real statutory rates, Finance acceptance, UAT or deployment.
