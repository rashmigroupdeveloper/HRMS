# Phase 1, Stage 1.8 — attendance, holiday, approval and payroll task QA

21 October 2026 · ATT-03/05/06/07/08/12/13/15, LV-03/05/08, WF-01/04, PAY-03/04/05/06/18, CORE-10/14.

- [x] Separate employee → manager → scoped HR Ops → payroll maker → HR-head checker browser sign-ins.
- [x] Synthetic first-half AR, paid leave and company holiday feed 29.5 locked payable days.
- [x] Exact calculation and reconciliation: ₹29,500 gross − ₹150 PT = ₹29,350 net; employee payslip agrees.
- [x] Review, checker approval, typed finalization, synthetic bank file and simulated paid transition.
- [x] Refusal paths: overlap, self-approval, out-of-scope holiday, premature compute, missing manager attestation, post-lock correction, unauthorized payroll read/co-sign, premature/missing-bank payment and paid-run recompute.
- [x] API send-back/edit/resubmit/approve and locked cancellation reproduction.
- [x] Six actionable runtime/UX finding groups with reproduction, source anchors and repair direction, including P1 cross-account draft disclosure.
- [x] 66 unintended global-suite accruals offset through immutable audited adjustments; 527 test notifications quarantined; five synthetic users disabled/roles detached/sessions revoked, employees exited. Four legacy pending requests had SLA re-notification side effects, explicitly retained in the report.
- [ ] Backend focused gate: 63/64 pass; legacy payroll lifecycle fixture conflicts with one-active-bank-batch constraint.
- [ ] Frontend gate: 365/375 pass; ten calendar display assertions fail in one file.
- [ ] F01–F06 repairs and current-checkout regression rerun.
- [ ] Live Kent/SMTP, complete responsive/accessibility sweep, Finance file acceptance and human payroll/UAT sign-off.

Evidence: [task-based QA report](../../outputs/attendance-flow-qa-2026-10-21/REPORT.md), [API sequence](../../outputs/attendance-flow-qa-2026-10-21/api-evidence.jsonl), [database states](../../outputs/attendance-flow-qa-2026-10-21/db-evidence.jsonl), [backend test log](../../outputs/attendance-flow-qa-2026-10-21/backend-focused.log), [frontend test log](../../outputs/attendance-flow-qa-2026-10-21/frontend-tests.log).

No application implementation changes, deployment or actual payout. No acceptance/phase gate advanced. Audit work complete; product acceptance remains open. Next repair must be its own announced stage.
