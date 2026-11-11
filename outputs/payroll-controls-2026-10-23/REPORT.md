# Pack42 — payroll controls and stakeholder onboarding

23 October 2026 · Phase1 Stage1.8 reported role-flow repair · PAY-08/13, LC-02, CORE-10/11.

This is a verified repair increment under the repository's one-stage-at-a-time rule. The complete 38-group task remains open; this report does not close missing features by relabeling them or by changing a permission alone.

## Implemented

- **P6 salary holds:** `/payroll/holds` provides scoped e-code lookup, payment/process hold placement, history and release month. Payroll navigation and the run console link to it. Read access and operational write access remain separate. Start/release months are real month starts; release is the first unheld month. Duplicate overlapping holds and reverse release dates are refused. Employee locks serialize overlapping edits, and affected run locks serialize hold changes with computation. Computed/reviewed/approved/finalized/paid periods cannot change here: open runs must return to draft; settled payroll needs an authorized correction. Creation/release and their audit records commit together.
- **P11 investment proof verification:** `/payroll/declarations` provides a paged, employee-scoped FY/e-code queue, audited proof download, partial verification and explicit zero acceptance. Verification uses exact integer paise, cannot exceed declared amount, and requires an active tax-proof document belonging to the employee for a positive acceptance. Already verified declarations cannot be overwritten through the older administration endpoint. The ESS declaration writer and verifier now coordinate through the same employee lock, preventing a stale edit from undoing verification. Payroll processing grants authorize operations; policy configuration remains with Super Admin/delegates.
- **P10 discovery:** the run console directly links to existing TDS compliance / Form16 / challan controls, alongside holds and investment proofs.
- **I4 IT onboarding:** `/lifecycle/tasks` uses dedicated `/api/lifecycle/my-tasks` APIs. New runtime permission `lifecycle.onboard.tasks` is granted to IT and Super Admin by the forward migration; row ownership is additionally limited to the caller's current stakeholder roles and permitted employee population. IT can complete IT tasks and cannot list candidates or complete HR tasks. No employee-conversion/salary permission is granted. Kent enrollment remains explicitly unavailable without the real authorized enrollment adapter; a normal task cannot fabricate enrollment. Native API regression confirms 503 and an unchanged open biometric task.
- **HH3 correction:** sponsor confirmed that the original observation was test data. No original/live June run identifier remains requested. Pack41's native missing-salary → corrected salary → full population finalize → payslip → paid → own ₹59,124 result is the test-data regression evidence.

## Reproduced security/integrity defects

Before these repairs, native HTTP regressions returned 200 for foreign-employee hold writes/declaration reads, mid-month hold starts and excessive/unsubstantiated verification. These are now refused with 403, 400 or 409 according to authorization, validation or state. Foreign holds are excluded from lists; current-token task ownership remains enforced server-side.

## Verification

- Backend full `npm run verify`: **153 files /1,108 tests**, no skips. Typecheck, lint, knip, dependency-cruiser, coverage and build passed. Coverage: **86.77% lines/statements,81.11% branches,91.31% functions**.
- Frontend full `npm run verify`: **63 files /401 tests**, typecheck, lint, knip, tests and production build passed.
- Focused native payroll controls and existing TDS compliance:10 tests passed; the additional biometric refusal assertions passed in the six-case payroll-control suite.
- Frontend controls tests cover exact paise, over-declaration refusal, reader-only controls, scoped employee selection, explicit hold payloads and the separate IT endpoint.
- React review applied to request cancellation, duplicate submission guards, loading/error feedback, permission-driven actions and labeled existing Warm Editorial primitives. No new component library.
- Only the existing explicit loopback test clone `hrms_roleflow_test_20261023` received migration1300; main `.env`, real payroll, payouts, employee data and KENT devices were unchanged. Financial fixtures roll back.

Verification does not certify full browser paint/contrast, a production SMTP delivery, a PITR restore or original UAT timeouts.

## Still open across the full request

LOP reversal/retro editing needs an approved correction contract and persistence/ledger flow, not a write to frozen attendance. Dedicated off-cycle payroll, geo punch, OT planning/preapproval, manpower requisitions, SMTP configuration/delivery and backup/restore controls/evidence remain unimplemented in this increment. Browser replay still remains for the older calendar/apply/prejoin/claim/offer observations and full accessibility/role navigation. Existing statutory acceptance limits from Pack40 remain. These require subsequent stages; no release/phase acceptance gate is advanced.

Human review of the payroll-core diff remains mandatory before deployment under CLAUDE.md §3. Nothing was deployed.
