# Deployment audit —18 Oct2026

**NO-GO. The current software is not certified deployment ready.** Another AI is actively editing the same checkout. This is source, native local test DB, generated-contract and synthetic-browser evidence; no production system, real Kent response, SMTP receipt or SeaweedFS object was accepted. Sponsor will supply raw Kent data and integration/production locations later. Local `hrms` is test only. Claims/reimbursements and prior budgets remain deferred.

## Current gates

| Gate | Observed result | Meaning |
|---|---|---|
| Onboarding focused backend |42/42,4 files; owned lint pass | Verified joining/token/allocator repair; mocked salary tests do not establish money correctness |
| Frontend full verify |298/298,32 files; static gates/build pass | Current tested UI baseline passes; integration and role acceptance still required |
| Backend production source build |Pass | Does not include test compilation |
| Backend full verify |Stops at TypeScript errors in shared test files | Red gate; no claim that all tests pass |
| Separate full backend runtime run |640 pass,5 fail,78 files | Five failures retained below; occurred before final work-email guard |
| Coverage |82.46% lines/statements,86.49% functions,76.88% branches | Branch floor80 not met; do not reduce it |
| OpenAPI generation |286 runtime procedures, all output schemas;43 lack explicit input schemas | Contract generation succeeds; per-endpoint input and permission rules still incomplete |
| Live DB trace inventory |141 parent tables,1,486 columns; all have a definition pointer | Does not prove every field is needed or used correctly |
| Stable final tree / target environment |Not established; PostgreSQL14.24 vs target16 | Final rerun and migration/operational acceptance required |

See [machine-readable results](verification.json), [runtime API inventory](api-runtime-inventory.json), [OpenAPI](openapi.json), [source audit](api-source-audit.json), [field trace](field-purpose-trace.json), [catalog constraints](database-catalog.json) and [changed-source comparison](source-hash-comparison.json). Source comparisons include our edits and the other editor; attribution is not possible from hashes. Live catalog excludes monthly child partitions from the parent-table count. No sensitive application row data or environment values were copied into the catalog.

## Verified local repair

[Pack33 joining evidence](../onboarding-joining-safety-2026-10-18/REVIEW.md) records actual-joining gating, complete submitted-form validation, real company/location/unit/master choices, protected profile preview, candidate isolation from employee MIS, atomic conversion/rollback and identity/ecode locks, no invented login/email, scoped task idempotence and no fabricated Kent registration. Hash-only finite links and conditional one-use submission are enforced. Migration1752330000000 was applied to local test DB and adds zero columns/tables. A requested work-email collision now returns a safe duplicate refusal before allocation instead of entering the transaction's constraint-error path.

## Remaining source-backed release blockers

| Priority / requirement | Exact repair target and data flow | Required acceptance |
|---|---|---|
| P0 LC-01/PAY-02/07 |`lifecycle/onboarding/onboarding.service.ts` still computes floating probation CTC, writes empty `pay.employee_salaries.component_amounts` and makes structure optional. Resolve accepted offer + approved company structure into canonical money components in the joining transaction. Existing canonical salary allocator also needs probation/full-CTC validation, transaction reuse and dependency-order review. | Hand-computed confirmed/probation money goldens; rollback including salary; human review; payroll consumes the exact snapshot |
| P0 LC-01/04, CORE-07/08 | Accepted probation duration/percentage must populate `core.employees` and drive `core.probation_reviews`. Remove6/100 fallback policy, settle month-end due-date behavior; validate statutory/bank formats/checksums and proof/correction. | Approved HR rules, missing-input refusal, month-end cases and corrected-profile review; presence is not verification |
| P0 CORE-10/NFR-03 | Generated inventory has43 input-less procedures; static audit has43 business `authed` declarations without an explicit permission. Review mounted endpoints individually using docs08/database grants; preserve correct own-record and population authorization. | Typed input/output, exactly one documented permission per business procedure, next-request grant/revoke tests, own/foreign/all authority matrix |
| P0 LC-05, CORE-10 |`frontend/.../TransfersPage.tsx` requests `/api/core/companies`,departments,locations,designations,grades; those operations are absent from generated OpenAPI. Errors are swallowed into empty choices. Connect to an authorized real catalog with matching DTOs and visible errors; do not invent IDs. | Browser → typed API → scoped masters → transfer → approved effective-dated history; payroll/entity/code continuity |
| P0 PAY-16/CORE-10 |`loans/loans.router.ts` route paths already include `/api` while the handler supplies `/api`, ledger path uses `:id`; `LoansPage.tsx` calls single-prefix URLs using raw fetch. Loan/advance scope is not deferred. Repair paths, typed authenticated client, permissions/population and money workflow as one increment. | Native HTTP route/401/403/own/foreign tests, apply/approval/ledger/payroll recovery without duplicate postings; money goldens |
| P0 PAY-04/05/06 |`payroll-core/runs/run.service.ts` maker/checker does not establish mandatory independent HR co-sign. Source/YTD/statutory/arrears/OT/debt consumption and actual payroll UI acceptance remain in pack28 F07–09. | Approved HR+payroll authority, result revision binding, rerun/idempotence, real parallel comparison, human money review |
| P0 ATT-01/02/16 | Real Kent connector/enrollment contract absent. Normal unconfigured behavior fails503; it does not demonstrate an integration. | Sponsor raw data/contract → sanitized fixtures → stable identity mapping → replay/late/reconnect/watermark/month-close tests → real acceptance |
| P0 LC-01/CORE-02/NFR-03 | ATS source `/Users/anooppratapsingh/Documents/interview_scheduling` has internal LOI approval but no verified candidate acceptance event. Explicit trusted acceptance adapter and linked-account SSO are unimplemented. | Source acceptance identity/version/idempotence; no employee until actual joining; bounded one-use signed handoff, audience/origin/session/account-link tests; no imported app roles |
| P0 CORE-05/LC-02 |`notifications.processQueue` is exported but not wired into normal API/worker execution; dev log transport is not SMTP delivery. Onboarding IT tasks still require HR conversion permission. | Durable dispatch/retry/idempotence, configured subscriptions, real SMTP receipt/failure evidence, independent task-owner scope |
| P0 NFR-03/CORE-06 |Storage composition selects local disk; S3-compatible SeaweedFS integration/configuration is incomplete. | Authorized object write/read/delete/expiry/error tests, document ownership/masking, backup/restore and production configuration |
| P1 ATT/LV/LC/RPT/HD/AST |Pack28 role-flow and176-row SOW obligations remain: mixed-half reconciliation, effective lifecycle/exit behavior, workplace/report population, asset/helpdesk/policy/engagement acceptance and real master reconciliation. | Role cases and source-to-report/ledger evidence per original SOW row; no completion percentage inferred from passing tests |
| P0 NFR operations | Target16, PgBouncer, off-box backup/PITR restore, deployment config, production origins, security/scale proof and HR/Finance UAT are not established. | Approved intended environment, repeatable migrations/restore/rollback drills, role UAT and accepted release evidence |

The API audit has21 unmatched **call sites**, not21 proven broken endpoints. Four are dynamic-query suffix patterns (`muster`,muster/export,r2-swipes/raw,transfers list) and are static-analysis candidates rather than confirmed route defects. Five transfer-master paths and the normal-prefix loan/claim call sites conflict with the generated route contract. Claims are deferred; they remain mounted and need deliberate release exclusion or safety repair before a launch. Do not silently count deferred routes as accepted.

## Failures in the full runtime run

1. `loans-and-claims-services.test.ts`: claim receipt guard expected lowercase text but actual message starts uppercase. Reconcile the assertion with the required refusal; do not remove the guard.
2. `payslip-outputs.test.ts`: masking expectation `1•••2345` disagrees with `•••2345`. Confirm intended disclosure rule before changing masking; more disclosure is not a test-only repair.
3. `separation-clearances-fnf.test.ts`: added test refers to undefined `separation`; shared-test compile also used wrong approval actor key.
4. `stage13-workflows.integration.test.ts`: generic resubmission tries a protected domain correction and is refused. Domain correction authorization must remain; correct the scenario or implement a validated domain path.
5. `transfers-and-assets.test.ts`: added maintenance case violates `maintenance_kind_check`. Compare actual service input/router enum, DB constraint and documented maintenance kinds; no constraint weakening.

TypeScript additionally reports reportR29/R30 wrong test parameters, rejectTransfer argument order, and a fabricated EmployeeScope.companyIds shape in added composition tests. Another editor is modifying these files during verification; preserve intent, fix against current signatures and rerun a stable tree. Test counts will change; these are timestamped observations, not the final totals.

## Database field review limits

The trace inventory now finds schema/migration definitions for all1,486 columns (591 schema-definition pointers;895 migration-only pointers). For example `core.employee_family.relation` and`dob` initially appeared untraced because a parser missed inline definitions; docs03 and the original migration do define them for family/nominee information. They were not removed. Definition coverage does **not** mean all migrations match the approved business purpose, duplicate concepts are resolved, every FK/date/money invariant is sufficient, or every populated field is correctly permission-masked. Keep pack18's semantic/duplicate-policy issues open until exercised by their owning domain. No bulk field deletion or speculative new schema is warranted by this inventory.

## Resume order

Keep current onboarding Stage3.1 open: canonical money/accepted probation facts and independent-root race proof first; then task ownership/delivery/ATS integration under its governing stages. Announce the next stage before addressing transfer/loan contract defects. Complete backend red-gate fixes with the concurrent editor finished, rerun full verify on a recorded stable source snapshot and target16, then perform real integration/role/operations acceptance. Retain the full176-row SOW crosswalk and explicitly deferred work. No test, screenshot or generated contract alone signs a release gate.
