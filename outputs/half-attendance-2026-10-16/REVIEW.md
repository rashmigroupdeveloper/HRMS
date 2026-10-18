# Half-wise attendance and requests —16 October2026

Phase1 Stage1.4, ATT-05/06/07. Sponsor confirmed one present half is **half-day present**, showing P:A/A:P.

## Contract and data

Existing `att.day_records.session_statuses` retains ordered first/second halves; its CHECK and boundary schema now also accept OD. The daily summary is separate: P/A or OD/A isHD, P/OD isP, OD/OD isOD. `att.regularizations.day_portion` is the one new requested-coverage field, constrained to whole/first/second half, with a whole-day default for old rows. Workflow payload mirrors the authoritative domain row; a sent-back correction updates both before restarting approval. Dates, kind, selected half and reason are visible to the manager and in employee history and R3 list/export.

Final approval retains subject→request→domain→audit locking. It registers the approved half overlay and recomputes raw attendance under the same subject lock. Later swipes still update the other half; the approved half cannot disappear. Complementary requests can coexist, but overlapping open/approved coverage is refused under that lock, including concurrent submissions. Locked/month-protected/manual/leave data cannot produce a false successful approval.

First-half coverage clears only the derived late flag; second-half coverage clears only early exit. Actual swipe timestamps/work/OT remain raw facts. There is no change to payroll/statutory formulas, rates or paid-leave rules. Approved future OD schedules existing recompute work at shift end. It cannot manufacture future absence in the other half. Device readiness still holds any incomplete absence. Requests/history expose approval while processed attendance is not yet due.

## User interface

The existing form adds whole-day/first-half/second-half selection, draft persistence and a preview saying the other half is unchanged. Short permission retains bounded times. The correction form preserves/edits the half, manager summaries state its limited consequence, calendar/drill-down names first and second halves, and the selected mixed day says Half-day present. Full present days and half-days are shown separately, avoiding a whole-day present claim for P:A. R1 muster and R3 Excel use the same persisted half coverage.

## Verification and limits

Final checks: **529 backend tests/68 files, zero skips**, including all10 new native cases. Typecheck/lint/knip/dependency boundaries and separate build pass. Backend verify exits1 solely on unchanged coverage:76.81% lines/statements,72.66% branches,81.51% functions against80% each. **Frontend full verify exits0:257 tests/27 files and build pass.** Existing large-bundle warning remains advisory. React Doctor exits0, score74 with one advisory complexity warning in the revision form. Schema:132 business relations/1,381 columns, exactly one new coverage field this increment; migration recheck clean. Cleanup shows zero active fixture users, non-exited fixture employees, unrevoked fixture sessions or remaining fixture workflows. Four owned immutable test month headers remain. `verification.json` and raw logs retain the results. Native cases cover HTTP creation/decision, first/second complements, concurrency/overlap, late raw swipes preserving OD, future OD scheduling, sent-back correction, locked month, manual facts, protected leave and unavailable boundaries. The native report control opens real XLSX and checks coverage, and compares muster P:A/HD. Existing whole-day request/OT/session/muster suites are included in full backend verification.

A live browser check of127.0.0.1:5173 was blocked by connection refusal; no visual walkthrough is claimed. React Doctor is advisory, not acceptance. Global coverage thresholds remain80%. All176 SOW row values/statuses/deferrals are retained.

A configured contiguous session split is required; no invented clock midpoint. Disjoint shift intervals, leave/off-half reconciliation and exact recon-derived presence thresholds remain their existing policy/configuration work. Real Kent/UAT, previous HR-action/other-module defects and payroll/lifecycle acceptance remain open. Claims/budgets stay deferred. Isolated fixture users/sessions are disabled/revoked and employees exited; immutable audit/swipes/month-lock headers remain under their isolated test companies.
