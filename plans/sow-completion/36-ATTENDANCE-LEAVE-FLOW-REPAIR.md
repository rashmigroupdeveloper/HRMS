# Phase 1, Stage 1.8 — attendance / leave flow repair

21 Oct 2026. Follow-up to [35 — task QA](35-ATTENDANCE-HOLIDAY-PAYROLL-QA.md). Requirement anchors: ATT-05/06/07/12/15, LV-01..09, WF-01, CORE-06/10/11 and PAY-04/05.

- [x] Repair all six reported flow findings: account-owned drafts, honest cross-month guidance, attendance coverage counts, payroll attendance lock prerequisite/recovery, early locked-cancellation guard and consolidated leadership requests with payroll retry feedback.
- [x] Provide audited leave configuration with global/scoped capability checks and validated policy values; retain inactive history and prohibit retroactive paid/unpaid changes to used types.
- [x] Align type eligibility, preview/submission/final-approval validation, overlap checks, balance register arithmetic, and safe job authority/date guards.
- [x] Serialize RH/encashment reservations and make balance adjustments atomic with audit.
- [x] Fix bank generation/finalization timestamp handling and use the actual bank generator in lifecycle verification.
- [x] Verify browser account transition and synthetic policy save/deactivation; disable all fresh browser fixtures afterward.
- [x] Frontend complete verification: 384 tests, typecheck/lint/knip/build passed.
- [x] Native focused verification: 91 tests passed across nine safe suites; golden/payable/lifecycle cases included. Separate legacy null-attendance-lock recovery assertion recorded in the lifecycle log.
- [x] Backend typecheck/lint/knip/dependency/build checks passed; full verification run attempted and its remaining failures recorded.
- [ ] Full backend verification / coverage gate. Existing onboarding/probation mock failures and general coverage floor remain open; no phase acceptance or release gate advanced.
- [ ] Required human review of the payroll-core diff (`CLAUDE.md` §3).

Detailed changes, logs, browser screenshots and shared-local-test side-effect cleanup are in [repair evidence](../../outputs/attendance-leave-repair-2026-10-21/REPORT.md). The broad test run exposed unsafe `.env` authorization of shared-database jobs; default test setup now requires explicit integration target declarations, and the time-bounded accrual effects were neutralized by audited compensating ledger entries.

Changes remain local/uncommitted. Preserve unrelated user changes. No deployment or bank transfer was performed.
