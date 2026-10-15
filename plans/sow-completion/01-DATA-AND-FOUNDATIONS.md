# Data and foundations

Authority: CORE-01..14, WF-01..04, NFR-03..09; docs 02/03/08/11/14 and the two 07 Oct database recons. Existing phase mapping: 0.1/0.2/0.4/0.5/0.6. Task aliases do not add new feature scope.

## Data contract — which point connects to what

`child.column → parent.column` is an FK target unless explicitly marked logical/proposed. IDs refer to internal records; e-code/name/email are not interchangeable.

| Subject/grain | Required relationships and semantics | Integrity/control |
|---|---|---|
| Legal entity | `core.employees.company_id → core.companies.id`; company holds e-code series and India-payroll flag | 14 raw names include RML alias; reconcile 13 canonical seeded entities against signed HR map. Holding/foreign classifications require confirmation |
| Operational placement | employees location/OU/cost-center → their masters; observed live additions include plant/HOD/MIS | Preserve existing composite company alignment. Recover missing migrations/types before using observed additions; location timezone/state selects calendar/statutory rules |
| Job | department/designation/grade → lookup IDs | Normalize via reviewed alias map; HR pay grade is not EMS domestic/international travel tier |
| Reporting | RM/functional manager → employees; closure `(manager_id,employee_id,depth)` | Allow cross-company hierarchy; reject cycles; scoped access comes from permission plus closure/OU, not matching company alone |
| Actor/account | `core.users.employee_id → employees.id`; user-role/role-permission links → users/roles/permissions | Service/admin accounts may be unlinked. Decide account cardinality; no guessed employee mapping or hard-delete of audited actors |
| History | employee_history.employee_id → employee; reference to workflow authorizing change | Immutable effective-date facts. Current master is a projection; never use today's department as an old payroll allocation |
| Family/education/prior employer | each child.employee_id → employee; education.document_id → documents | Family exists; education/prior-employment are specified but absent in the inspected prior live schema and current migration set. Create only after schema reconciliation |
| Files | documents.owner_employee_id → employee; uploaded_by → user; letters/policies/payslips/bills → document | One metadata registry and object key. Download checks parent entitlement and subject ownership, never just possession of document ID |
| Approvals | requests.subject_employee_id → employee; requested_by → user; definition_code → definitions; steps.request_id → request and approver_user_id → user | Request subject must equal domain row employee; actor may differ. Scope/authority required both when raised and acted |
| Audit | actor_user_id → user; scope_org_unit_id → OU; entity/id identify business target | Generic entity/id is a validated polymorphic link, not an FK to every table; masked values and version-aware hash chain |
| Settings/recipients | settings typed value + updater user; subscriptions event/kind/ref | Validate role/user/email references; audit updates; expose absent recipients as an error condition |

Detailed columns/types/purpose: docs/03. Actual historical 104-relation/1,028-field inventory and FK map: `docs/recon/database-relationships-2026-10-07.md`. That catalog is included to avoid hiding DB-only work. It is not a migration source or approval for unrelated modules.

## F01 — Reproducible schema, isolated tests and runtime readiness

**Why:** two models of reality currently coexist: 61 typed relations in source and 104 relations in the 07 Oct live catalog. Implementing against only one would duplicate claims/budgets or omit constraints.

**Reuse/read:** `backend/src/core/db/{database,types}.ts`, all checked-in migrations, `backend/scripts/verify-migrations.ts`, `backend/tests/{setup-database,global-database,employee-import.integration.test}.ts`, `backend/vitest.config.ts`, deployment scripts and independent package scripts. Current test setup/fixture cleanup contain safeguards; the historical audit described older unsafe code.

**Work, Stage 0.2 first:**

1. Read git state; never reset user work. Compare installed runtime/package engines/target PostgreSQL 16. The old audit found PG14/Node26; current runtime must be measured, not assumed.
2. Recover exact sources for applied migration prefixes 175206–175212 and 175214–175219 from authorized Git history/archives. Compare catalog definitions/constraints/triggers with recovered files. Do not invent replacement migrations from relation names.
3. Prove integration setup fails closed for application targets, including an explicit test URL equal to the app URL and misleading `_test` names. Name validation alone is not complete separation; verify host/database/role and known fixture environment. Use dedicated least-privilege test credentials. Retain fileParallelism=false for shared test audit chain.
4. Preserve the contaminated database/append-only history. Prepare a clean application target from reproducible forward migrations + sanctioned imports; obtain normal operational approval before replacing a used DB. No destructive rollback, disabled audit triggers or bulk fixture deletion in the business DB.
5. Reconcile all actual relations/columns/enum/nullability/defaults to types or explicitly classify as recovered, future, legacy/quarantined or out of scope. Add types only for authorized owned data models. No code access to unrepresented recovered tables until provenance/ownership is settled.
6. Validate constraints on clean data; inspect hot join/query plans, partitioning, pool limits, pg-boss pinned API, startup queue creation and migration rollback compatibility. Establish app/migration/report/test DB roles. API health liveness and DB readiness are separate checks.

**Output:** signed table reconciliation matrix: relation, source migration/hash, typed interface, owner, intended use, drift, forward repair, migration/test target. Current recons include DB-only `sec/cmp/prv/ird/doc` and scheduling additions; their specifications are missing from this checkout. Preserve/classify them, do not fabricate full MFA/privacy/POSH/grievance products. D12 resolves scope/source before implementation.

**Acceptance:** clean target can be built from repository sources; type/catalog parity report has no unexplained drift; test DB safeguards pass; no business DB mutated by tests; runtime and pool/role evidence recorded. Deployment/PgBouncer/restore work remains in its own applicable stage.

## F02 — Complete employee-master ownership and validation

**Theory:** EMS owns the best source identity/hierarchy snapshot; greytHR enriches verified HR/payroll fields. Neither authorizes fuzzy joins. HRMS becomes authoritative after reconciled import, with audited changes thereafter.

**Reuse:** `modules/employees/{import.schemas,import.service,employees.repository,employees.service,employees.router}.ts`; migration175181; directory/profile screens; `employee-import`, `directory-facets`, `employees-self`, `employees-masking` tests. Current `greythrRowSchema` checks date shape but accepts plain statutory/bank strings. Employee APIs provide reads, not a complete validated master-editor flow.

**Import transaction:** freeze source date/checksums → stage raw rows separately from operational records → canonicalize signed entity/ecode aliases → validate → upsert one employee on exact reviewed userid/ecode mapping → resolve RM/HOD in second pass → enrich field ownership → link account → write masked audit → reconciliation report. A proposed import-batch/error registry must be documented in docs03/CORE-12 before migration; existing summary types can serve dry runs first. Carry bcrypt hashes only through controlled import, never report/ZIP/log them.

**Validation specification:**

| Rule | Behavior required |
|---|---|
| E-code | DB atomic allocator for new joins; preserve verified legacy code on import; reject duplicate/invalid series; canonical mapping review for typos |
| DOB/service/category | Parse calendar date, reject future DOB; age/minor eligibility uses signed minimum-age/applicability policy; distinguish future onboarding DOJ from active employee; no automatic trainee/apprentice exemption from category text |
| PAN/Aadhaar/UAN/ESIC | Authorized format/checksum checks where applicable; duplicates per signed identity/legal-entity policy; optional until required by applicability; mask exceptions. Do not invent regex/checksum behavior for an identifier without an approved rule |
| Bank/IFSC | Normalize consistently; bank-account length is bank-dependent, not one guessed global length. Approved bank validation; mandatory for bank payment; explicit exception if cheque/hold |
| Department/designation | Reviewed normalization; retain original staging value; SOW's character-removal rule needs D09 so legitimate names are not silently corrupted |
| CTC | Backend sum of defined annual employee/employer costs equals entered annual CTC in paise; fixed vs variable/gratuity treatment signed under P01 |
| Cross-links | Employee placement belongs to selected company; no self-manager/cycle; request/ledger/document belongs to same subject |
| Active status | Every payroll/input roster uses effective eligibility; exited employees excluded from active operations; historical/alumni reads explicitly scoped |

**Master-edit transaction (proposed business API):** require existing `employee.write`, determine own permitted company/OU, lock/version-check subject, validate both current and new links, add effective history, apply permitted projection, rebuild hierarchy where needed, invalidate affected attendance approvals/dirty days, enqueue event and audit atomically. Compensation changes go to salary workflow under `salary.write`, not unrestricted employee edit. Future transfer uses L03 instead of early master overwrite.

**Screen:** extend `/people/:ecode` and directory with controlled editors: identity/contact; placement/reporting; family; education; previous employment; statutory/bank; documents; effective history. Show masked fields based on API permission. Each save shows effective date, changed fields and validation exceptions; import screen shows batch counts, per-entity reconciliation and rejected/unmatched rows. Compensation tab reads salary API, not client-side CTC math. No default-filled mandatory gaps.

**Acceptance:** each CORE-08 failure has independent expected test; duplicate concurrent e-code blocked; cross-company placement rejected; cross-entity reporting allowed without cycles; real source counts and every exception dispositioned; master fields complete before G0/G2. Tighten nullable columns/eligibility gates with staged forward migrations after enrichment, not blind NOT NULL against partial seed rows.

## F03 — Permissions, scope and audit consistency

**Reuse:** `api/orpc.ts`, `core/rbac/{employee-scope,permissions.service,seed-data}.ts`, RBAC/audit modules and admin screens. Test families: access-control, role-access, rbac-ceiling/seed, audit-read, employees-self.

One business permission per procedure is the current sponsor rule. Existing `withAnyPermission` reporting paths and business `authed` procedures differ from that rule; inventory and reconcile via D03. Preserve all required role access by changing data grants appropriately, not by hardcoding roles. New own-access permission codes require docs08/seed alignment; do not use admin permission merely to make ESS comply.

Scope is a server-side intersection: permitted subjects ∩ requested filters. Own from session-linked employee; subtree from closure; OU from role-grant scope and descendants; all only when granted. Export/raw-document/thread APIs get the same subject scope as their parent table. Client-supplied company/location/employee IDs never expand it. Aggregate CEO compensation does not expose individual compensation lines.

For actor history preserve accounts; reversible deactivation is distinct from login disablement and alumni restriction. Enforce duplicate-global-role grants despite nullable scope; decide one-login-per-employee cardinality. Workflow resubmission can repeat a stage: choose uniqueness including request revision/attempt before adding any simplistic unique request+step constraint.

Audit correction must preserve legacy v1 hashes and include historical scope for v2. Source175205 and later recovered chain ordering must be reconciled to deployed functions. Never rehash old rows just to pass a verifier. Security checks assert revoked access on next request, negative ID access, scope tamper detection and restricted-field masking.

**Screens:** access matrix shows effective permission/scope; audit screen shows masked changes, actor, time, historical scope and verification result; scope-filtered exports. Missing employee link is an actionable account issue, not permission to guess identity.

**Acceptance:** all business APIs have approved permission declarations and correct query scope; no unrelated subject access; historical audit verification explains versions; current runtime evidence replaces old findings only when proven.

## F04 — Delivered notifications and durable documents

**Reuse:** notifications service/repository, workflows, `jobs/worker.ts`, `core/storage/{storage,documents}.ts`, existing letter/policy APIs. Current delivery is dev-log; `getStorage()` selects local disk; no real S3 adapter. `processQueue` exists but isn't wired into worker. Existing per-event recipients are data, not role names in handlers.

**Notification transaction:** domain change + outbox/queue row must commit together; transport executes after commit. Current `processQueue` holds a DB transaction while sending; design a short claim/lease + external send + receipt update with crash/retry rules. Exactly-once external SMTP delivery is not guaranteed: deterministic event/recipient/channel keys and provider IDs reduce duplicates; expose ambiguous send outcomes for review. A proposed delivery receipt/lease structure needs a schema amendment under WF-02. Never mark a successful dev-log as production delivery.

Store queued/requested-at separately from provider-accepted/sent-at and read/delivery receipt where available. `notified_at` currently records enqueue time in workflow logic; preserve its historical meaning and add explicit proof rather than falsify receipts. For SLA start tied to intimation (especially OT), resolve D04; allow in-app intimation only if accepted policy says so. Prove missing/vacant recipients visibly, retry/dead-letter, and scoped event fan-out. Configure subscriptions with authorized owners; no email/Slack is sent by this planning task.

**Worker:** create each named queue before scheduling/work; register final hooks in API and worker; configure native schedules with explicit timezone behavior; add notification drain and leave year-end schedule after policy sign-off. Multiple scheduler instances must not duplicate domain postings. Monitor backlog, delay, receipts and source watermarks.

**Document transaction:** validate owner/type/MIME/size → upload immutable object key → register metadata/parent link → audit → response. Object store and Postgres do not share atomic commit; reconcile staged/orphan objects and failed DB writes. Production adapter uses S3/SeaweedFS; scoped expiring downloads; no direct global key URLs. Rendering failure must not turn a pending letter into issued or payroll outputs into ready. Content integrity/checksum/version/retention metadata is a proposed CORE-09/NFR-05 extension, requiring schema reconciliation with observed `doc` additions first.

**Screen:** IT integrations queue/dead-letter health and retry controls; approver/request timeline distinguishes queue/send/act; candidate link screen shows send/resend/completion; document lists show filename/type/date/status and authorized download; daily boarding archive shows report period and recipients including empty-day send.

**Acceptance:** receipt-backed SMTP/in-app journeys; clean-DB worker boot creates all queues; failure/retry duplicate tests; storage upload/download/authorization and restore verified; privacy-safe logs. External secrets supplied through approved operational configuration, never the portable plan.

<!-- DEEP-AUDIT -->
## Current code repair obligations (09 Oct deep review)

These are required additions to the relevant cards, not implementation ticks. Read [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md) for exact symbols/lines, transactions and independent acceptance cases. All PRD requirements are covered in [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md).

- **C01 — Permission scopes are not propagated consistently** (F03, F02): Build the per-procedure subject/company/OU/field scope map from docs08. Intersect filters with live grants, check both old and new placement on mutations, and resolve statutory/compensation grants separately. Preserve existing scoped muster/supporting report and audit queries; this finding does not say all routes are unscoped.
- **C02 — Generic workflow creation bypasses domain validation** (F03): Make domain endpoints the validated creation boundary. Decide whether the generic HTTP creator is needed; if retained, allow only approved definitions with exact zod payload, one permission, subject ownership and an atomic domain attachment. Final hooks must consume validated authoritative domain facts and fail closed on malformed/mismatched subject, rather than silently returning.
- **C03 — Workflow role queues ignore grant scope** (F03): Resolve role-holder eligibility against subject and action scope for notification, inbox, action, escalation and timeline. Preserve current request-step locking. Decide team-role notification semantics under D03/D04; do not hardcode new role names.
- **C04 — Resubmission and editable chains can diverge from domain facts** (F03): Specify request revision + validated domain revision and chain version/snapshot under D11. Atomically revalidate dates/balance/scope and synchronize domain facts on resubmit; link every step/event to the approved revision. Define explicit handling of already-open requests when administrators publish a new chain.
- **C05 — Delegation and step configuration need server invariants** (F03): Record delegation authority/ceiling/window policy and chain numbering/required-reason rules, then enforce server-side and at the DB where appropriate. Audit delegation atomically and preserve who delegated each actual step.
- **C09 — CO expiry misses the all-expired case and lapse jobs race** (F04): Specify signed FIFO/expiry allocation and year boundary, handle an empty live-credit set, and use serializable bucket handling plus deterministic job/posting identity. Preserve immutable postings and exact units; schedule year-end only after D02/D06.
- **C12 — Recompute flags are lost on process death after claim** (F04): Replace destructive claim with a durable lease/work-item acknowledgment protocol or execute an equivalent recoverable job model. Preserve new dirty revisions arriving while work runs. Treat configuration loading and crashes as replayable failures, not absent work.
- **C14 — Scheduled Kent sync always selects a mock under the real source key** (F04): Select the sanctioned real connector through environment/adapter configuration; fail startup/sync closed in production when it is absent. Keep simulation in explicit disposable/dev targets with distinct provenance and clock bounds. Reconcile historical simulated rows using approved read-only evidence before any repair proposal.
- **C16 — Notification receipt, drain and transport are incomplete** (F04): Complete F04 short durable leases, idempotent outbox keys, transport retry/backoff/dead-letter and provider/in-app receipts; create every queue on a clean DB before schedules. Resolve SLA intimation source D04. Required policy thresholds belong in validated settings.
- **C17 — Deployment does not start the worker and bypasses full verify** (F01, F04): Use an audited pinned artifact/commit deploy with staging full gates, schema compatibility, enabled actual worker entry, graceful jobs, freeze and readiness checks. Provide a tested pinned rollback/roll-forward runbook; do not turn on mock sync in production while fixing worker startup. Evidence backups/PITR restore and queue health separately.
- **C19 — Policy acknowledgement eligibility and KPI population disagree** (F03): Reuse one eligibility query for list, content, acknowledge, reminder, tile and export; record policy version/audience semantics under D11. Validate effective publication behavior, and preserve legitimate historical acknowledgements without counting them in an unrelated current population.
- **C20 — Letter creation is fragmented and merge identity is overridable** (F04): Define protected authoritative merge fields and allowed supplementary schema. Escape/render content according to MIME; stage object bytes and atomically create metadata+letter+workflow attachment+audit/outbox. Add versioned template/content provenance, rejection state and issuance eligibility; clean orphans through reviewed reconciliation, not deletion of approved history.
- **C21 — Several audited mutations commit before their audit/outbox** (F03, F02): Inventory every mutation in deep-code-index.json. Put domain state, masked audit and required outbox into one DB transaction, lock/version-check the affected record, inspect row counts and return its committed version. External effects use F04 outbox/object staging. Preserve already-atomic createRequest/act, asset assignment and ticket creation.
- **C22 — Refresh rotation is stateless and login failure increments race** (F03, F01): Clarify session/logout/replay policy with security under D03; implement approved token-family/revocation model if required, not an invented new MFA product. Make failure count/backoff atomic and policy-configured; recheck active account and scope per request. Avoid falsely attributing this stateless design to a proven frontend refresh-rotation collision.
- **C23 — HTTP contract does not meet the sponsor rule end to end** (F03, F01): Resolve D03 single permission grants without removing authorized personas; explicitly model empty input and exact schemas. Fail closed for missing required scope at business boundaries. Generate the frontend HTTP client from checked OpenAPI and align transport/error/envelope contracts; reserve unavailable/pending only for known missing modules.
- **C26 — Helpdesk allows unrelated users to read/reply by ticket ID** (F03): Specify ticket participation and agent population; check it before thread/reply/status/export. Mask/restrict internal notes independently. Resolve category role routing against subject scope instead of first role holder. Do not fix the leak by removing employee ability to report an issue.
- **C27 — Helpdesk receipt, escalation and historical SLA reporting are incomplete** (F04): Add approved escalation-recipient/level matrix and append-only SLA lifecycle evidence under D11. Make sweeps conditional/atomic with notification outbox, distinguish queue/receipt/ack, and define monthly hit-rate numerator/denominator including late resolved cases and reopen cycles.
- **C28 — Current backend verify gate is red; seed imports have side effects** (F01, F03): Separate pure settings seed data from executable CLI entry; no I/O on test import. Establish a sanctioned isolated reproducible test target, recover migrations, run all applicable integration suites and full coverage gate. Do not lower thresholds or claim DB/production acceptance from passing no-DB tests.
- **C29 — Historical migration/type divergence is not resolved by code inventory** (F01, F02): Recover original migration provenance and approved specs; classify every observed relation/field and reconcile types/constraints on a clean target before dependent schema work. Keep unrelated DB-only modules blocked on D12; no guessed replacement business schemas.
- **C31 — Master import/read implementation does not complete master governance** (F02): Implement the full signed F02 field ownership/validation/catalog/editor/import plan and C01 scope. Define deliberate active/onboarding populations and align facets/list without hiding exited discoverability. Account/entity normalization is approved mapping, not fuzzy inference.
- **C32 — Contextual help and training need an explicit completion card** (F03): Add W05 contextual help, one-page role guides and approved short walkthroughs tied to real permitted workflows. Keep implementation task/API details out of employee guidance. No LMS/appraisal product is added.
- **C33 — Reliability artifacts require operating proof** (F01, F04): Execute and retain docs14 tiered reliability evidence at the appropriate stages; role-separated DB credentials, pool/read/report topology, worker lag/dead-letter/device alarms, restore drill and real scale fixtures. Add payroll independent goldens/property/mutation/shadow checks as P02/P03 land. Avoid counting a configuration file as a completed operational control.
- **C34 — Engagement APIs need full structured survey and publisher surfaces** (F03): Resolve survey schema D11 and audience/scope rules; reuse existing anonymous dedupe, add approved publisher/editor/results/export screens and structured question/version/response model only after spec reconciliation. Do not derive recommendations from unspecified survey data under SOW194 without D08.
- **C36 — Absence/late alerts and scheduling semantics need full workflow coverage** (F04): Resolve automatic vs deliberate HR letter issuance under the spec and D04; implement idempotent per-day/policy alert keys, configured effective recipients/timezone/calendar and report partitioning by authorized audience. Reconcile gaps before absence action, retain due-date/case/history and actual receipt proof.
