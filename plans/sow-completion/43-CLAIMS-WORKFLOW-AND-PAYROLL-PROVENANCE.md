# Pack43 — Claims workflow and payroll provenance

> **Superseded payment model:** the sponsor subsequently clarified24 Oct2026 that salary and reimbursement payments and scopes are independent. Combined salary-reservation/payment evidence below is historical, not current intended behavior. Pack44 replaces it with independent reimbursement batches; workflow/receipt repairs remain applicable.

Phase1 Stage1.8 ·24 October2026 · M13, CLM-02/03/04/07, PAY-03/04/08, CORE-10/11, WF-01/04.

- [x] Reproduce a pending reimbursement with no workflow/inbox and out-of-assignment approval.
- [x] Create the domain row with its configured workflow; preserve notification receipts, holds and successive approval steps.
- [x] Replace sample receipt IDs with real employee-owned upload and audited download APIs/UI.
- [x] Validate exact paise, real dates, document ownership and scoped lists/decisions/year-end reads.
- [x] Separate delegated `claims.verify` receipt substantiation from ordinary manager business approval.
- [x] Apply partial/final decisions through the authoritative workflow and audit the details.
- [x] Refuse fake off-cycle bank IDs, wrong-company/frozen targets and unsafe legacy advance adjustments.
- [x] Reserve one durable linked payroll input; protect it from generic deletion; propagate paid only with the payable run and bank artifact.
- [x] Native exact-value chain:₹200 claimed,₹100 accepted,₹1,000 salary+₹100 claim→₹1,100 net, then final bank batch and simulated paid; preserve independent₹59,124 regression.
- [x] Full backend verify:154 files/1,115 tests,86.94% lines,81.02% branches,91.42% functions; full frontend verify:64 files/402 tests, all checks/builds green; git diff check clean.
- [ ] Remaining full-request features, legacy reconciliation and browser/operational acceptance listed in the report are still open.
- [ ] Mandatory human payroll-core review before deployment; no phase/release gate advanced.

[Evidence and limits](../../outputs/claims-workflow-integrity-2026-10-24/REPORT.md).

- [ ] Follow up source findings in legacy year-end unsubstantiated aggregation and hardcoded baseline entitlement fallback; neither is certified fixed by this increment.
