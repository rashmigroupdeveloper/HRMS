# CORE-10 readonly authority repair — 16 October 2026

Phase 0 Stage 0.4 increment addressing H02 from pack23. The system is not certified complete or ready for production.

The central gate previously treated readonly permission grants as write authority and global population. The first ten native HTTP/PostgreSQL regressions all failed before this repair and passed after it. The new resolver filters readonly grants out of write membership and scope. Reads retain their authorized population; an organizational-unit assignment also bounds readonly reads. Mixed grants, secondary permissions, alternative permissions and next-request revocation are covered. No role name checks, migration, setting or database field was added.

The gate uses the server procedure's declared method: GET reads; other methods and oRPC default POST require write authority. Existing audited POST queries explicitly declare read mode. Authenticated helpdesk replies and generic workflow creation had secondary permission checks outside the central business gate; those checks now require writable grants. Ticket assignment alone no longer authorizes an agent reply after write authority is removed. Own-ticket ESS replies remain available.

## Evidence

- `permission-authority-before.log`: first ten regressions failed against prior behavior.
- `permission-authority-after-initial.log`: all ten passed after repair.
- `backend-verify.log`: full native backend verification, actual outcome recorded in `verification.json`.
- `schema-check.json`: fresh read-only catalog comparison.
- `sow-scope-current.json`: all176 prior SOW rows retained unchanged, with this repair addendum only.
- Regression source: `backend/tests/permission-authority.integration.test.ts` (twelve cases including two additional resolver controls). Each fixture is rolled back; no active synthetic user is retained by this suite.

Full backend result: **510/510 tests across66 files passed**, with zero skips. Typecheck, lint, knip and dependency boundaries passed. `npm run verify` exits1 because coverage is76.64% lines/statements and72.06% branches against the unchanged80% floor (functions81.15%). Separate backend build exits0. Fresh catalog parity remains132 relations/1,379 columns, zero column changes and no new migration.

## Scope and remaining work

This fixes write authority; handlers must still apply employee scope. H01 and H03–H14 remain open: attendance correction scope/reason/locks/derived facts, absence letters, export/dashboard population and onboarding atomicity/readiness/identity/dates/Kent evidence/stakeholder task access. Stage0.4 also retains failed-login concurrency/backoff and the signed refresh/session decision. Other-module O findings and prior payroll/lifecycle/coverage/integration gaps remain. Claims and budgets remain deferred. No frontend flow changed or browser acceptance claimed.

Authorization annotations touch payroll-core routers, so mandatory human review is pending under AGENTS.md. No statutory formula, payroll amount, policy rate or money rounding changed. This repair does not waive that review or any red verification gate.
