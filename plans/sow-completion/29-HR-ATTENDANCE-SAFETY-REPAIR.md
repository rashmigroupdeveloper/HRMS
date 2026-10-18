# Phase1 Stage1.2 — HR attendance correction and scheme safety

17 Oct2026 · CORE-10/11, ATT-03/04/05/08/12/15/17 · repair increment for pack28 F02–F05.

- [x] Employee-scoped processed-day reads, direct HR correction and scheme writes; no handler role-name checks.
- [x] Trimmed meaningful reason and calendar-date validation; typed400/403/404/409 errors.
- [x] Subject/month/day locks, closed/locked conflict, one correction+actual before/after audit transaction; no false success.
- [x] Stale derived OT/penalty/clock/leave/week-off fields reset; raw swipes/ledger history preserved. Active leave/OT/comp-off requires reconciliation rather than silent reversal.
- [x] Delayed OT cannot attach a stale obligation after a winning HR correction; actual PostgreSQL wait/race proof.
- [x] Scoped active-shift scheme assignment, atomic audit, batch recompute of affected unlocked/unrostered dates, not-before preservation, manager attestation invalidation and no-op retries.
- [x]17 new native cases;22 targeted regression cases and full546 tests pass; static checks and build pass.
- [ ] Full backend verify coverage gate: lines/statements77.08%, branches72.85%, below unchanged80%; no stage/release gate advanced.
- [ ] Direct HR correction UI/browser acceptance, week-off/month-close completeness and other owning-stage work.

[Detailed repair evidence](../../outputs/hr-attendance-safety-2026-10-17/REVIEW.md) · [verification](../../outputs/hr-attendance-safety-2026-10-17/verification.json) · [all176 SOW rows](../../outputs/hr-attendance-safety-2026-10-17/sow-scope-current.json).

No new field/table/migration/permission/setting. Earlier uncommitted work and immutable data preserved. Payroll/statutory modules untouched; their human review remains required. Claims/budgets remain deferred. Pack28 F01/F06–F17 remain; next separately announced build is Stage1.7 month-close completeness/report scope. Follow AGENTS one-stage rule: report this increment and stop.
