# Phase 1 Stage 1.4 — half-wise attendance, regularisation and OD

ATT-05/06/07, sponsor16 Oct2026: P:A/A:P is **half-day present**, preserving both halves.

- [x] Request/restore drafts for whole day, first half or second half; bounded short permission remains separate.
- [x] Authoritative `att.regularizations.day_portion` with legacy whole-day default, CHECK and lookup index; no duplicate transaction table.
- [x] Manager payload, sent-back correction, employee history and R3 list/XLSX retain the selected half.
- [x] Final AR writes P and OD writes OD only in selected halves; session JSON supports OD.
- [x] Late/early flags are corrected only at the selected first/second boundary; raw swipes and OT facts remain actual clock data.
- [x] P:A/A:P/OD:A/A:OD →HD; P:OD/OD:P →P; OD:OD →OD. These summaries preserve existing attendance weights and introduce no new pay formula.
- [x] Complementary half requests may coexist; overlapping live/approved coverage is rejected. Account-subject locking serializes concurrent submissions and approval/recompute.
- [x] Preserve approval coverage during later raw-swipe recomputation of the other half.
- [x] Future OD queues processing for shift end; incomplete device sync holds absence, rather than inventing A. Queue drain observes not-before timestamps.
- [x] Locked month, HR manual facts or protected leave prevent unsafe/false approval atomically.
- [x] Ten native integration cases plus UI tests cover the new behavior; actual final checks recorded in [evidence](../../outputs/half-attendance-2026-10-16/REVIEW.md).
- [x] Full checks run:529 backend tests and257 frontend tests pass; static gates and both builds pass.
- [ ] Global backend80% coverage acceptance:76.81% lines/statements and72.66% branches. Verify remains RED; no gate advances.
- [ ] Live browser walkthrough: local5173 server was unavailable. Real Kent delivery/UAT and remaining G1 acceptance remain open.

No guessed clock midpoint, leave-half payable policy or disjoint split-shift policy. Half requests require the configured contiguous session split; leave/off reconciliation remains HR work. Existing H01/H03–H14, other open O findings, payroll/lifecycle work and previous human review requirements remain tracked. Claims/budgets stay deferred.
