# Pack43 — claims workflow and payroll provenance

> **Superseded payment model:** the sponsor subsequently clarified24 Oct2026 that salary and reimbursement payments and scopes are independent. Combined salary-reservation/payment evidence below is historical, not current intended behavior. Pack44 replaces it with independent reimbursement batches; workflow/receipt repairs remain applicable.

24 October2026 · Phase1 Stage1.8 role-flow repair · M13, CLM-02/03/04/07, PAY-03/04/08, CORE-10/11, WF-01/04.

## Reproduced causes

The reimbursement HTTP submit path wrote a pending claim with NULL `workflow_request_id`. It never created an approval request, so no manager inbox item or notification receipt could exist. The old decision endpoint accepted any holder of `claims.approve`, without checking current chain assignment, and could immediately mark the whole claim approved. Pending lists and year-end reads lacked employee scoping. The old off-cycle path could accept an arbitrary bank batch ID and mark a claim paid without a reimbursement artifact. Regular-run routing also lacked company/state checks and recorded paid before the actual payroll payment.

Native HTTP regressions reproduced missing workflow linkage, out-of-assignment decisions and insufficient receipt validation before repair. Existing mocks expecting arbitrary off-cycle IDs to establish payment were corrected to refuse that behavior.

## Implemented

- Submit creates the claim and its **currently configured** `claim` approval request atomically, before routing. The existing workflow engine resolves actual recipients, vacancy holds, notifications and successive approval steps. No hardcoded approver replaces configuration; Super Admin and delegates retain chain administration.
- Real PDF/JPEG/PNG receipt uploads replace the UI's fixed document ID1. Each submitted bill needs an active employee-owned receipt; duplicate receipt IDs inside one claim are refused. Real calendar dates, exact paise and ordered periods are validated. Bill amounts sum in integer paise. Concurrent uploads preserve the latest file selection and submission waits for every receipt.
- Employee and scoped reviewer receipt downloads return stored bytes and record an audit. Out-of-scope claims and documents remain refused.
- Decision details require the **current workflow assignee** in the permitted population. The manager's first approval advances the chain while the claim remains pending. Only a final workflow decision updates final domain status. Partial amounts cannot increase beyond the claim or an earlier partial approval. Required substantiation covers the accepted amount; a discarded bill does not prevent an otherwise substantiated partial acceptance.
- Receipt verification is separate `claims.verify` authority, defaulting to scoped HR Ops and HR Head/Super Admin. A manager's business approval does not silently acquire bill-verification power. Super Admin can delegate the permission through the existing matrix. Verification changes and accepted amounts are audited.
- Payroll routing checks approved workflow evidence, employee scope, same company, a draft/reopened regular run, and duplicate reservation under locks. A nullable unique `pay.inputs.claim_id` provides durable provenance. The input cannot be silently deleted from the generic input editor. The claim stays approved/routed until its payable run is marked paid with the bank file present; payment updates the claim and audit in the same transaction. Held employees are excluded from this paid propagation.
- Caller-supplied off-cycle batch IDs now fail explicitly in both the HTTP and domain path. The UI no longer fabricates batch ID1. A dedicated reimbursement artifact/workflow remains required and is not claimed implemented.
- Legacy travel-advance settlement through the old reimbursement endpoint is refused in favor of the existing travel wallet flow; no early decrement of an unrelated employee's loan can escape through this route.

## Exact-value native evidence

Two receipts total **₹123.45 + ₹76.55 = ₹200**. The manager receives the real workflow item and notification receipt, cannot verify receipts without `claims.verify`, and cannot approve beyond ₹200. RM approval leaves the claim pending. The configured checker substantiates the first receipt and accepts **₹100**, preserving the remaining chain contract and immutable final decision.

The approved ₹100 reserves one linked input in the correct run. Duplicate routing and deletion are refused. In the synthetic payroll cohort, **₹1,000 salary + ₹100 reimbursement = ₹1,100 net** (PF/ESIC disabled and tax/PT nil in this fixture). Compute, review, independent approval and finalization complete. The claim remains routed through finalization; the generated bank file has one transfer. Simulated mark-paid changes the run and claim to paid. No real payment occurred. The independent Pack41 HH3 ₹59,124 recovery remains passing.

The regression also uploads actual synthetic receipt bytes, downloads the identical bytes through employee and manager APIs, and checks two read audits. A separate unrelated claimant stays outside the manager's list, decision and receipt scope.

## Verification

Full backend `npm run verify` passed: **154 files /1,115 tests, no skips**, with typecheck, lint, knip, dependency-cruiser, coverage and build. Coverage: **86.94% lines/statements,81.02% branches,91.42% functions**. Full frontend `npm run verify` passed: **64 files /402 tests**, including typecheck, lint, knip, tests and production build. `git diff --check` passed. [Machine-readable verification](verification.json) records the evidence. New migrations1400/1500 were applied only to the existing explicit loopback clone `hrms_roleflow_test_20261023`. Synthetic domain/API fixtures roll back. Generated synthetic storage artifacts use the existing local test storage adapter. Main database grants/configuration, actual employees, external mail, KENT devices and real transfers were unchanged.

One backend full-verification launch omitted the database override; it was stopped during lint, before any database tests began, then relaunched with the explicit clone override. This is not counted as a passing gate.

## Remaining limits

This increment does not declare all38 groups closed. Dedicated off-cycle payroll/reimbursement batches, durable LOP/retro correction UI, geo punch, OT pre-plans, manpower requisitions, SMTP/backup operational controls and original browser/a11y replay remain open. Existing legacy claims without chain evidence need deliberate routing/evidence reconciliation; no old approval or payment is fabricated. Moving/unrouting a reserved claim and historical held-claim release also need explicit reconciliation flows. The Pack40 statutory acceptance limits remain. Human payroll-core review is mandatory before deployment; no phase/release gate is advanced and nothing was deployed.

Additional source audit findings remain unclosed: the legacy year-end unsubstantiated-recovery query needs type/FY/accepted-amount isolation (its current loop aggregates unverified claims broadly), and baseline entitlement fallbacks still contain policy amounts in code. These were observed in source, not reproduced or changed in this increment. They are additional financial/configuration work before accepting the full requested chain; passing gates here do not certify those routines.
