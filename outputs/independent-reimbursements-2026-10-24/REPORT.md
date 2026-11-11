# Independent reimbursement payments — 24 October 2026

Phase1 Stage1.8 continuation · CLM-04, CORE-10/11, PAY-03/08.

## Sponsor correction and resulting behavior

Salary and reimbursements are paid separately and have independent operational scopes. This correction supersedes the combined-payment portion of Pack43 and the original CLM-04 regular-payroll alternative. Workflow routing, real receipt ownership and separately delegated verification from Pack43 remain applicable.

Approved expense claims reserve their own company-specific reimbursement batch and exact approved-amount snapshots. Bank preparation stores a distinct reimbursement CSV document. Transfer confirmation requires that artifact, a bank reference and unchanged approved claims. It changes reimbursement claims and batches only. Salary computation, salary inputs, salary bank records and salary mark-paid do not take part in the new reimbursement path.

`claims.payout.view`, `claims.payout.manage` and `claims.payout.confirm` default to Super Admin only. Travel advance disbursement and claim settlement also use reimbursement-manage permission, with employee scope enforced inside the transaction; travel administrative reading no longer derives from salary processing. Each permission has its own runtime data scope; Super Admin can delegate an expense operator without salary authority, or a salary operator without reimbursement authority. Mutations check their specific permission's employee population. The UI offers `/claims/payments`, with no salary-run selector. Legacy combined-routing writes refuse with409; salary-only principals receive403. Existing historical destination/provenance fields are retained for reconciliation, not silently migrated or repaid.

A nullable-org-unit filter bug discovered during verification was corrected: a batch is hidden if any employee fails the positive reimbursement scope predicate. Selected claim totals and accepted amounts are checked again before bank preparation and paid confirmation.

## Verification

The native rollback fixture follows ₹200 claimed → ₹100 accepted → independent ₹100 reimbursement bank export → simulated transfer confirmation. It proves no salary input and no salary run are created, payroll-only access is denied, an independent scoped operator works, missing-bank and duplicate payment attempts fail, out-of-scope batches are hidden/refused, travel finance endpoints reject salary-only and out-of-scope principals, prepared item edits and reference-free paid transitions fail at the DB, and changed approval amounts block bank preparation. The independent HH3 salary fixture still verifies ₹59,124 through finalization, payslip, salary bank file, simulated paid and own-employee access.

Frontend regressions verify separate route/navigation authorization, read-only reimbursement controls, batch selection and transfer-reference submission without any salary API call. A failing account-switch regression reproduced stale reimbursement data remaining visible; keying the stateful console to the authenticated user clears that data and cancels prior loads. Full backend verification passed:154 files,1,115 tests;87.03% line/statement,80.91% branch and91.47% function coverage. Full frontend verification passed:65 files,405 tests. Type checks, lint, unused-code checks, dependency rules, tests and production builds passed; git diff check is clean. Machine-readable results and log locations are in verification.json.

All native database work uses loopback clone `hrms_roleflow_test_20261023`; migration1753000001600 was applied there only. Its strengthened trigger definitions and non-null transfer-reference constraint were refreshed on that clone before final verification; no production migration was applied. Synthetic transfer references do not submit bank transactions. No deployment, main-database migration, bank transfer or release acceptance occurred.

## Remaining scope and review

The full original38 issue groups are not all closed. Dedicated reimbursement statements/PDFs, draft-batch cancellation controls, the T&E settlement-to-bank-payment bridge, historical combined-payment reconciliation, bank-specific format acceptance and original browser/UAT journeys remain open. Advance-linked claims are refused until settled through the existing travel-wallet flow; this increment does not infer or mutate an advance balance. Legacy year-end substantiation aggregation and entitlement-policy fallback findings remain tracked in Pack43. Other previously documented open payroll/ESS/HR features retain their dispositions.

Human review before deployment remains required by CLAUDE.md for payroll-core changes. Earlier payroll-core changes in this working tree remain subject to it; no phase/release gate is advanced.
