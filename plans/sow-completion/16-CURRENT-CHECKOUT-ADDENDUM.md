# Current checkout addendum — 10 Oct 2026

This addendum takes precedence over the **09 Oct source-presence and gap statements** where newer files differ. The schema design still follows the approved specifications. `current-checkout-2026-10-10.json` records current file fingerprints, declaration evidence and changes; it does not certify new code or replace the historical audit with guessed completion ticks. Recheck hashes before implementation because the shared checkout was changing during this work.

## New payroll code must be reused and reviewed

The checkout now contains `backend/src/modules/payroll-core/` and `backend/migrations/1752220000000_pay-schema-init.ts`. `backend/src/api/router.ts` registers `payroll: payrollCoreRouter`. Source includes component and salary-structure procedures, effective salary assignment/history, holds, payroll run transitions, calculation/proration/arrears and reconciliation. P01/P02/P03 are therefore **no longer accurately described as having no backend source**. Their new source is present, but money acceptance, constraints, runtime grants, entity scope, full verification, golden fixtures and independent review have not been proven by this follow-up. Reuse and repair the current implementation; do not start a second payroll module.

The new migration declares **23 tables**; **3 already exist in the inspected local catalog**: `pay.claim_types`, `pay.claims`, `pay.gl_accounts`. In particular, existing budget-backed `pay.claims`, `pay.claim_types` and `pay.gl_accounts` must be reconciled against their observed columns and missing migration provenance. Do not apply this migration unchanged: duplicate CREATEs would fail, and silently dropping/recreating the observed models would discard the existing budget/claim design. Forward changes must preserve those canonical owners.

Concrete review boundaries visible in new source:

- `runs/run-state-machine.ts` permits reopening finalized runs; the migration's immutability function permits that transition and subsequently item editing becomes possible. Approved reliability rules require immutable closed results and recompute+delta. Keep original closed results immutable and model an audited replacement/adjustment before acceptance; a reopen state is not permission to erase history.
- The migration protects payroll item headers from UPDATE/DELETE when closed, but defines no corresponding line protection and no closed-run INSERT protection. Complete DB-level immutability across headers, lines and frozen inputs.
- `pay.loans.outstanding` remains a mutable column in the new migration. The schema plan requires authoritative immutable postings with SUM-derived outstanding, not a second financial counter.
- The migration seeds formula/rate literals and a statutory cess default; `engine/compute-engine.ts` documents default policy thresholds. Resolve effective policy provenance and typed configuration under D01/D10; do not accept source defaults as approved statutory policy.
- `runs/run.service.ts` converts DB decimal money through Number and rounding. Review conversion with the approved exact Money boundary before money acceptance; NUMERIC storage alone does not prevent application precision loss.

These are source review obligations attached to P01–P07 and schema packs13–15, not a claim that those features are complete. Mandatory payroll-core/statutory human review remains in force. This task has not applied the new migration or changed its money code.

## Test target and checks

Sponsor confirmed every current local DB is test-only and explicitly requested deletion of hrms_test; deletion was completed and hrms retained. Tests now require explicit TEST_DATABASE_URL. The local exception additionally requires LOCAL_TEST_DATABASE_NAME=hrms, NODE_ENV=test and loopback; CI still uses a dedicated test target. Importing the settings seed definitions no longer executes the CLI. A seed-import regression failed before the guard and passed after it.

**14 targeted tests passed** across target validation, seed imports and settings seed definitions. The latest backend npm run verify passed typecheck at invocation, then exited1 on **six lint errors** in payroll-core: static-only classes in arrears/proration/state-machine, array syntax in proration and conditional/optional-chain issues in state-machine. Later gates were not reached. Frontend verify was not rerun for this backend schema follow-up; its 09 Oct evidence remains dated. Schema SQL was not compiled or rehearsed on PostgreSQL16 and was not applied. Phase0 Stage0.2 remains in progress.

## Changed source evidence

The fingerprint comparison found **46 added/changed files** in the indexed project scope. Source files are locators to read in the current repository, not bundled application code. Original 09 Oct audit entries stay historical until their specific repairs are revalidated.

| Source | Difference from 09 Oct |
|---|---|
| `backend/.env.example` | changed |
| `backend/knip.json` | changed |
| `backend/migrations/1752220000000_pay-schema-init.ts` | added |
| `backend/src/api/router.ts` | changed |
| `backend/src/core/db/types.ts` | changed |
| `backend/src/modules/assets/assets.router.ts` | changed |
| `backend/src/modules/employees/employees.repository.ts` | changed |
| `backend/src/modules/employees/employees.router.ts` | changed |
| `backend/src/modules/employees/employees.service.ts` | changed |
| `backend/src/modules/helpdesk/helpdesk.router.ts` | changed |
| `backend/src/modules/helpdesk/helpdesk.service.ts` | changed |
| `backend/src/modules/leave/leave.router.ts` | changed |
| `backend/src/modules/payroll-core/components/component.router.ts` | added |
| `backend/src/modules/payroll-core/components/component.service.ts` | added |
| `backend/src/modules/payroll-core/components/definitions.ts` | added |
| `backend/src/modules/payroll-core/engine/arrears.ts` | added |
| `backend/src/modules/payroll-core/engine/compute-engine.ts` | added |
| `backend/src/modules/payroll-core/engine/proration.ts` | added |
| `backend/src/modules/payroll-core/holds/holds.router.ts` | added |
| `backend/src/modules/payroll-core/holds/holds.service.ts` | added |
| `backend/src/modules/payroll-core/index.ts` | added |
| `backend/src/modules/payroll-core/reconciliation/reconciliation.service.ts` | added |
| `backend/src/modules/payroll-core/runs/run-state-machine.ts` | added |
| `backend/src/modules/payroll-core/runs/run.router.ts` | added |
| `backend/src/modules/payroll-core/runs/run.service.ts` | added |
| `backend/src/modules/payroll-core/salaries/assignment.repository.ts` | added |
| `backend/src/modules/payroll-core/salaries/salary.router.ts` | added |
| `backend/src/modules/payroll-core/salaries/salary.service.ts` | added |
| `backend/src/modules/payroll-core/structures/dag-evaluator.ts` | added |
| `backend/src/modules/payroll-core/structures/structure.router.ts` | added |
| `backend/src/modules/payroll-core/structures/structure.service.ts` | added |
| `backend/src/modules/reports/dashboard.service.ts` | changed |
| `backend/src/modules/reports/reports.router.ts` | changed |
| `backend/src/modules/settings/seed.ts` | changed |
| `backend/src/modules/workflows/workflows.router.ts` | changed |
| `backend/tests/global-database.ts` | changed |
| `backend/tests/payroll-dag.test.ts` | added |
| `backend/tests/seed-import.test.ts` | added |
| `backend/tests/setup-database.ts` | changed |
| `backend/tests/test-database-target.test.ts` | added |
| `backend/tests/test-database-target.ts` | added |
| `backend/vitest.config.ts` | changed |
| `frontend/src/app/router.tsx` | changed |
| `frontend/src/pages/payroll/PayrollPage.tsx` | changed |
| `frontend/src/pages/payroll/SalaryRevisionsPage.tsx` | added |
| `frontend/src/pages/payroll/SalaryStructuresPage.tsx` | added |
