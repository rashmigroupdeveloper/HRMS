# Phase1 Stage1.8 — separate role/action flow and remaining SOW review

17 Oct2026 · ATT/CORE/WF/PAY/LC/RPT scope · **review complete, product acceptance not passed**.

- [x] Re-read governing specs and original workbook; all176 tracked original item texts match.
- [x] Separate49 cases for employee, manager, HR Ops, HR Head, payroll, LOI/onboarding and other HR actions.
- [x]19 native HTTP/PostgreSQL observations with full rollback; zero retained probe users.
- [x]17 source/native/carry-forward finding groups, each with owning stage, requirement IDs, source anchors and repair acceptance.
- [x] Fresh source parity499 files and catalog132 relations/1,381 columns; no application/migration changes.
- [x]529 backend and262 frontend tests pass; static checks and both builds pass. Raw logs retained.
- [ ] Backend verify80% coverage gate remains red (76.85% lines/statements,72.48% branches).
- [x] F02–F05 reproduced backend correction/read/scheme defects repaired with native regressions in [pack29](29-HR-ATTENDANCE-SAFETY-REPAIR.md). Direct UI, coverage and broader acceptance remain separate.
- [ ] F06/F14 completeness/close/report scope; F15 HR recovery screen; F01 real Kent integration — separate owning stages.
- [ ] F07–F09 payroll authority/source/console/output acceptance; required financial human review.
- [ ] F10–F13/F16 atomic scoped onboarding, stakeholder tasks, lifecycle and LOI/ATS contract/implementation.
- [ ] F17 other workplace/assets/analytics, runtime target parity and operational/manual-service/UAT duties.

Evidence: [review](../../outputs/role-flow-review-2026-10-17/REVIEW.md), [role cases](../../outputs/role-flow-review-2026-10-17/ROLE-CASES.md), [data/transaction/screen handoff](../../outputs/role-flow-review-2026-10-17/DATA-FLOWS.md), [all SOW rows](../../outputs/role-flow-review-2026-10-17/SOW-REMAINING.md), [verification](../../outputs/role-flow-review-2026-10-17/verification.json).

No full SOW row or phase gate promoted. Claims/budgets remain deferred; all prior scope, schema-purpose, money-review and acceptance obligations are preserved. Do not infer that the current code is production-ready from old checkboxes or these passing suites. Execute only one announced implementation stage next.
