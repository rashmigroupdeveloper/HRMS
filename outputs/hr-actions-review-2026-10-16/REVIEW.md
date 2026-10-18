# HR action safety review 16 October 2026

**HR operational actions are not all correct yet.** Native checks confirmed cross-entity attendance changes, false correction success on locked days, stale overtime after marking Absent, out-of-scope offer/asset Excel exports, partial onboarding commits, premature activation and false biometric verification. Managers remain blocked from direct attendance edits, and the tested scoped muster path behaves correctly.

This is an audit of attendance corrections, exports, onboarding, stakeholder tasks, absence-case escalation, letter access, HR dashboard and a leave-balance guard. It supplements [pack22](../other-module-review-2026-10-16/REVIEW.md) and [pack21](../sow-regression-review-2026-10-16/REVIEW.md). It changes no application source, config, test or migration and advances no phase gate. Findings include new concrete cases and native confirmation of previously open scope/onboarding issues; they are not all new discoveries or proven consequences of the bulk build.

## Action verdicts

| HR action | Result | Proven boundary or failure |
|---|---|---|
| Mark Present/Absent in own permitted unit | Works in the tested case | Actual day/source/reason and one audit persisted inside the rolled-back probe |
| Manager or ordinary employee marks Present/Absent | Correctly denied | Both403; managers must use employee-initiated approval flows |
| Scoped HR marks another entity | Unsafe |200 and the other employee’s day changed; H01 |
| A permission configured readonly marks attendance | Unsafe |200; central readonly grant still authorizes mutation; H02 |
| Mandatory reason and day locks | Incomplete | Whitespace accepted; individually locked day falsely returns200 with a new success audit; header lock blocks data but returns500; H03/H04 |
| Attendance derived values after correction | Incorrect | P with120 OT minutes→A still publishes2 OT hours in a freshly built muster; L→P keeps the old leave type; H05 |
| R1 muster filter and Excel | Passed selected checks | One permitted ecode in list/XLSX; other entity excluded from both. This does not certify every report or payroll total |
| R21 offers and R28 assets Excel | Unsafe | Other entity’s fixture exported to real workbooks; H07 |
| Candidate onboarding | Unsafe/incomplete | Cross-scope conversion, future employee activated, invalid date serialization, missing usable initial login/pay readiness; H06/H08/H09/H14 |
| Onboarding failure/retry | Incorrect | Login-email conflict leaves a committed employee and unconverted candidate; independently verified; H14 |
| IT onboarding tasks | Blocked for intended owner | IT owner gets403 on list/complete because both require full HR conversion permission; H11 |
| Verify biometric | False assurance | Task completion stamps verified with no Kent call; missing employee verification returns200; H10 |
| Absence case escalation and HR letter access | Unsafe | Scoped HR can access/escalate another entity case and read its employee letters; H12 |
| HR dashboard entity filter | Unsafe | Caller can select another entity’s counts; H13 |
| HR leave-balance read outside scope | Data guard works; error needs repair | Refused with500 instead of403; no balance disclosed in this probe |

## Evidence and test limits

[Native HTTP/PostgreSQL results](native-results.json) contain21 issue/behavior observations and10 passing control checks. The diagnostic exit0 confirms the observations and controls executed; it is not business acceptance. All fixtures in that run were rolled back, including users, companies, employees, candidate, locked-month header and audit rows. Sequences can advance on rollback. No append-only trigger was bypassed and no real notification was sent.

[Onboarding atomicity results](onboarding-atomicity-results.json) are a separate real-autocommit failure test, not hidden by the outer audit transaction. A different database pool observed the orphan employee before cleanup. Owned employee/candidate/company/master rows were removed afterwards; one synthetic collision-login remains disabled and detached under repository test conventions. No active fixture or partial business record remains. Only the sponsor-authorized loopback `hrms` test DB was used; no `hrms_test` or production access.

[Schema check](schema-check.json) remains132 parent relations /1,379 columns, with zero added/removed/changed column definitions. [All505 source hashes](source-comparison.json) match the prior full verification inventory. Unchanged schema does not resolve the older field-purpose, ledger or relational findings.

No full verify was rerun for this artifact-only audit. The identical application source last passed498 backend tests,246 frontend tests and both builds; backend full verify remains red at76.56% lines/71.84% branches against the unchanged80% floor. [React Doctor](react-doctor.txt) scanned onboarding, muster and attendance operations and produced five advisory warnings, not five confirmed additional bugs. No browser walkthrough or real Kent/SMTP/storage delivery acceptance was performed here.

## Findings and executable repair acceptance

### H01 Scoped HR can mark attendance in another entity

**P1 · Open · Phase 1 Stage 1.2 · ATT-17, CORE-10.**

An hr_ops fixture had all=false and exactly one permitted org unit. PUT /attendance/days/override changed a target in the other test entity and returned200. The route checks the permission but never intersects the target with permissionAccess. Valid same-unit HR writes also succeed and audit correctly.

Repair: Enforce live subject scope before mutation, preserve the manager prohibition, and recheck authority with the authoritative subject placement at the write boundary. Require an existing employee and an allowed correction period. Use existing employee/company/org relationships; no spare columns.

Acceptance: Same-unit HR succeeds; other unit/entity is403 with zero day/audit writes. Revocation and moved subjects take effect next request. Employee and manager-only roles remain403.

Sources: [backend/src/modules/attendance/attendance-config.router.ts:433](../../backend/src/modules/attendance/attendance-config.router.ts#L433); [backend/src/modules/attendance/day-status.service.ts:586](../../backend/src/modules/attendance/day-status.service.ts#L586). SOW: SOW-009, SOW-067, SOW-068.

### H02 A readonly permission grant still authorizes attendance writes

**P1 · Open · Phase 0 Stage 0.4 · CORE-10, ATT-17.**

A fixture custom role held only attendance.manual_override with scope=readonly; the write returned200. The central resolver maps readonly to all and the permission gate does not distinguish reading from mutation. This is a configured-readonly-grant failure, not a claim that every default read-only persona already holds this code.

Repair: Repair central action authority without widening row scope or removing legitimate read access. Business mutations must require write authority, and scope must retain its independent organization/own/subtree meaning. Reconcile the existing permission model and seed/runtime grant API together.

Acceptance: Readonly grants cannot mutate any protected business resource; full/scoped write grants still work. Test mixed additive roles, runtime revoke and real default role matrix across attendance, leave and onboarding.

Sources: [backend/src/core/rbac/permissions.service.ts:62](../../backend/src/core/rbac/permissions.service.ts#L62); [backend/src/api/orpc.ts:123](../../backend/src/api/orpc.ts#L123). SOW: SOW-009.

### H03 Whitespace satisfies the mandatory HR override reason

**P2 · Open · Phase 1 Stage 1.2 · ATT-17, CORE-11.**

A reason containing five spaces returned200 and persisted a manual correction. The API min(5) runs without trimming. A non-null DB reason is not evidence of a meaningful explanation.

Repair: Trim and validate the reason at both the public boundary and shared mutation boundary. Keep the existing meaningful-length requirement and store the normalized reason; reject before writes.

Acceptance: Empty, whitespace-only and too-short normalized reasons fail with a recoverable4xx and no mutation/audit; a meaningful reason is stored with actor/date/old/new evidence.

Sources: [backend/src/modules/attendance/attendance-config.router.ts:442](../../backend/src/modules/attendance/attendance-config.router.ts#L442); [backend/src/modules/attendance/day-status.service.ts:602](../../backend/src/modules/attendance/day-status.service.ts#L602). SOW: SOW-009, SOW-067.

### H04 A locked day reports successful correction and writes a misleading audit

**P1 · Open · Phase 1 Stage 1.2 · ATT-15, ATT-17, CORE-11.**

For an individually locked day without a month header, the upsert affects zero rows because its conflict WHERE rejects the update. The service ignores the affected result, returns200 and inserts a manual_override audit claiming the requested status; the day remainedP. Separately, a month-header lock correctly blocked a new row in PostgreSQL, but the API surfaced500 rather than a domain4xx. A locked month was not changed.

Repair: Check affected/returned rows and fail closed for protected rows. Check the company-month boundary using the same synchronization discipline as other attendance writes. Commit the actual mutation and truthful audit in one transaction; record the real day-record ID rather than employee ID as entity_id while retaining subject scope. Map locked/scope/input failures to accurate domain errors.

Acceptance: Existing locked row and header-only locked month both refuse changes with no success audit. Normal correction writes one audit with the actual affected row and old/new values. Concurrent month lock cannot admit a late unprotected write.

Sources: [backend/src/modules/attendance/day-status.service.ts:612](../../backend/src/modules/attendance/day-status.service.ts#L612); [backend/src/modules/attendance/day-status.service.ts:620](../../backend/src/modules/attendance/day-status.service.ts#L620). SOW: SOW-009, SOW-067, SOW-069.

### H05 Marking Absent leaves old overtime in the row and muster

**P1 · Open · Phase 1 Stage 1.2 · ATT-05, ATT-17, RPT-01.**

A valid P row with120 detected OT minutes was changed toA. ot_minutes stayed120, and a fresh muster build still reported2 OT hours. A separate L→P correction kept leave_type_id. penalty_flag also survives while swipe/late/early fields are cleared. These are stale derived facts; this audit does not claim they actually produced an OT payment.

Repair: Define/reset or recompute each derived attendance fact under the documented manual-precedence policy, using immutable swipe and approved request sources. Do not silently cancel a leave ledger posting or approved OT entitlement just by clearing a day field. Preserve the required cancellation/recovery workflow and make detected-vs-approved OT explicit. Ensure muster/report facts reflect the corrected day.

Acceptance: P with detected OT→A does not publish stale detection as current OT; L→P has consistent day classification, with explicit handling of existing approved leave. Sessions, penalty and WO eligibility remain internally consistent. Test a rebuild and the exact exported workbook, not only the status column.

Sources: [backend/src/modules/attendance/day-status.service.ts:599](../../backend/src/modules/attendance/day-status.service.ts#L599); [backend/src/modules/reports/muster.service.ts:155](../../backend/src/modules/reports/muster.service.ts#L155). SOW: SOW-003, SOW-053, SOW-067, SOW-068, SOW-069.

### H06 Onboarding dates and task dates are serialized incorrectly

**P2 · Open · Phase 3 Stage 3.1 · LC-01, LC-02, NFR-09.**

A stored DOJ2026-11-01 was returned as "Sun Nov 01". A stakeholder dueDate similarly came back as "Sat Oct 17". String(Date).slice(0,10) keeps the weekday/month text and loses the year; z.string output validation accepts it. The candidate list also exposed the other-entity candidate to scoped HR.

Repair: Use the existing calendar-safe date formatter for DATE and ISO serialization for timestamps. Apply the candidate/task scope model rather than returning all records. Validate semantic date contracts at the HTTP boundary.

Acceptance: Date input2026-11-01 round-trips as2026-11-01 in IST and UTC; leap/year boundaries remain correct. Actual API-shaped candidate/task data renders in forms without fallback/sample substitution.

Sources: [backend/src/modules/lifecycle/onboarding/onboarding.router.ts:178](../../backend/src/modules/lifecycle/onboarding/onboarding.router.ts#L178); [backend/src/modules/lifecycle/onboarding/onboarding.router.ts:307](../../backend/src/modules/lifecycle/onboarding/onboarding.router.ts#L307). SOW: SOW-025, SOW-127, SOW-132.

### H07 Offer and asset exports disclose data outside HR scope

**P1 · Open · Phase 1 Stage 1.7 · CORE-10, RPT-02, RPT-06, AST-01.**

Scoped HR requested the other test entity via companyId. Both R21 offers and R28 assets returned the foreign fixture row and generated a real XLSX containing it (200). These services accept scope but do not apply it. In the same test, R1 muster list/export correctly excluded the other entity and matched the allowed ecode filter.

Repair: Intersect caller grants with report population before list/export. Model pre-employee candidates and unassigned/third-party assets using their authoritative company/placement, rather than assuming every record has an employee join. Do not treat a client company filter as authorization or fix only the workbook. Preserve the functioning shared-filter muster path.

Acceptance: R21/R28 list and real XLSX contain only authorized records with and without companyId; empty grant scope fails closed. Verify candidate placement changes, unassigned assets, allowed filters, column parity and export audit. Extend the same review to remaining catalog routes; these two probes do not certify all exports.

Sources: [backend/src/modules/reports/reports.router.ts:882](../../backend/src/modules/reports/reports.router.ts#L882); [backend/src/modules/reports/reports.service.ts:914](../../backend/src/modules/reports/reports.service.ts#L914); [backend/src/modules/reports/reports.service.ts:1248](../../backend/src/modules/reports/reports.service.ts#L1248). SOW: SOW-009, SOW-022, SOW-069, SOW-182, SOW-197, SOW-198.

### H08 Scoped HR can convert another entity candidate and activate a future joiner

**P1 · Open · Phase 3 Stage 3.1 · CORE-06, CORE-10, LC-01, LC-02.**

The scoped HR actor converted an other-entity link_sent candidate with no completed prejoin intake. DOJ was1 Nov2026, yet the employee immediately became active on16 Oct and all five task due dates preceded DOJ. Employee.probation_due_date remained null even though a separate probation review was created. This proves missing scope/readiness/effective-date gates; any deliberate early HR override needs an explicit documented path.

Repair: Authorize both candidate source and target entity/unit; validate all master relationships and readiness. Retain preboarding/onboarding state until the configured DOJ transition and schedule stakeholder duties relative to the documented join lifecycle. Synchronize authoritative probation context. Do not invent an acceptance or no-show override without the governing decision.

Acceptance: Other-scope conversion rejected before allocation/write. Future joiners are excluded from active operational populations until due. Completed intake/approved overrides, DOJ activation, task due dates and probation views reconcile from one authoritative state.

Sources: [backend/src/modules/lifecycle/onboarding/onboarding.router.ts:210](../../backend/src/modules/lifecycle/onboarding/onboarding.router.ts#L210); [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:227](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts#L227); [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:282](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts#L282). SOW: SOW-009, SOW-025, SOW-031, SOW-127, SOW-129, SOW-132.

### H09 Conversion success does not guarantee a usable login, salary or task delivery

**P1 · Open · Phase 3 Stage 3.1 · CORE-11, LC-01, LC-02, PAY-07.**

Successful native conversion created an active login with PENDING_INITIAL_LOGIN, zero salary assignments when the optional structure was omitted, five tasks and no employee-creation audit row. The hardcoded admin_id_card task uses owner_role=admin, which has no matching role in the current catalog. Source has no task recipient/outbox fan-out; real delivery is not proven. Supplying a salary structure also writes empty component_amounts in source, retained as the earlier unresolved money finding rather than recalculated here.

Repair: Make conversion completion evidence explicit: secure login activation, valid effective salary assignment through the canonical money path, audit, sanctioned task owner/recipient and transactional notification enqueue. Use runtime definitions/settings for owners and SLA, not new hardcoded role names or guessed component values. Any money repair requires full docs04/10 and human review.

Acceptance: No complete/active success state with unusable identity/pay setup. Actual supported initial login path works; task owners exist and receive receipts; retry is idempotent. Independent salary goldens and component conservation precede money changes.

Sources: [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:304](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts#L304); [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:315](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts#L315); [backend/src/modules/lifecycle/onboarding/task-fanout.service.ts:43](../../backend/src/modules/lifecycle/onboarding/task-fanout.service.ts#L43). SOW: SOW-025, SOW-127, SOW-130, SOW-132, SOW-133, SOW-134.

### H10 Biometric completion can assert verification without Kent or an employee

**P1 · Open · Phase 3 Stage 3.1 · LC-02, CORE-11.**

Completing it_biometric set biometric_registered=true without any Kent connector call. POST /lifecycle/biometric/verify with a nonexistent employee also returned success200. The explicit verifier writes a note claiming Kent-feed verification while performing only DB updates. This rechecks R36 and adds the zero-row success case.

Repair: Separate task completion from independently verified enrollment evidence. Use the sanctioned KentConnector and fail closed when verification is unavailable; require existing in-scope employee, affected rows, actor and actual receipt. A local test/manual confirmation must be named and audited as such rather than claiming a real feed check.

Acceptance: Missing/out-of-scope employee refused; unavailable Kent cannot produce verified status. Only a matching real/mocked interface response under its explicit environment sets the evidence. Retry preserves first valid proof and does not forge a receipt.

Sources: [backend/src/modules/lifecycle/onboarding/task-fanout.service.ts:126](../../backend/src/modules/lifecycle/onboarding/task-fanout.service.ts#L126); [backend/src/modules/lifecycle/onboarding/task-fanout.service.ts:179](../../backend/src/modules/lifecycle/onboarding/task-fanout.service.ts#L179); [backend/src/modules/lifecycle/onboarding/onboarding.router.ts:334](../../backend/src/modules/lifecycle/onboarding/onboarding.router.ts#L334). SOW: SOW-010, SOW-127, SOW-132.

### H11 IT task owners cannot access or complete their onboarding tasks

**P1 · Open · Phase 3 Stage 3.1 · LC-02, CORE-10.**

An it_admin fixture, the declared owner_role for the generated IT tasks, received403 on both its IT task list and completion endpoint. Those endpoints require lifecycle.onboard.convert, a full HR conversion authority absent from IT. docs08 explicitly gives IT an onboarding IT-task queue while withholding general HR authority.

Repair: Define task-only access from the already documented IT/Admin/HR personas and enforce assignment/category plus organization scope. Keep one central permission per procedure. Do not grant IT all candidate/compensation/conversion access merely to unblock its checklist.

Acceptance: An IT owner can see/complete only permitted IT tasks and cannot read candidate compensation, convert employees, complete other department tasks or act outside assigned scope. HR supervision follows its approved authority and audit.

Sources: [backend/src/modules/lifecycle/onboarding/onboarding.router.ts:239](../../backend/src/modules/lifecycle/onboarding/onboarding.router.ts#L239); [backend/src/modules/lifecycle/onboarding/onboarding.router.ts:317](../../backend/src/modules/lifecycle/onboarding/onboarding.router.ts#L317); [backend/src/core/rbac/seed-data.ts:236](../../backend/src/core/rbac/seed-data.ts#L236). SOW: SOW-009, SOW-127, SOW-132.

### H12 HR absence cases and letter reads ignore organization boundaries

**P1 · Open · Phase 1 Stage 1.6 · CORE-09, CORE-10, ATT-10, ATT-11.**

Scoped HR saw the other-entity absence case and advanced it to warning (200), listed another entity employee’s letters and read the issued letter body (200). A normal employee was correctly denied that letter. The HR permission-membership path bypasses the scope that the same employee’s leave-balance route enforces.

Repair: Apply current employee subject scope consistently to queue, stage escalation, letter list, draft/content access, issue and export. Preserve owner-only issued-letter access and mandatory signature/workflow rules. Reject outside scope before storage reads or writes, and scope list/count together.

Acceptance: Other-unit/entity HR cannot inspect, escalate or issue against the subject; valid owner/HR still can. Drafts stay private, generic letter merge fields cannot spoof authoritative employee facts, and scoped leave/data refusal produces403 rather than a generic500.

Sources: [backend/src/modules/attendance/absence.router.ts:40](../../backend/src/modules/attendance/absence.router.ts#L40); [backend/src/modules/attendance/absence.router.ts:62](../../backend/src/modules/attendance/absence.router.ts#L62); [backend/src/modules/letters/letters.router.ts:115](../../backend/src/modules/letters/letters.router.ts#L115); [backend/src/modules/letters/letters.router.ts:134](../../backend/src/modules/letters/letters.router.ts#L134). SOW: SOW-009, SOW-023, SOW-044, SOW-182, SOW-218.

### H13 HR dashboard accepts an arbitrary other-entity filter

**P1 · Open · Phase 1 Stage 1.7 · CORE-10, RPT-04.**

Scoped HR selected the other temporary companyId and received200 with that entity’s headcount, including the newly converted future employee. The handler passes only companyId, not the resolved permission scope, to the dashboard service.

Repair: Compute each card from the authorized population intersected with optional filters; carry subject/company/unit scope through all queries and drill-downs. Keep operational and executive authorities distinct, and exclude future/inactive employees according to lifecycle rules.

Acceptance: Other entity or OU filters cannot broaden any card; counts/drill-downs agree. Same company with two permitted units is tested as well as separate entities. Empty authority is refused or an explicitly empty authorized result.

Sources: [backend/src/modules/reports/reports.router.ts:654](../../backend/src/modules/reports/reports.router.ts#L654); [backend/src/modules/reports/dashboard.service.ts:13](../../backend/src/modules/reports/dashboard.service.ts#L13). SOW: SOW-009, SOW-019, SOW-069.

### H14 Failed onboarding leaves a committed orphan employee

**P1 · Open · Phase 3 Stage 3.1 · LC-01, CORE-11, NFR-04.**

A separate real-autocommit probe ingested a candidate and attempted conversion with an already-used work email. The users insert failed with PostgreSQL23505. An independent pool still saw one committed employee, no new employee login, and the candidate remained link_sent with no employee link. The partial row was then removed from this test DB. A retry would hit the duplicate employee details created by the failed attempt.

Repair: Use one transaction for eligibility/duplicate recheck, locked candidate transition, shared ecode allocation, employee/login/salary/tasks/probation, audit and outbox. Preserve exactly-once links and uniqueness. Preflight validation helps error clarity but does not replace the transaction. External delivery follows the committed outbox.

Acceptance: Inject failure after each boundary and prove zero partial state from another connection. Retry succeeds once; simultaneous conversions of one candidate create one employee. Invalid/colliding user email leaves candidate, employee, salary and task state unchanged.

Sources: [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:269](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts#L269); [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:304](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts#L304). SOW: SOW-025, SOW-031, SOW-127, SOW-129, SOW-132.

## Data connections and repair order

Existing authoritative links should carry the fixes: runtime `role_permissions` plus `user_roles.scope_org_unit_id` → employee `company_id/org_unit_id`; `att.day_records(employee_id,work_date)` → month lock and real affected-row audit; `reporting.muster_month` → explicit month snapshot and the exact list/export query; `onboarding_candidates.employee_id` → employee → login/salary/tasks/probation; task `owner_role` → actual sanctioned role grants/recipients and notification outbox. Pre-employee candidates and unassigned assets need an explicit scoped population predicate using their existing company/placement facts. Do not add an arbitrary employee field to solve a report scope problem.

Follow AGENTS one announced stage at a time. Foundation Stage0.4 owns central readonly/action authority; Stage1.2 owns manual attendance mutation, real affected-row checking and derived facts; Stage1.6 owns absence/letter scope; Stage1.7 owns scoped export/dashboard populations; Stage3.1 owns atomic and usable onboarding plus stakeholder tasks. No implementation was silently spread across these stages in this review. Before money changes, read docs04/10 in full, add independent tests and obtain the mandatory human review.

The frontend does not currently contain a caller of `/attendance/days/override` in `frontend/src`; this review therefore proves an HR API capability, not a complete direct-marking screen journey. Onboarding also retains hardcoded company/master option IDs and sample rows after API failure. Those prior UI issues remain open; do not equate the existing page or toast with a verified employee creation. Muster explicitly presents a snapshot and a Rebuild control; its expected refresh workflow must remain clear when corrections are made.

[All176 SOW rows](sow-scope-current.json) preserve the prior original wording, statuses, policy decisions and claim/budget deferrals, with additional HR issue links. Manual-service clauses and SOW194 recommendations remain decisions/obligations rather than invented automated features. Earlier approval Hold for HR behavior and all pack19–22 financial/lifecycle/integration/coverage work remain in context. A passing selected action is not a blanket certification of every HR endpoint.
