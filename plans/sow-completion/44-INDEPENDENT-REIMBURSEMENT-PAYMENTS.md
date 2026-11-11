# Pack44 — Independent reimbursement payments

Phase1 Stage1.8 ·24 October2026 · CLM-04, CORE-10/11, PAY-03/08.

- [x] Apply the sponsor correction: salary and reimbursements have separate payments and populations.
- [x] Refuse legacy combined routing; remove its salary-selector UI and salary-paid claim propagation.
- [x] Add independent reimbursement batch/item snapshots, stored bank artifact, audited transfer confirmation and duplicate/reservation guards.
- [x] Add view/manage/confirm permissions, Super Admin defaults and independent runtime scope enforcement.
- [x] Separate travel advance/settlement authority from salary and enforce its delegated population inside transactions.
- [x] Add reimbursement console and independent navigation/route/control gating.
- [x] Verify exact ₹100 independent payout, no salary run/input, scope denial including NULL org unit and approval-amount drift refusal; preserve ₹59,124 salary regression.
- [x] Full backend verify:154 files/1,115 tests,87.03% lines,80.91% branches,91.47% functions; full frontend verify:65 files/405 tests. All pipeline checks/builds pass; git diff check clean.
- [ ] Reimbursement statements/PDFs, draft cancellation controls, T&E settlement-to-bank-payment bridge, historical combined-payment reconciliation, bank-format acceptance and original browser/UAT replay.
- [ ] Remaining original38-group features and required payroll-core human review; no acceptance gate advanced.

[Evidence and limits](../../outputs/independent-reimbursements-2026-10-24/REPORT.md).
