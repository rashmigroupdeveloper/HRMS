# Attendance, holiday, leave and payroll repairs — 21 Oct 2026

Scope: Phase 1, Stage 1.8. Requirements ATT-05/06/07/12/15, LV-01..09, WF-01, CORE-06/10/11 and PAY-04/05. This follows the six findings in `../attendance-flow-qa-2026-10-21/REPORT.md`.

## Repairs

| Finding | Change | Evidence |
|---|---|---|
| F01: another employee's attendance reason appears after account switching | Attendance and leave drafts are keyed by authenticated user ID. Missing identity disables persistence; unowned legacy drafts are discarded. Drawer state remounts on identity change. | Component and storage tests; live employee → sign out → manager verification, `manager-draft-isolated.png` and `.txt`. |
| F02: cross-month request claims there are no posted attendance records | The form distinguishes the loaded month's records from dates whose records it has not loaded. It asks the user to open that month instead of asserting absence of records. | Cross-month drawer regression. |
| F03: zero absences falsely implies everyone is accounted for | HR dashboard returns and displays expected, processed and awaiting attendance counts in the same employee scope. | Native two-person, zero-record test; live dashboard showed 1 processed and 2,947 awaiting. |
| F04: payroll input lock succeeds before attendance close and strands a run | Locking inputs requires the matching attendance month lock. Legacy inputs-locked/reopened runs attach the authoritative lock when computing after closure. | Native lock guard and full payroll lifecycle regression. |
| F05: locked leave cancellation enters an approval queue that cannot complete | Cancellation checks attendance/month locks before creating the workflow, inside the transaction and employee lock. Ownership/status/pending cancellation are checked again under the lock. | Locked cancellation creates no request; successful cancellation restores the exact debit and queues recalculation. |
| F06: leadership dashboard fans out per company and rate-limits the next task | One consolidated R24 report replaces the company-by-company fan-out. Report scope remains enforced in SQL. Payroll load failures keep an explicit retry state instead of showing a false empty list. | 2,000-company frontend regression requires one boarding call; native scoped consolidated report test. |

Additional related fixes:

- New leave configuration panel exposes active/inactive types, paid treatment, monthly credits, service requirements, carry-forward/request caps, half days, sandwich treatment, encashment, gender and category eligibility. Scoped HR can inspect global policy; group-wide authority is required to change it.
- Configuration numbers and real calendar dates/time-of-day inputs are validated. A used leave type's paid/unpaid treatment cannot be changed retroactively. Writes are audited.
- Employee type options and balances consistently enforce category eligibility. Accrual excludes unpaid types and employees before joining/after leaving.
- Leave and attendance regularization cannot reserve or overwrite conflicting pending/approved coverage. Final leave approval revalidates policy, days and balance instead of silently using an obsolete calculation.
- Leave preview applies the request cap and eligibility/overlap rules used on submission. The UI disables submission while preview is pending or failed and discards stale results.
- Balance adjustment and audit are atomic. Register balances use the immutable ledger total consistently with ESS (expired credits are reversed by lapse entries, not subtracted twice). The `onLeaveOnly=false` query parses correctly. Register loading failures have retry/error states; late responses cannot replace a newer search.
- Group-wide leave-job triggers require group-wide integration authority and reject future accrual/year-end inputs. UI capabilities match these server checks.
- Restricted holiday selection checks period locks before queuing approval. Restricted-holiday and encashment reservation checks execute under the employee lock.
- Bank-file generation is transactional and serialized with run finalization/reopen. Its creation timestamp uses the actual database clock, allowing a file generated in the same transaction as finalization to count as current. The lifecycle test now uses the actual generator instead of inserting a second active batch by hand.
- Selected calendar dates keep their attendance glyph/type visible. Four assertions were updated to allow the same status in both the calendar and day detail.
- Test setup now requires an explicitly supplied integration-test target; application `.env` values alone no longer enable global integration jobs. The reports integration suite now skips without an authorized database instead of trying a default connection.

## Verification

- Frontend `npm run verify`: passed, 384 tests in 56 files; typecheck, lint, knip and production build passed.
- Native PostgreSQL focused suite: 91 tests in 9 files passed, including holiday scope/API, month close readiness, leave repairs, payable attendance, full payroll lifecycle, statutory golden cases, payroll pipeline and test-target guards. Native domain fixtures roll back. The separate final payroll lifecycle rerun also passed after adding an explicit legacy null-lock recovery assertion and audit event.
- Backend typecheck, lint, knip, dependency boundaries and build: passed. Full backend verification is not a release gate pass: five existing onboarding/probation mock tests fail (428 pass, 599 skip). The default run has 40.24% lines/statements and 30.69% functions against the 80% floor; branches are 80.51%. Final logs contain the precise result.
- Live browser: employee draft saved, sign out/login as manager yielded an empty reason; group HR created and then deactivated a synthetic policy through the configuration screen. `policy-saved.txt` verifies `QA218638895_POLICY · Inactive`; the policy has zero accrual. Screenshots are included.

## Shared-local-test incident and cleanup

The first broad coverage run picked up TEST_DATABASE_URL and LOCAL_TEST_DATABASE_NAME from the application's `.env`, enabling legacy tests against loopback `hrms`. The run was stopped when this was identified. The final default test setup no longer accepts those `.env` declarations as authorization.

A time-bounded query identified 17 future accrual rows from that invocation. Each was neutralized with a separately audited immutable adjustment linked to its original row; no ledger entry was edited or deleted. Four legacy synthetic leave-suite employees were marked exited and 851 queued test notifications from the exact invocation window were parked in dead letter. See `suite-effects.json`, `suite-effects-neutralised.json`, and the exact selection/compensation scripts. The original QA's earlier cleanup remains documented separately. The broad run also retained synthetic test/audit fixtures according to existing suite cleanup conventions; it is not claimed to have rolled back all legacy fixtures.

The five fresh browser test users have been disabled, roles detached and sessions revoked; both browser fixture employees are exited. The inactive synthetic policy and immutable audit evidence are retained. No bank transfer was made.

## Review and release limits

Changes are local and uncommitted. Existing unrelated working-tree changes were preserved. No migration, deployment or release gate was advanced. Human review of `backend/src/modules/payroll-core/runs/run.service.ts` is mandatory under `CLAUDE.md` §3. The broad backend suite/coverage gate must be green before release; passing targeted checks is not a substitute.
