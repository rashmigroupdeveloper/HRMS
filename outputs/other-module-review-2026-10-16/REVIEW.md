# Other module bug audit 16 October 2026

Seven additional concrete bug groups are confirmed in engagement, structured surveys and helpdesk state/report flows. Three older security/integrity issues remain reproducible. Two further observations require a defined metric/session policy before prescribing behavior. **These findings remain open; this increment changes no application source and applies no migration.**

This audit extends [the workflow regression review](../sow-regression-review-2026-10-16/REVIEW.md). It does not replace the earlier payroll/lifecycle findings, the sponsor’s Hold for HR decision, or deferred claim/budget scope. It does not certify the whole application as bug-free or attribute these bugs specifically to the last bulk build: this checkout already contained them at the prior source snapshot.

## Native evidence and practical limits

[Native results](native-results.json) contain 20 reproduced observations from real loopback HTTP and PostgreSQL calls, plus four passing controls. All fixture and application writes ran inside one intentionally rolled-back transaction. A post-rollback query found zero fixture users, employees, departments, tickets or audit rows. PostgreSQL sequence allocation can advance on rollback; no trigger was disabled and no real notification was sent. Only the sponsor-authorized local `hrms` test DB was used; `hrms_test` was not created.

The controls prove ordinary unrelated employees still receive403 on ticket threads, owners do not see internal notes, anonymous poll duplicate ballots are refused, and anonymous survey responses carry no user ID. These protections must survive repairs. A successful probe-script exit means the diagnostic observations and cleanup checks ran; it does **not** mean the application passed these acceptance cases.

[Catalog comparison](schema-check.json) still shows132 business parent relations and1,379 columns, with zero added, removed or changed column definitions. [Source comparison](source-comparison.json) matches all505 files from the previous full verification snapshot. No new DB fields were created. Field-purpose and relational/ledger weaknesses in pack18 remain open; unchanged schema is not proof of zero data slop.

[React Doctor](react-doctor.txt) scanned three affected screens and returned13 advisory warnings. They are not counted as confirmed bugs. API payload/result defects below are supported by native responses and the exact consuming expressions; no new browser walkthrough was done. The login-counter proof exercises two writes from one stale snapshot, not an HTTP stress test. The surrounding probe transaction does not prove each service is independently atomic.

## Confirmed findings and repair context

### O01 Company audience filtering is accepted but ignored

**P1 · New specific defect · Open · Phase 3 Stage 3.4 · EN-01, EN-02, EN-03.**

POST accepts and stores audience.companyIds, but the shared employee selector only tests category, department and location. An employee in another seeded entity received the announcement and successfully answered the restricted poll and survey (all HTTP200).

Repair: Use the existing employees.company_id relationship in the shared audience predicate. Enforce the same eligibility for feed and response writes. Validate recognized audience keys; do not silently broaden unsupported targeting. Apply the publisher’s existing authorized organization scope separately from the selected audience.

Acceptance: Two entities with otherwise identical employees: only the addressed entity sees/answers all three surfaces. Combined company/department/location filters intersect. Empty/invalid audience and exited/unlinked accounts follow explicitly documented rules.

Evidence: [backend/src/modules/engagement/engagement.router.ts:46](../../backend/src/modules/engagement/engagement.router.ts#L46); [backend/src/modules/engagement/audience.ts:21](../../backend/src/modules/engagement/audience.ts#L21). SOW connections: SOW-190, SOW-191, SOW-193.

### O02 Duplicate survey question IDs make different questions share one answer

**P2 · New specific defect · Open · Phase 3 Stage 3.4 · EN-03.**

Create accepts two questions with id=q (HTTP200). Required checks and analytics use find(questionId), so a single answer can satisfy and be displayed for multiple questions. The screen derives IDs from questions.length+1; removing a middle question then adding another can also reuse an existing ID.

Repair: Validate unique immutable question IDs before persistence and on authoritative definition reads. Allocate a unique screen ID independent of array length. Reject ambiguous legacy definitions explicitly; do not invent a mapping for already recorded answers.

Acceptance: Duplicate IDs rejected before insert; q1,q2,q3 → remove q2 → add preserves unique IDs. Multiple valid questions map to separate required checks and result rows.

Evidence: [backend/src/modules/engagement/surveys.service.ts:108](../../backend/src/modules/engagement/surveys.service.ts#L108); [frontend/src/pages/workplace/EngagementPage.tsx:1327](../../frontend/src/pages/workplace/EngagementPage.tsx#L1327). SOW connections: SOW-193, SOW-194.

### O03 Survey answers are not validated against published questions

**P1 · New specific defect · Open · Phase 3 Stage 3.4 · EN-03.**

API accepts a choice not in options and adds it to the distribution; accepts two answers for one question and silently counts the first; accepts rating="banana" as a required answer with totalAnswers=1 but avgRating=null; accepts an unknown question on an optional survey and counts a participant with no real answers. Each write returned HTTP200.

Repair: Validate the whole response against the stored question definition: known IDs, at most one answer per question, required answers, exact choice membership and correct type. Use the agreed rating scale and limits; do not add a new hardcoded policy. Reuse validation for analytics and handle invalid historical rows explicitly without silently correcting them. Preserve HMAC dedupe and no-actor audit for anonymous responses.

Acceptance: Each malformed case rejected without response insertion or hasResponded becoming true. Correct boundary/optional answers tally exactly; named and anonymous duplicate submissions remain refused.

Evidence: [backend/src/modules/engagement/surveys.service.ts:245](../../backend/src/modules/engagement/surveys.service.ts#L245); [backend/src/modules/engagement/surveys.service.ts:298](../../backend/src/modules/engagement/surveys.service.ts#L298). SOW connections: SOW-193, SOW-194.

### O04 Restricted policies can be read and acknowledged outside their audience

**P1 · Reconfirmed existing issue · Open · Phase 3 Stage 3.4 · CORE-13, EN-04.**

Outside-department employee received policy content and recorded acknowledgment (HTTP200). With one target and two acknowledgers the tile reported200%, while the detail report correctly contained one row. This is native confirmation of C19, not a newly discovered issue.

Repair: Reuse authoritative policy eligibility for content, acknowledgment, pending list, reminders, tile and detail/export. Count acknowledgments within the exact eligible population. Preserve historical acknowledgments and resolve version/audience-change semantics under existing D11 before changing schema.

Acceptance: Outside audience cannot read/ack guessed policy IDs. Tile/detail/reminders reconcile after valid acknowledgment and employee moves. Repeated valid acknowledgment keeps first timestamp.

Evidence: [backend/src/modules/policies/policies.router.ts:113](../../backend/src/modules/policies/policies.router.ts#L113); [backend/src/modules/policies/policies.service.ts:146](../../backend/src/modules/policies/policies.service.ts#L146); [backend/src/modules/policies/policies.service.ts:174](../../backend/src/modules/policies/policies.service.ts#L174). SOW connections: SOW-003, SOW-016, SOW-017, SOW-018, SOW-019.

### O05 Helpdesk agent permission bypasses category boundaries

**P1 · Reconfirmed residual issue · Open · Phase 3 Stage 3.4 · HD-01, NFR-03.**

An it_admin fixture held helpdesk.agent but no payroll role or ticket assignment. It read a payroll-category internal note, posted a reply and resolved that ticket (HTTP200). Ordinary unrelated employee access is correctly refused403; the remaining gap is the overly broad agent path. This narrows older C26 to the actual residual defect.

Repair: Resolve category-assignee/escalation roles from runtime category and role-grant data, intersect with authorized subject organization, and enforce before queue, thread, reply, state mutation and export. Preserve legitimate raiser access independently of internal-note visibility. Do not hardcode roles in handlers or treat arbitrary client category filters as authorization.

Acceptance: IT-only agent cannot inspect/modify payroll or other-OU tickets; eligible assigned/category agent can. Runtime grant revocation applies on next request. Owner sees only public messages. Escalated recipient access follows the approved category rules.

Evidence: [backend/src/modules/helpdesk/helpdesk.router.ts:119](../../backend/src/modules/helpdesk/helpdesk.router.ts#L119); [backend/src/modules/helpdesk/helpdesk.router.ts:153](../../backend/src/modules/helpdesk/helpdesk.router.ts#L153); [backend/src/modules/helpdesk/helpdesk.router.ts:201](../../backend/src/modules/helpdesk/helpdesk.router.ts#L201). SOW connections: SOW-009, SOW-078, SOW-181, SOW-182, SOW-208, SOW-213, SOW-216, SOW-217.

### O06 Resolved tickets can be reopened through pending without a reason or counter

**P2 · New specific defect · Open · Phase 3 Stage 3.4 · HD-01.**

Reopening validation only recognizes target status=open. Sending resolved→pending without a reason succeeds200, clears resolution/resolved_at, and leaves reopen_count=0. The alternative active state bypasses the explicit reopen rule.

Repair: Define allowed transitions once and apply the reopening rule to every closed/resolved→active transition. Require/preserve a reason and increment once under a row lock or conditional transition. Commit state, audit and outbox together. Preserve prior cycle evidence under the approved history design.

Acceptance: Both open and pending targets from resolved/closed require a reason and record exactly one reopening. Concurrent/repeated requests cannot double increment or overwrite another state.

Evidence: [backend/src/modules/helpdesk/helpdesk.service.ts:382](../../backend/src/modules/helpdesk/helpdesk.service.ts#L382). SOW connections: SOW-213, SOW-214, SOW-216.

### O07 Administrative closure rewrites resolution time and changes historical SLA results

**P2 · New specific defect · Open · Phase 3 Stage 3.4 · HD-01, RPT-06.**

A ticket resolved before its SLA deadline became late when later moved resolved→closed. Every target resolved/closed sets resolved_at=now(), so even a repeated resolve or administrative closure rewrites the original first-resolution fact.

Repair: Preserve the recorded resolution instant when closing an already resolved cycle; distinguish closure from resolution using the approved model. Make repeated same-state requests idempotent and preserve reopen-cycle history. Keep reporting and exports based on the same authoritative timeline.

Acceptance: On-time resolve→later close stays an on-time resolution; actual late resolution remains late. Repeated resolve/close cannot change resolution duration or duplicate notifications. Reopen/resolution cycles remain explainable.

Evidence: [backend/src/modules/helpdesk/helpdesk.service.ts:394](../../backend/src/modules/helpdesk/helpdesk.service.ts#L394). SOW connections: SOW-213, SOW-214, SOW-216.

### O08 Internal notes currently count as the first response

**P2 · Observed behavior requiring metric definition · Open · Phase 3 Stage 3.4 · HD-01.**

An internal-only note stamped first_response_at and changed status to pending while the owner’s thread had zero visible messages. The behavior is proven; whether R29 means first internal handling or first customer-visible response must be defined explicitly.

Repair: Document the R29 metric meaning before changing it. If it means customer first response, stamp only a qualifying public agent reply and retain internal handling as a separate fact only if an approved model requires it. Do not silently rename the metric or add speculative fields.

Acceptance: Internal/public first actions reconcile to the signed metric definition; simultaneous replies cannot move the first timestamp later.

Evidence: [backend/src/modules/helpdesk/helpdesk.service.ts:330](../../backend/src/modules/helpdesk/helpdesk.service.ts#L330). SOW connections: SOW-214.

### O09 Login failure increments can be lost on stale reads

**P1 · Reconfirmed existing issue · Open · Phase 0 Stage 0.4 · NFR-03.**

Two repository calls given the same initial failure count0 leave failed_attempts=1. This deterministic stale-read interleaving reproduces lost counting, not an end-to-end concurrent HTTP load test. Authentication reads the old counter before password comparison and passes it to this setter.

Repair: Make increment and lockout/backoff computation atomic in the database and driven by approved settings. Coordinate successful-login reset with failed attempts. Audit the actual committed outcome and keep uniform public failure responses.

Acceptance: Simultaneous failed requests produce the exact count and lock at the configured threshold. Success/reset and failure races follow an explicit rule; correct password stays refused during a live lock.

Evidence: [backend/src/modules/auth/auth.repository.ts:46](../../backend/src/modules/auth/auth.repository.ts#L46); [backend/src/modules/auth/auth.service.ts:58](../../backend/src/modules/auth/auth.service.ts#L58). SOW connections: SOW-009.

### O10 The original refresh token remains valid after refresh

**P2 · Observed behavior requiring session policy · Open · Phase 0 Stage 0.4 · NFR-03.**

The same original refresh token was accepted twice. Code signs a fresh token but has no used-token/session-family invalidation. This is known stateless behavior, not a newly proven violation of a signed logout/replay policy.

Repair: Resolve D03 session rotation, logout and replay guarantees with the existing security contract before designing persistence. Do not invent a session table or claim token-family protection already exists. Preserve deactivated-user rejection and short-lived access-token checks.

Acceptance: After policy is locked, replay/logout/concurrent refresh/deactivation follow that policy and the browser coordinates refreshes without dropping a valid session.

Evidence: [backend/src/modules/auth/auth.service.ts:96](../../backend/src/modules/auth/auth.service.ts#L96); [backend/src/core/auth/jwt.ts:44](../../backend/src/core/auth/jwt.ts#L44). SOW connections: SOW-009.

### O11 Survey screens disagree with create, response and result contracts

**P1 · New concrete contract failures · Open · Phase 3 Stage 3.4 · EN-03, CORE-10.**

The screen creates choice questions with choices, but backend expects options (native matching payload400); sends answers as an object, but backend expects an array (400); reads q.choices from definitions carrying options, so choices disappear; maps result.questionResults while backend returns questions, causing an undefined.map path. Nested result and date names also differ: averageRating/distribution/textSamples and opensAt/closesAt vs avgRating/ratingDistribution/textAnswers and openFrom/openTill. Native HTTP and source expressions confirm contract defects; this pass did not perform a browser walkthrough.

Repair: Align the frontend with the emitted OpenAPI schema through the approved generated client. Reconcile create/read/respond/results together, preserve empty/error/closed/anonymous states, and avoid backend-source imports or fake response adapters. Ensure optional questions stay optional and question IDs remain stable.

Acceptance: Real backend DTO component/browser tests: create all question types, display choices, submit, dedupe, open analytics with named/anonymous and empty results. Include remove/add question sequence and authorization of result controls.

Evidence: [frontend/src/pages/workplace/EngagementPage.tsx:80](../../frontend/src/pages/workplace/EngagementPage.tsx#L80); [frontend/src/pages/workplace/EngagementPage.tsx:973](../../frontend/src/pages/workplace/EngagementPage.tsx#L973); [frontend/src/pages/workplace/EngagementPage.tsx:1165](../../frontend/src/pages/workplace/EngagementPage.tsx#L1165); [frontend/src/pages/workplace/EngagementPage.tsx:1225](../../frontend/src/pages/workplace/EngagementPage.tsx#L1225); [frontend/src/pages/workplace/EngagementPage.tsx:1333](../../frontend/src/pages/workplace/EngagementPage.tsx#L1333); [backend/src/modules/engagement/engagement.router.ts:314](../../backend/src/modules/engagement/engagement.router.ts#L314). SOW connections: SOW-193, SOW-194.

### O12 Helpdesk performance screen formats a nonexistent API field

**P1 · New concrete contract failure · Open · Phase 3 Stage 3.4 · HD-01, RPT-06.**

Backend returns numeric resolutionRatePct; screen declares resolutionRatePercent and calls toFixed(1) on it. The native response lacks that field, making the cell render expression throw for a nonempty result. Generic apiFetch<Performance[]> is a TypeScript assertion, not runtime validation. No browser walkthrough was performed in this pass.

Repair: Consume the real typed HTTP response field and protect genuine unavailable values according to the contract. Add a component test with an actual API-shaped row, not a fixture duplicating the incorrect frontend interface. Keep report/export filters and numbers identical.

Acceptance: Nonempty native-shaped R29 response renders without errors and matches export; empty/error states work. Late-resolved rows are not labeled SLA met simply because resolved_at is non-null (additional source concern at HelpdeskPage105/293).

Evidence: [frontend/src/pages/workplace/HelpdeskPage.tsx:814](../../frontend/src/pages/workplace/HelpdeskPage.tsx#L814); [backend/src/modules/helpdesk/helpdesk.router.ts:233](../../backend/src/modules/helpdesk/helpdesk.router.ts#L233). SOW connections: SOW-214.

## Execution boundaries and remaining work

The next implementation must announce and finish one owning stage under AGENTS. This review itself performs no cross-stage build. Phase0 Stage0.4 owns the authentication counter/session-policy and existing central readonly-authority issues. Phase3 Stage3.4 owns the audience, policy, ticket and survey repairs; its acceptance remains open. Verify each repair through the real HTTP contract and database, with meaningful regression tests, then run the affected project’s full verify without lowering thresholds.

Most confirmed fixes use existing relationships: `core.users.employee_id → core.employees` for audience eligibility, `employees.company_id/department_id/location_id` for targeting, `core.policy_acknowledgments(policy_id,employee_id)` for eligible compliance totals, `hd.tickets.category_id → hd.categories` and runtime role grants for agent access, and `eng.surveys.questions → survey_responses.answers` for exact answer validation. These defects do not justify adding spare fields or a second source of truth. Any new history/session model still needs its existing documented decision resolved first.

Additional source observations outside this increment remain tracked rather than repaired: assets with `not_returned` still close custody and return to stock (C18); allocation rejects lost/scrapped but allows maintenance status; asset registry/export/maintenance calls do not uniformly enforce organization scope. Employee import still requires full identity/reimport/history acceptance; no import or live external access was performed. Existing financial/lifecycle/API/coverage gaps in pack21/19 remain open. Claims and budgets remain deferred by the sponsor.

All [176 original SOW rows](sow-scope-current.json) retain their prior wording/status/decisions and gain exact finding links where applicable. An issue’s SOW links identify affected capabilities, not completion of the whole commercial row. SOW194 recommendations and the other previously unresolved policy/model decisions remain decisions; no invented recommendation engine was added.

The previous unchanged-source verification remains backend498 tests and a passing separate build, frontend246 tests/full verify passing. **Backend full verify is still red at76.56% line and71.84% branch coverage against the unchanged80% floor.** No new full verify was run for this artifact-only audit; [verification.json](verification.json) records the boundary. No phase or release gate advances.
