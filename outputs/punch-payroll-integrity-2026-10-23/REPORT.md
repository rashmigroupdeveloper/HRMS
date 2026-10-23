# Punch → canteen → attendance → leave → final payroll review

23 Oct 2026 · Phase 1, Stage 1.8 · local synthetic PostgreSQL verification.

## Confirmed bugs repaired

| Finding | Reproduction / impact | Repair |
|---|---|---|
| Conflicting native punch directions | Native CSV returned both IN and OUT for the same employee/minute/device; immutable dedupe would keep only the first. | Reject conflicting directions across native CSV files before returning/archiving the batch. Preserve files for corrected source precision. |
| Locked evidence omitted at weekly close | A locked Monday in September did not qualify an open Sunday in October; Sunday became unpaid. | Count both locked and open weekly evidence, update only unlocked WO rows. |
| Stale week-off pay after a changed working day | Late 09:00 IN/18:00 OUT changed A→P, but already-decided Sunday stayed unpaid; the reverse could overpay. | Refresh previously decided open week-offs after recompute/manual/approved attendance and leave/RH effects. Preserve normal weekly close for undecided weeks. |
| Full-day leave retained old clocks/OT | Approving leave over an auto P left first/last, 600 worked minutes, late/early and 120 OT minutes on an L record. | Clear derived full-day clock, deviation, session/penalty and OT facts; raw swipe storage remains immutable. |
| Full-day leave conflicted with an OT obligation | A 120-minute approved OT entry coexisted with new full-day paid leave; approval and ledger debit succeeded. | Check live/approved/paid/converted obligations under the employee lock before debit or attendance writes. Reconcile explicitly. |
| Cancellation retained stale clocks | Cancelling a legacy/half-leave row kept its old first/last/worked fields while publishing the pending A floor. | Clear those derived values until queued raw recomputation; exact leave credit reversal is unchanged. |
| Payroll used provisional/future recoveries | With ₹1,000 gross, settled ₹200 plus provisional ₹300 and future ₹400 all deducted: ₹100 net instead of ₹800. | Only earlier finalized/paid same-company origins can supply carry balances. Lock origins before claiming recovery rows. Existing line-rounding policy unchanged. |
| Unsafe source-run reopen | A finalized origin could reopen while a later run already consumed its recovery. | Refuse until dependent recovery claims are reconciled/released. Serialize on origin then carry rows. |
| Draft retained recovery reservations | Returning a dependent payroll to draft kept its consumed_run_id and prevented safe correction of its origin. | Release those claims atomically with the audited return to draft; compute reads eligible origins again. |

## Financial regression

The synthetic CANTEEN flow now includes a reviewed ₹50 current input and a settled ₹200 carry balance on ₹1,000 gross: deductions ₹250, net ₹750. The provisional ₹300 and future ₹400 remain unconsumed. Recompute preserves exact results without duplicate charges. An independent HR-head checker approves, finalization runs independent reconciliation, and additional inputs are refused after finalization. After reopening the dependent run and returning it to draft, the origin can reopen; recomputing the dependent run excludes the now-provisional origin, retaining only the ₹50 current charge and ₹950 net.

Source totals and expected amounts are independently hand-computed; no real meal booking was posted. This review does not choose prepaid/postpaid recovery, subsidy, refunds or fractional recovery rounding. Native canteen financial ingestion remains pending that contract.

## Verification

Initial regressions failed on the actual native CSV, day/leave/workflow and payroll services. Seven focused suites passed 106 tests after repairs; a separate cancellation assertion then reproduced the additional stale-clock defect before it was fixed. Final backend `npm run verify` passed **149 files / 1,072 tests**, typecheck, lint, knip, dependency-cruiser, coverage and build. Coverage: 86.48% statements/lines, 80.98% branches, 90.82% functions. `git diff --check` passed. [Machine-readable result](verification.json) and [Pack39](../../plans/sow-completion/39-PUNCH-TO-PAYROLL-INTEGRITY.md).

Tests use an explicitly declared loopback PostgreSQL target. New fixtures are rolled back, including the synthetic finalized payroll and audit records. The existing compute-edges fixture's opening recovery now comes from a finalized origin rather than a draft origin.

## Limits and acceptance

The 04:00 cutoff remains an HRMS safety policy; shift attribution, actual clocks, later-ending shifts, device completeness, protected approvals and month locks remain authoritative. No source workbook edits, real KENT calls, production configuration, statutory rates, deployed code or salary payouts changed.

Half-leave is still represented by legacy edge-half booleans and existing worked-half evidence; exact first/second-half leave selection needs an approved contract before extending it. Real KENT attendance/canteen device identities, delayed delivery/completeness and transaction-level canteen settlement/refund acceptance are still required. Mandatory human review of the payroll-core diff remains open under CLAUDE.md §3. Tests establish these repaired scenarios, not a guarantee that every possible defect is absent.
