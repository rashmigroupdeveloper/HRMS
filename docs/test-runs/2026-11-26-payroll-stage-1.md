# Payroll Stage 1 — 26 November 2026

## Approved scope and sources

The user approved PayrollRun and Stage 1: regular monthly India company drafts with proper access checks. Reviewed
main's pay-schema-init migration, run service/state machine/attendance repository, payable-day evaluator, compute
engine, statutory/configuration services, salary snapshots, outputs, parallel-run comparison and related test inventory.
Main is business reference only: no Kysely/SQL schema architecture, triggers, separate approval machinery, rates or
rounding policies were copied. Main's production readiness was not established by this review.

Reuses new's company eligibility, attendance cycle, dated salaries (for later stages), role/data scope, audit system,
typed oRPC, shared form controls and role portal. Adds only the approved PayrollRun model and PAYROLL access area.
No employee-input/calculation/result/delivery/payment model or action was added.

## Database and access

- Generated `20261126041754_payroll_run_foundation` using Prisma migrate dev --create-only on `_test`, added month-start
  and attendance-order CHECKs before application, then deployed it on the test DB and generated the client.
- PayrollRun: company, first-of-month payMonth, captured attendance dates, DRAFT status, standard actor/time audit.
  Company/month unique constraint prevents racing duplicate creates; company deletion is restricted. Only DRAFT is
  introduced now; future transitions/actors wait for their actual approved workflows.
- Four APIs: payroll.setup/list/get/create. Setup is a shared month-based attendance preview plus eligible companies;
  it is intentionally visible before company selection because new has one group-wide attendance cycle.
- Section 8 rule: whole-company PAYROLL scope. Lists/counts/details use wholeCompanyScopeOf inside repository AND
  clauses. Partial plant/department rows never combine, and team/HOD/SALARY/ORGANIZATION access does not imply Payroll.
  Creation checks area Edit, visibility and assertWholeSlice before looking up the company, then active India eligibility.
- Server rereads attendance dates in the creation transaction and compares the reviewed preview. The stored dates come
  from the server, not input. Later cycle changes do not rewrite saved dates. A duplicate draft gives an actionable
  conflict; a database unique constraint remains the final race guard.
- Detail resolves creator/updater names through lookupPeople; APIs never expose raw audit actor IDs.
- App DB migrations were not applied. This local app DB already had older pending salary/holiday/leave migrations;
  the approved payroll migration must be rolled out through the reviewed chain before app use.

## Automated coverage

Nine integration tests in backend/tests/data-access-payroll.test.ts cover: draft persistence/audit; company A/B
list/count/picker/detail isolation; View/Edit distinction; plant, department and multiple partial rows; SALARY-only,
self-service and inactive assigned roles; non-India/inactive eligibility; strict month/input validation; stale cycle
preview; concurrent duplicates; scoped pagination; frozen dates after an actual temporary cycle change; history after
company retirement; database month/order constraints. Temporary cycle values are restored in finally.

## Browser verification

Test-only API 5291 / Vite 5191, forced TEST_DATABASE_URL ending `_test`, no SMTP. Synthetic data only.

1. Scoped Payroll QA Editor 2051 sees only its eligible India company.
2. Selected that company and confirmed November 2026 has attendance 26 October–25 November.
3. Cancel with unsaved company selection asks Discard changes; Keep editing preserves values.
4. Create draft through the actual UI: persisted run 7, typed API returns ID and opens detail with captured dates and
   the synthetic logged-in creator. Returning to the list shows one run.
5. A second attempt for that company/month shows the explicit duplicate message; unsaved close still asks before discard.
6. Switching the same account to Payroll QA Viewer (while Editor remains assigned) allows list/detail with no create
   action. This verifies active-role isolation in the actual session.
7. Empty list, loaded list, held list loading, loaded/held detail, disabled/enabled creation, error and dirty-close states
   checked. URL filters/selection and pagination are bounded; no monetary totals or payment controls appear.
8. Before/after desktop1440 and phone390 screenshots reviewed against .claude/agents/ui-critic.md. Fixed initial mobile
   filter wrapping/status-pill stretch; kept header geometry stable; matched skeleton row heights and static pagination.
   Unknown cold loads use three typical rows; background refetch preserves existing loaded rows (isPending is false).
9. An old preview origin carried 80% zoom. Discarded malformed/intermediate captures; final packet uses localhost and
   settled viewports, verified with image dimensions: all desktop1440×900, phone390×844, no cropped/blank captures.
10. Removed own hold marker, reset viewport overrides and closed own preview tabs. Removed only the two temporary
    payroll grants from the synthetic account, preserved other grants and draft/history, and retired the QA company.
    The later selected-company screenshot used an existing eligible synthetic test company without submitting it.

Final evidence in `/tmp/hrms-payroll-qa/`:
- final-list-desktop.png / final-list-phone.png
- final-loading-desktop.png / final-loading-phone.png
- detail-desktop.png / detail-phone.png
- detail-loading-desktop.png / detail-loading-phone.png
- create-desktop.png / create-phone.png (eligible company selected, Create draft enabled)

## Independent visual and documentation review

Fresh no-history Impeccable reviewer opened all ten final captures and returned **ship — visual review only**.
It confirmed compact identity, no visible overflow/clipped controls, selected-company creation, shared attendance
preview, matched detail skeleton and appropriate typical cold-load rows. No material fixes remain in that packet.
Functional/permission claims rely on the integration/browser checks above, not screenshot review.

Detector ran once and returned `[]`. React best-practices review covered typed queries, conditional loading, labels,
protected forms, bounded rows and no new dependencies.

A separate read-only design documenter inspected the final captures, styles and shared controls: no system files
changed. Existing warm grey/cream/ink palette, Geist type, compact hierarchy, rounded container, shared buttons and
protected dialogs were preserved. Existing gold-action CSS commentary versus charcoal default buttons was reported
as pre-existing drift, not canonized or repaired. No new root design files were created for this extension.

## Checks

The first full run had 292 passed and one existing leave-credit test timeout at 30 seconds while typecheck/preview
were running. No timeout was increased. The standalone full rerun with preview stopped passed all 54 files / 293 tests
in 142.46 seconds.

Final required checks, after the last code changes:

- npm run typecheck: pass (backend, script/test types and frontend).
- npm run lint -w frontend: pass; existing HodDialogs.tsx fast-refresh warning remains.
- npm run build: pass; existing client chunk-size advisory remains.
- npm run check:api-tracker: pass, 294 APIs with Scope entries.
- npm run check:data-access: pass, 122 watched repository reads.
- npm run test: pass, 54 files / 293 tests on the standalone rerun. Existing pg query-concurrency deprecation warnings.
- git diff --check: pass.

A final read-only migrate status confirmed local app DB hrms_new has 13 pending migrations (11 earlier salary/
holiday/leave, daily movement settings, and this payroll foundation). None were applied to the app DB. Test migration
deployment and generated-client checks passed. App rollout remains a separate reviewed migration-chain operation.

Documentation updated: CLAUDE.md (payroll access exception), README.md (module/usage), BACKLOG.md (built Stage 1 and
remaining stages), API_TRACKER.md (four scoped APIs), and this test-run record.
