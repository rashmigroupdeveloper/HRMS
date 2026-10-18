# HR attendance safety repair — Phase1 Stage1.2

17 Oct2026 · CORE-10/11, ATT-03/04/05/08/12/15/17 · role-flow F02–F05.

## Implemented increment

- Own employee population is enforced for processed-day reads, HR corrections and shift-scheme writes. Runtime permission membership is retained and no role names are hardcoded in handlers. Cross-unit access returns403.
- Reason input is trimmed/validated at HTTP and service boundaries. Calendar dates are validated rather than merely matched by a regex.
- Corrections lock the subject employee, coordinate through the same company/month advisory lock as month close, reject locked rows and closed months with409, and write the day and actual before/after audit atomically. An audit failure rolls back the change. Concurrent corrections see the real predecessor. DB immutability triggers remain enabled.
- Manual corrections reset derived clock/work/late/early/OT/penalty/leave-type/week-off fields; raw swipes remain immutable. A day carrying approved leave or an approved leave application cannot be silently overwritten. Pending/approved/converted/paid OT/comp-off obligations block direct correction for explicit reconciliation; no ledger or approval is silently reversed. Week-off paid eligibility is recomputed through the existing week-close policy, not an invented manual fraction.
- Delayed derived OT detection checks current day provenance before and, for workflow creation, under the employee lock. A detector that waited behind a manual correction rolls back its tentative workflow rather than creating false OT. Worker-without-ESS detection and notification use one subject-locked transaction.
- Real active-shift scheme changes are scoped and audited, enqueue affected unlocked unrostered processed days in a batch, retain existing queue not-before timestamps and invalidate affected manager month attestations. Replaying the identical assignment is a no-op. Explicit rosters and closed day facts are preserved.

## Existing data and transaction contract

No new table, field, permission code, setting, migration or DB type was added. Existing authority remains `core.employees` + runtime role/permission/population, `att.day_records`, shift/scheme/roster and recompute records, manager approval ledger, workflow/leave/OT links and `core.audit_log`.

Mutation lock order is subject employee → company/month close lock → day/domain rows → audit. Scheme months are acquired in date order. Audits identify the actual day PK and explicit subject employee, not an employee ID mislabelled as the day PK. Derived fields and reason/provenance are in both snapshots. API errors distinguish scope403, invalid input400, missing employee404 and conflict409; unexpected database errors still propagate and roll back.

Public `setManualStatus` remains available from the attendance module via its existing barrel. Its implementation moves into `manual-status.service.ts`; `attendance-mutation.ts` contains shared transaction/scope/lock boundaries and `scheme.service.ts` handles assignments. HTTP paths and response contracts are preserved.

## Proof and limits

The17 native cases cover cross-unit refusal, valid half correction/read, whitespace/date rejection, locked row and closed-month insertion refusal, derived-field/audit parity, leave/OT conflicts, scheme scope/active shifts/recompute/no-op/attestation behavior, standalone audit-failure rollback, concurrent predecessor audit and a detector race synchronized through actual PostgreSQL blocking locks. Fixtures use the authorized local hrms test database. Transactional fixtures roll back. Committed race fixtures are disabled/detached/exited after mutable subject records are cleaned; immutable audit/user parents are retained.

Final full verification, catalog and cleanup results are in `verification.json`, `schema-check.json`, `cleanup-check.json` and adjacent raw logs. No frontend change or browser acceptance is claimed in this backend increment. The existing HR direct-correction screen is still an owning-stage UI task; this repair secures its HTTP/service authority.

## Remaining work

This increment repairs the reproduced F02–F05 backend defects; it does not complete every item in the49-case review or promote a full SOW row. Month-close completeness/report scope, HR hold recovery UI, actual Kent protocol/adapter, payroll co-sign/source/console/output work, atomic onboarding/task access, LOI/ATS integration and other domain/operations obligations remain in pack28 and the current SOW copy. Existing global backend coverage, real UAT and phase gates remain explicit. Claims and budgets stay deferred. Earlier payroll/statutory human review remains required; those modules were not edited here.

## Final verification result

**546 backend tests in 69 files passed**, including17 new native cases. Targeted17+5 existing date/phase regressions passed22/22. Typecheck, lint, knip, dependency boundaries and separate backend build passed. Full verify is **exit1 solely on coverage**: lines/statements77.08%, branches72.85%, functions81.83%; the required80% thresholds were preserved. The first full run exposed the previously unscoped date-test fixture; it now has a legitimate org-unit grant and finally-cleanup instead of bypassing security.

Fresh read-only catalog remains132 business parent relations/1381 columns. No migration was added. Cleanup found zero active committed fixture users, non-exited committed employees, unrevoked sessions or workflow rows;1 failed earlier date fixture account(s) were cleaned without deleting immutable history.

All176 original SOW rows and their broader obligations remain in the adjacent current SOW copy. F02–F05 are recorded as backend repairs only; the other13 finding groups and release/UAT acceptance remain open.

The owned local preview API was restarted to load the repaired source; `/api/system/health` returns200 on loopback5100. This is liveness evidence, not a new browser/HR UAT claim.
