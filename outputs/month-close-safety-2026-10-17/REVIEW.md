# Month-close safety and report scope — 17 Oct 2026

Requirements ATT-03/04/12/15, CORE-10/13, RPT-02/06. Implements local repairs for pack28 F06 and selected F14 surfaces. No release gate is signed.

Closed-period and employee/date readiness checks now block empty/future/incomplete periods, missing joining dates/biometric registration, unresolved week-off/leave facts, queued recomputations, unapplied approved AR/OD, outstanding leave/cancellations and qualifying OT with no decision record. All unresolved target-period AR/OD/OT block until a real carry-forward mechanism exists. Manager policy seed defaults true; an explicitly disabled policy blocks with an actionable explanation.

Close, manager attestation, roster writes and recomputation now serialize through employee locks. Roster scope is rechecked inside the transaction; roster changes cannot enter an already closed month. Migration1752310000000 changes only an existing function, adding no table or field: timestamp-only or identical recomputation and freezing preserve approval, while actual facts invalidate it. Local migration applied. Existing historical approval invalidations are retained, not rewritten.

Company checklist/ledger/freeze require full company-unit/population authority, with exact runtime permission scope. HR proxy attestation uses the actual month-lock write grant. R21 offers and R28 assets apply population scope; unlinked candidates/stock require complete company authority. HR Ops counters and policy audience numerator/denominator use the caller population. This does not complete every report, aggregate compensation visibility or every lifecycle/report gap.

Verification: new11 month-close native cases plus4 report-scope native/HTTP cases; existing suite and static gates passed (see raw log for total). Separate TypeScript build passed. Full `verify` remains RED solely on coverage:77.59% statements/lines,73.50% branches,82.12% functions versus80% thresholds. Thresholds unchanged. No frontend change in this increment. No real integration/UAT evidence inferred.

New fixtures use transaction rollback, leaving no committed company/person/session/lock/request/audit rows. Existing full-suite fixtures follow their existing cleanup. No new production database or credentials; local hrms remains test only. Production PostgreSQL16, real Kent, ATS SSO, real master/parallel-run, operations proof and human money review remain unresolved.
