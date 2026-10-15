# Actual code audit — open repairs and completion evidence

Prepared 09 Oct 2026. This extends the original capability checklist using current code, rather than accepting plan ticks or documentary claims. All 338 rg-visible backend/frontend project files plus four root deployment/CI files were read/indexed (342 files; 320 AST-parsed TS/JS files). Source/test/config/lock/documentation files are included; dependencies, ignored build products, private environment values, live databases and external EMS/ATS source are excluded. The index contains 153 API declarations, 957 Kysely relation-operation locators and 115 frontend HTTP/resource call sites. Reading/indexing every file is **not a claim that every line has been manually proven correct**. Critical business paths were manually traced below; integration/UAT remains explicit.

Machine evidence: `deep-code-index.json` (every file hash/functions/imports/DB operations/transactions/controls), `api-contract-audit.json` (39 missing explicit input declarations; all outputs declared), `screen-api-index.json` (screen calls and route candidates), `code-audit-findings.json` (this backlog), and [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md) (every PRD requirement and master-build task). Literal-path matching is a locator; indirect calls and complete schema/authorization still require reading the handler.

## Fresh verification — no gate is silently passed

| Check | Result / boundary |
|---|---|
| Frontend `npm run verify` | Passed: typecheck, lint, knip, 23 test files / 233 tests, production build. Bundle-size warning remains; no full browser/UAT/contrast/performance proof. |
| Backend `TEST_DATABASE_URL='' DATABASE_URL='' npm run verify` | Static typecheck/lint/knip/dependency-cruiser passed. 10 files / 88 tests passed, 29 files / 164 DB tests skipped. Coverage failed: statements/lines29.98%, functions19.17%, branches87.33%, below required overall floors. Exit1, verify not green. Local HTTP test sandbox failure was resolved by approved rerun; it is not the remaining failure. |
| Backend `npm run build` | Separate build passed; verify had stopped at coverage and had not reached its build step. |
| Database / deployment / money acceptance | No application DB changed or re-audited. No real connector, SMTP, payment, migration rehearsal, payroll golden engine, UAT or phase gate certified. |

The original SOW workbook was not altered. The assessment workbook/07 baseline categories remain a historical capability snapshot (12 implemented/43 partial/86 pending/29 manual/6 decisions). The open repairs below qualify those capabilities: they must **not** be treated as safe completed flows merely because a function exists. Pack11 uses conservative partial/pending/open acceptance verdicts.

## Repair order within the existing stages

Start F01 (existing 0.2) with reproducible migration/test baseline and C28/C29/C17. Then separate authorized stage sessions: F03 scope/domain authority (C01–C05/C22/C23/C26), F04 delivery/worker/durability (C12/C14–C17), A02–A05 transaction/policy/report safety (C06–C13/C25/C36), and W01–W05 repairs/extensions (C18–C21/C24/C26/C27/C31–C35) in their original stages. Payroll depends on the corrected attendance/leave/approval spine. A dependency repair does not authorize jumping a gate or building several stages at once.

| ID | Priority | Current code gap | Completion cards |
|---|---|---|---|
| C01 | High | Permission scopes are not propagated consistently | [F03](01-DATA-AND-FOUNDATIONS.md), [F02](01-DATA-AND-FOUNDATIONS.md), [W01](05-WORKPLACE-AND-ANALYTICS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [L01](04-LIFECYCLE-AND-FNF.md) |
| C02 | High | Generic workflow creation bypasses domain validation | [F03](01-DATA-AND-FOUNDATIONS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C03 | High | Workflow role queues ignore grant scope | [F03](01-DATA-AND-FOUNDATIONS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C04 | High | Resubmission and editable chains can diverge from domain facts | [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F03](01-DATA-AND-FOUNDATIONS.md) |
| C05 | Medium | Delegation and step configuration need server invariants | [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F03](01-DATA-AND-FOUNDATIONS.md) |
| C06 | High | OT workflow decision and domain posting are split | [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md) |
| C07 | High | Leave reservations and RH caps are not serialized | [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C08 | High | Approved request write-back can silently skip attendance | [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md) |
| C09 | High | CO expiry misses the all-expired case and lapse jobs race | [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F04](01-DATA-AND-FOUNDATIONS.md) |
| C10 | High | Accrual fidelity and manager approval conflict remain | [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C11 | High | Month lock omits dirty-queue and expected-day completeness | [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md) |
| C12 | High | Recompute flags are lost on process death after claim | [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F04](01-DATA-AND-FOUNDATIONS.md) |
| C13 | High | HR manual status retains stale derived links | [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C14 | High | Scheduled Kent sync always selects a mock under the real source key | [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F04](01-DATA-AND-FOUNDATIONS.md) |
| C15 | High | Lossless feed and concurrent source watermark need completion | [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C16 | High | Notification receipt, drain and transport are incomplete | [F04](01-DATA-AND-FOUNDATIONS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [L01](04-LIFECYCLE-AND-FNF.md) |
| C17 | High | Deployment does not start the worker and bypasses full verify | [F01](01-DATA-AND-FOUNDATIONS.md), [F04](01-DATA-AND-FOUNDATIONS.md) |
| C18 | High | An unreturned asset becomes reusable stock | [W01](05-WORKPLACE-AND-ANALYTICS.md), [L04](04-LIFECYCLE-AND-FNF.md) |
| C19 | High | Policy acknowledgement eligibility and KPI population disagree | [W03](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md) |
| C20 | High | Letter creation is fragmented and merge identity is overridable | [W03](05-WORKPLACE-AND-ANALYTICS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md), [L02](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md) |
| C21 | High | Several audited mutations commit before their audit/outbox | [F03](01-DATA-AND-FOUNDATIONS.md), [F02](01-DATA-AND-FOUNDATIONS.md), [W01](05-WORKPLACE-AND-ANALYTICS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C22 | Medium | Refresh rotation is stateless and login failure increments race | [F03](01-DATA-AND-FOUNDATIONS.md), [F01](01-DATA-AND-FOUNDATIONS.md) |
| C23 | High | HTTP contract does not meet the sponsor rule end to end | [F03](01-DATA-AND-FOUNDATIONS.md), [F01](01-DATA-AND-FOUNDATIONS.md) |
| C24 | High | Approval deep links may show and act on a different request | [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |
| C25 | High | Attendance/report figures use incomplete or wrong source semantics | [W04](05-WORKPLACE-AND-ANALYTICS.md), [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md) |
| C26 | High | Helpdesk allows unrelated users to read/reply by ticket ID | [W02](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md) |
| C27 | High | Helpdesk receipt, escalation and historical SLA reporting are incomplete | [W02](05-WORKPLACE-AND-ANALYTICS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md) |
| C28 | High | Current backend verify gate is red; seed imports have side effects | [F01](01-DATA-AND-FOUNDATIONS.md), [F03](01-DATA-AND-FOUNDATIONS.md) |
| C29 | High | Historical migration/type divergence is not resolved by code inventory | [F01](01-DATA-AND-FOUNDATIONS.md), [F02](01-DATA-AND-FOUNDATIONS.md) |
| C30 | High | Pending screens and workflow definitions are not domain implementations | [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [P05](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [L02](04-LIFECYCLE-AND-FNF.md), [L03](04-LIFECYCLE-AND-FNF.md), [L04](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md), [T01](06-TRAVEL-ATS-AND-MOBILE.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md), [T03](06-TRAVEL-ATS-AND-MOBILE.md), [T04](06-TRAVEL-ATS-AND-MOBILE.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md), [X01](06-TRAVEL-ATS-AND-MOBILE.md) |
| C31 | High | Master import/read implementation does not complete master governance | [F02](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md), [L03](04-LIFECYCLE-AND-FNF.md), [P01](03-PAYROLL-LOANS-CLAIMS.md) |
| C32 | Medium | Contextual help and training need an explicit completion card | [W05](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md) |
| C33 | Medium | Reliability artifacts require operating proof | [F01](01-DATA-AND-FOUNDATIONS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md) |
| C34 | Medium | Engagement APIs need full structured survey and publisher surfaces | [W03](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md) |
| C35 | Medium | Money discipline must include asset costs and future obligations | [W01](05-WORKPLACE-AND-ANALYTICS.md), [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md) |
| C36 | Medium | Absence/late alerts and scheduling semantics need full workflow coverage | [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [F04](01-DATA-AND-FOUNDATIONS.md) |
| C37 | High | Routine day updates and locking invalidate manager sign-off | [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md) |

## C01 — Permission scopes are not propagated consistently

**Requirement anchors:** CORE-10, NFR-03. **Reuse/repair cards:** [F03](01-DATA-AND-FOUNDATIONS.md), [F02](01-DATA-AND-FOUNDATIONS.md), [W01](05-WORKPLACE-AND-ANALYTICS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [L01](04-LIFECYCLE-AND-FNF.md).

**Actual source:** `backend/src/modules/employees/employees.service.ts:232`, `backend/src/modules/employees/employees.repository.ts:244`, `backend/src/modules/reports/reports.router.ts:742`, `backend/src/modules/assets/assets.router.ts:55`, `backend/src/modules/leave/leave.router.ts:123`.

**Observed:** Employee directory/profile/facets, asset operations, leave administration and several dashboard handlers use the permission gate but do not carry the resolved data scope into subject queries. BU input filters are entirely client-selected. Employee statutory unmask infers global access from payroll permission membership rather than resolving its scope.

**Required theoretical/technical completion:** Build the per-procedure subject/company/OU/field scope map from docs08. Intersect filters with live grants, check both old and new placement on mutations, and resolve statutory/compensation grants separately. Preserve existing scoped muster/supporting report and audit queries; this finding does not say all routes are unscoped.

**Independent acceptance:** Restricted OU grant cannot enumerate/read/edit/export another OU by direct URL, e-code, employee ID or company filter; own reads remain valid; revoke applies next request. Verify all affected handlers and scoped field projection.


## C02 — Generic workflow creation bypasses domain validation

**Requirement anchors:** CORE-10, WF-01, LV-03, LV-06. **Reuse/repair cards:** [F03](01-DATA-AND-FOUNDATIONS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/src/modules/workflows/workflows.router.ts:20`, `backend/src/modules/leave/leave-apply.service.ts:352`.

**Observed:** Any authenticated caller can pass any active definitionCode, arbitrary payload and another employee subject. The encashment hook accepts numeric leaveTypeId/days without independently establishing encashability, applicant entitlement or a validated domain submission. A crafted request can enter a financial approval chain; vacant-chain completion can apply it immediately.

**Required theoretical/technical completion:** Make domain endpoints the validated creation boundary. Decide whether the generic HTTP creator is needed; if retained, allow only approved definitions with exact zod payload, one permission, subject ownership and an atomic domain attachment. Final hooks must consume validated authoritative domain facts and fail closed on malformed/mismatched subject, rather than silently returning.

**Independent acceptance:** Unrelated subject, unknown payload keys, non-encashable leave type, malformed days and raw generic domain bypass all fail without request/ledger rows; legitimate domain creation and vacant-chain policy remain tested.


## C03 — Workflow role queues ignore grant scope

**Requirement anchors:** CORE-10, WF-01, WF-02. **Reuse/repair cards:** [F03](01-DATA-AND-FOUNDATIONS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/src/modules/workflows/workflow.service.ts:85`, `backend/src/modules/workflows/workflow.service.ts:151`, `backend/src/modules/workflows/workflow.service.ts:430`.

**Observed:** Role recipient selection picks the lowest active role holder. Role inbox/action eligibility uses role codes without the grant OU/subtree scope for the request subject. Thus a scoped holder can see/act outside the intended population. The timeline audit.read fallback also checks membership without resolved subject scope.

**Required theoretical/technical completion:** Resolve role-holder eligibility against subject and action scope for notification, inbox, action, escalation and timeline. Preserve current request-step locking. Decide team-role notification semantics under D03/D04; do not hardcode new role names.

**Independent acceptance:** Two holders of the same role in different OUs see/act only eligible requests; scoped audit fallback cannot read unrelated payload; transfer/revocation between queueing and action is rechecked.


## C04 — Resubmission and editable chains can diverge from domain facts

**Requirement anchors:** WF-01, WF-04, LV-03, ATT-06. **Reuse/repair cards:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F03](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/workflows/workflow.service.ts:323`, `backend/src/modules/workflows/workflow.service.ts:161`, `backend/src/modules/workflows/workflows.router.ts:220`.

**Observed:** Resubmit changes only wf.requests.payload and restarts the chain. Leave/AR dates, reservation and domain row remain unchanged. getSteps reads the current editable definition while a request is in flight; future approvers may therefore change mid-chain without a request version.

**Required theoretical/technical completion:** Specify request revision + validated domain revision and chain version/snapshot under D11. Atomically revalidate dates/balance/scope and synchronize domain facts on resubmit; link every step/event to the approved revision. Define explicit handling of already-open requests when administrators publish a new chain.

**Independent acceptance:** Send back, change dates/amount/type, resubmit: inbox, domain row, reservation and final effect agree. Mid-chain config edit cannot silently authorize a different version. History includes all attempts.


## C05 — Delegation and step configuration need server invariants

**Requirement anchors:** WF-01, CORE-10. **Reuse/repair cards:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F03](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/workflows/workflows.router.ts:179`, `backend/src/modules/workflows/workflow.service.ts:41`.

**Observed:** Delegation rejects self only at the API; recipient permission/scope eligibility and conflicting windows are not established. Step numbers are positive but uniqueness/contiguous ordering is not enforced by stepsSchema. API rejection/send-back comments are optional while the inbox requires a reason.

**Required theoretical/technical completion:** Record delegation authority/ceiling/window policy and chain numbering/required-reason rules, then enforce server-side and at the DB where appropriate. Audit delegation atomically and preserve who delegated each actual step.

**Independent acceptance:** Ineligible/deactivated delegate, overlapping/cyclic delegation per approved policy, duplicate/noncontiguous step numbers, and missing required action reason fail without state changes.


## C06 — OT workflow decision and domain posting are split

**Requirement anchors:** ATT-08, LV-04, WF-01. **Reuse/repair cards:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md).

**Actual source:** `backend/src/modules/attendance/overtime.service.ts:201`, `backend/src/modules/attendance/overtime.service.ts:164`, `backend/src/modules/attendance/attendance-requests.router.ts:155`, `backend/src/modules/leave/leave-core.service.ts:124`.

**Observed:** decideOvertime commits act() in one transaction, then refines status/minutes/CO in another. It ignores the act outcome, so an advanced multi-step chain can already produce an approved/CO domain entry. For workflow-less entries the pending UPDATE affected-row count is ignored and the service does not establish manager/subject authority; a racing lapse can still be followed by a CO credit. Deadline is enforced by sweeps rather than checked on every decision.

**Required theoretical/technical completion:** Carry validated requested minutes and pay-vs-CO choice as authoritative decision facts. Apply final workflow state, OT status, unique CO posting, audit and outbox in the same final transaction. Recheck authority, pending state and accepted intimation deadline under D04/D06. Intermediate approval must not authorize payment/credit; add one posting key per OT entry and inspect affected rows.

**Independent acceptance:** Two-step chain leaves domain pending after step1; crash after final approval cannot leave full rather than partial minutes; simultaneous lapse/approve/CO grants exactly one outcome; unauthorized workflow-less decision fails; pay and CO cannot both post.


## C07 — Leave reservations and RH caps are not serialized

**Requirement anchors:** LV-03, LV-06, LV-08, LV-09. **Reuse/repair cards:** [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/src/modules/leave/leave-apply.service.ts:91`, `backend/src/modules/leave/leave-apply.service.ts:323`, `backend/src/modules/leave/leave-apply.service.ts:241`, `backend/src/modules/leave/leave-apply.service.ts:386`, `backend/migrations/1751880000000_leave.ts:72`.

**Observed:** Balance/overlap/open-request/RH-count checks occur before createRequest starts its transaction. Different requests can both observe the same available balance or cap. Application date ordering and workflow uniqueness exist, but a date-overlap exclusion/reservation serialization does not. Cancellation replacement can race too.

**Required theoretical/technical completion:** Choose one employee/type reservation locking protocol shared by leave, encash, cancellation, RH and relevant jobs. Validate and reserve inside the creation transaction, revalidate on final approval, and add approved overlap/idempotency constraints with explicit half-session semantics. Keep ledger balances derived; do not add mutable balance counters.

**Independent acceptance:** Concurrent non-overlapping applications cannot overspend one balance; overlapping applications fail; leave vs encash, duplicate cancellation and concurrent Nth RH are deterministic; approval after a balance change follows D06.


## C08 — Approved request write-back can silently skip attendance

**Requirement anchors:** ATT-15, LV-03, LV-08, LV-09, ATT-06. **Reuse/repair cards:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md).

**Actual source:** `backend/src/modules/attendance/regularization.service.ts:153`, `backend/src/modules/leave/leave-apply.service.ts:178`, `backend/src/modules/leave/leave-apply.service.ts:273`, `backend/src/modules/leave/leave-apply.service.ts:431`.

**Observed:** Final hooks use conflict-WHERE is_locked=false and/or source<>manual, then mark domain application/applied or post ledger effects without proving every intended write succeeded. Cancellation credits the leave ledger while skipping locked-day changes. Pre-submit checks on existing day rows do not establish company-month lock safety when rows are absent.

**Required theoretical/technical completion:** Share the company-month synchronization boundary between lock and request finalization. Define manual precedence and post-lock cancellation/retro policy under D05/D11. Count intended/applied days explicitly; either complete approved effects atomically, reject/defer, or create an approved historical correction obligation. Never claim applied when protected rows were silently skipped.

**Independent acceptance:** Lock vs final approval race, already locked month with no day row, protected HR override, locked leave cancellation and RH all preserve ledger/attendance/payroll consistency and truthful application state.


## C09 — CO expiry misses the all-expired case and lapse jobs race

**Requirement anchors:** LV-04, LV-05. **Reuse/repair cards:** [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F04](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/leave/leave-core.service.ts:163`, `backend/src/modules/leave/leave-core.service.ts:201`, `backend/migrations/1751880000000_leave.ts:61`.

**Observed:** The expiry expression subtracts SUM(delta) FILTER(live positive credits) without COALESCE. If every credit has expired the filtered SUM is NULL, so the lapse expression yields no positive lapse. Read-then-insert lapse/year-end sweeps have no shared bucket lock or unique lapse posting key. Accrual has its own DB uniqueness; it must be preserved.

**Required theoretical/technical completion:** Specify signed FIFO/expiry allocation and year boundary, handle an empty live-credit set, and use serializable bucket handling plus deterministic job/posting identity. Preserve immutable postings and exact units; schedule year-end only after D02/D06.

**Independent acceptance:** Only-expired positive balance lapses; mixed spent/live/expired and zero balances have hand-derived results; two concurrent sweeps and retries post one lapse; year-end rerun does not lose newly accrued credits.


## C10 — Accrual fidelity and manager approval conflict remain

**Requirement anchors:** ATT-12, LV-02. **Reuse/repair cards:** [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/src/modules/leave/leave-core.service.ts:73`, `backend/src/modules/settings/seed.ts:137`, `backend/src/modules/attendance/month-lock.service.ts:47`.

**Observed:** Accrual uses current active/on_notice status and a full accrual_per_month, with service-month/gender/category gates but no mid-month proration/effective historical eligibility. Its exception query finds A/UAB, not missing manager approval/completeness. Manager approval is seeded and defaulted false for month lock. ATT-12/LV-02 and docs04/13 credit semantics conflict.

**Required theoretical/technical completion:** Resolve D02 with HR, including proration, missing attendance and approval readiness. Implement the signed eligibility/exception queue contract and effective dates; enforce mandatory manager lock precondition if the approved spec retains it. Do not silently choose either contradictory credit rule.

**Independent acceptance:** Mid-month join/exit, future/backdated accrual, missing day rows, unapproved manager and retry cases match signed worked examples; UI explains credit queued/credited/flagged state.


## C11 — Month lock omits dirty-queue and expected-day completeness

**Requirement anchors:** ATT-03, ATT-12, ATT-15. **Reuse/repair cards:** [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md).

**Actual source:** `backend/src/modules/attendance/month-lock.service.ts:39`, `backend/src/modules/attendance/month-lock.service.ts:219`.

**Observed:** The lock checklist covers pending old requests, unmatched swipes, devices, manager setting and watermarks, but has no recompute_queue or expected employee-day completeness check. Pending AR/OT age queries are company-wide rather than restricted to the selected month; unmatched swipes are global for that month. An empty dirty/incomplete roster can pass despite a fresh watermark.

**Required theoretical/technical completion:** Add scoped completeness and dirty-work blockers, accepted carry decisions, effective eligible population and source reconciliation. Lock/recompute/final hooks must share synchronization so evidence cannot turn stale between checklist and commit. Preserve current device coverage and advisory-lock protections.

**Independent acceptance:** Dirty cancellation/roster day blocks lock; missing scheduled day blocks lock; another month/entity cannot spuriously block; concurrent new swipe or final approval cannot enter a falsely complete frozen month.


## C12 — Recompute flags are lost on process death after claim

**Requirement anchors:** ATT-03, NFR-04. **Reuse/repair cards:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F04](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/attendance/day-status.service.ts:552`.

**Observed:** The queue is claimed with DELETE RETURNING SKIP LOCKED before recomputing. New dirty flags survive, which fixes the previous concurrent-delete race. However a process crash after committed deletion, or policy-loading failure before the per-item try/catch, loses claimed work; caught item failures alone are requeued.

**Required theoretical/technical completion:** Replace destructive claim with a durable lease/work-item acknowledgment protocol or execute an equivalent recoverable job model. Preserve new dirty revisions arriving while work runs. Treat configuration loading and crashes as replayable failures, not absent work.

**Independent acceptance:** Kill after claim and before compute; throw while loading policy; dirty a day during compute; concurrent workers and restart all eventually process the latest revision exactly as deterministic source recomputation.


## C13 — HR manual status retains stale derived links

**Requirement anchors:** ATT-17, ATT-08, LV-03. **Reuse/repair cards:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/src/modules/attendance/day-status.service.ts:586`.

**Observed:** Manual override clears punches/work/late/early/session data but does not clear or reconcile day_records.ot_minutes and leave_type_id. A changed day can still display or aggregate stale OT/leave provenance. Existing approved ledger/OT effects need an explicit correction path, not deletion.

**Required theoretical/technical completion:** Define source precedence and correction obligations for each derived field and linked posting. Apply permitted manual state plus invalidation/dirty dependencies/audit atomically; retain approved historical money through delta corrections.

**Independent acceptance:** Override a leave day and a detected/approved OT day: day fields, reports, ledger and future pay consumption remain explainable and cannot imply duplicate paid leave or OT.


## C14 — Scheduled Kent sync always selects a mock under the real source key

**Requirement anchors:** ATT-01, ATT-02, NFR-08. **Reuse/repair cards:** [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [F04](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/attendance/kent-sync.job.ts:19`, `backend/src/modules/attendance/kent-sync.job.ts:17`, `backend/src/modules/attendance/kent-connector.ts:65`.

**Observed:** connectorFor always constructs MockKentConnector. The scheduled/on-demand pipeline writes simulated current-day punches using source kent; there is no production connector selection/fail-closed guard. The mock exposes a whole day including future receipt times and completeness. This is a current source risk separate from dated contaminated DB evidence.

**Required theoretical/technical completion:** Select the sanctioned real connector through environment/adapter configuration; fail startup/sync closed in production when it is absent. Keep simulation in explicit disposable/dev targets with distinct provenance and clock bounds. Reconcile historical simulated rows using approved read-only evidence before any repair proposal.

**Independent acceptance:** Production missing connector refuses to write; mock never impersonates real feed; real-day source counts, lag, overlap, no-gap watermark, buffer/offline/backfill and duplicate ingestion are proved before G0/G1.


## C15 — Lossless feed and concurrent source watermark need completion

**Requirement anchors:** ATT-01, ATT-02, ATT-14, ATT-16. **Reuse/repair cards:** [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/src/modules/attendance/kent-connector.ts:9`, `backend/src/modules/attendance/ingest.service.ts:33`.

**Observed:** RawSwipe and insert mapping carry only a subset of the specified export fields; shift/remarks/GPS/mobile/permission fields supported by report/type columns are not populated by this contract. Source watermark reads before the transaction and upserts the precomputed value directly, so overlapping cycles can regress it. Per-device watermark uses GREATEST and remains a credited protection.

**Required theoretical/technical completion:** Document every raw field, immutable identity and duplicate key with the actual Kent source. Preserve lossless payload/field provenance. Serialize source fetch/advance or use a monotonic concurrency-safe receipt cursor without mistaking it for completeness. Unmatched reconciliation must preserve immutable original events and supply a safe mapping design under D07.

**Independent acceptance:** Full sanctioned sample round-trips fields; late/duplicate/unknown employee events retained; two delayed concurrent cycles cannot regress source cursor or device completeness; cross-plant attribution and GPS do not change mapped cost center.


## C16 — Notification receipt, drain and transport are incomplete

**Requirement anchors:** WF-02, WF-03, LC-03. **Reuse/repair cards:** [F04](01-DATA-AND-FOUNDATIONS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [L01](04-LIFECYCLE-AND-FNF.md).

**Actual source:** `backend/src/modules/notifications/notifications.service.ts:91`, `backend/src/modules/notifications/notifications.repository.ts:32`, `backend/src/jobs/worker.ts:66`.

**Observed:** Only dev-log transport exists; processQueue is not registered in worker. It holds the transaction across external send and retries failed rows without a scheduled backoff timestamp. MAX_ATTEMPTS is hardcoded. Workflow notified_at/helpdesk acknowledged_at are queue-time facts. KPI and helpdesk named queues are scheduled/worked but omitted from explicit createQueue list.

**Required theoretical/technical completion:** Complete F04 short durable leases, idempotent outbox keys, transport retry/backoff/dead-letter and provider/in-app receipts; create every queue on a clean DB before schedules. Resolve SLA intimation source D04. Required policy thresholds belong in validated settings.

**Independent acceptance:** Clean worker boot, recipient absence, concurrent drains, provider send succeeded then DB crash, transient failures, dead-letter recovery and receipt-backed approver acknowledgment all have visible outcomes.


## C17 — Deployment does not start the worker and bypasses full verify

**Requirement anchors:** NFR-05, NFR-06, LV-02, WF-02. **Reuse/repair cards:** [F01](01-DATA-AND-FOUNDATIONS.md), [F04](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `ecosystem.config.cjs:12`, `scripts/deploy.sh:29`, `.github/workflows/ci.yml:54`.

**Observed:** PM2 only enables API processes; worker/scheduler entries are commented and their example dist/worker.js path differs from emitted dist/jobs/worker.js. deploy.sh runs backend typecheck/test and frontend build rather than both full verify gates. Its documented rollback calls the same script that pulls origin main, defeating a pinned previous SHA. CI has a dedicated native PG16/migration/test workflow; its latest run has not been verified here.

**Required theoretical/technical completion:** Use an audited pinned artifact/commit deploy with staging full gates, schema compatibility, enabled actual worker entry, graceful jobs, freeze and readiness checks. Provide a tested pinned rollback/roll-forward runbook; do not turn on mock sync in production while fixing worker startup. Evidence backups/PITR restore and queue health separately.

**Independent acceptance:** Staging deploy starts API+worker correctly, full checks fail closed, freeze prevents mutation, pinned rollback stays pinned, interrupted jobs resume, and real backup/restore evidence meets the documented RPO/RTO.


## C18 — An unreturned asset becomes reusable stock

**Requirement anchors:** AST-04, AST-05, AST-06. **Reuse/repair cards:** [W01](05-WORKPLACE-AND-ANALYTICS.md), [L04](04-LIFECYCLE-AND-FNF.md).

**Actual source:** `backend/src/modules/assets/assets.service.ts:335`, `backend/src/modules/assets/assets.service.ts:368`, `backend/migrations/1751980000000_assets-module.ts:54`.

**Observed:** not_returned is an allowed return condition, but returnAsset stamps returned_at for all outcomes and puts every non-damaged outcome into in_stock. assetsHeldByEmployee/nonReturnedByLeavers filter returned_at IS NULL, so the unreturned item disappears from outstanding custody and is allocatable again.

**Required theoretical/technical completion:** Model physical receipt separately from not-returned/loss/dispute disposition. Keep outstanding custody and clearance blocked until signed recovery/write-off decision; resolve approved recovery through F&F obligation, never through inventory status alone. Add row/state locks and transition guards so return/loss/assignment cannot race.

**Independent acceptance:** not_returned remains visible to clearance/nonreturned dashboard and cannot reallocate; actual ok/damaged returns change stock correctly; concurrent return/loss/assign has one valid custody history.


## C19 — Policy acknowledgement eligibility and KPI population disagree

**Requirement anchors:** CORE-13, EN-04, RPT-04. **Reuse/repair cards:** [W03](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/policies/policies.service.ts:148`, `backend/src/modules/policies/policies.service.ts:158`, `backend/src/modules/policies/policies.service.ts:261`.

**Observed:** Acknowledgement only checks an active policy exists, not whether it targets that employee. The KPI denominator uses targeted employees while numerator counts all active acknowledgers; the detailed report does intersect targets. Direct unrelated acknowledgement or changed audiences can make tile/report disagree and even exceed 100%.

**Required theoretical/technical completion:** Reuse one eligibility query for list, content, acknowledge, reminder, tile and export; record policy version/audience semantics under D11. Validate effective publication behavior, and preserve legitimate historical acknowledgements without counting them in an unrelated current population.

**Independent acceptance:** Guessing another department policy ID cannot acknowledge/read it; tile/report/reminder populations match; transfers/audience edits/version changes produce explicit historical vs current results.


## C20 — Letter creation is fragmented and merge identity is overridable

**Requirement anchors:** CORE-09, CORE-11, LC-06. **Reuse/repair cards:** [W03](05-WORKPLACE-AND-ANALYTICS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md), [L02](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md).

**Actual source:** `backend/src/modules/letters/letters.service.ts:72`, `backend/src/modules/letters/letters.service.ts:85`, `backend/src/modules/letters/letters.service.ts:88`.

**Observed:** Document creation, letter insertion, workflow creation and audit occur in separate commits. extraFields spreads after resolved employee fields and can override e-code/name/company; rendered HTML interpolation is unescaped. Failure can leave an orphan/pending letter or misleading official content. Production PDF rendering and lifecycle eligibility are still missing.

**Required theoretical/technical completion:** Define protected authoritative merge fields and allowed supplementary schema. Escape/render content according to MIME; stage object bytes and atomically create metadata+letter+workflow attachment+audit/outbox. Add versioned template/content provenance, rejection state and issuance eligibility; clean orphans through reviewed reconciliation, not deletion of approved history.

**Independent acceptance:** Actor cannot override authoritative employee identity; markup input is safe; fail each creation boundary without an issued/orphan business record; final signature issues exactly the validated version; clearance gates exit letters.


## C21 — Several audited mutations commit before their audit/outbox

**Requirement anchors:** CORE-11, NFR-04. **Reuse/repair cards:** [F03](01-DATA-AND-FOUNDATIONS.md), [F02](01-DATA-AND-FOUNDATIONS.md), [W01](05-WORKPLACE-AND-ANALYTICS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/src/modules/settings/settings.service.ts:38`, `backend/src/modules/assets/assets.service.ts:178`, `backend/src/modules/leave/leave-core.service.ts:239`, `backend/src/modules/helpdesk/helpdesk.service.ts:307`, `backend/src/modules/engagement/announcements.service.ts:34`.

**Observed:** These functions write sensitive/domain state and subsequently writeAudit or enqueue using the root DB. An audit/outbox failure can leave a committed state despite an error response. The shared audit trigger/hash chain is valuable, but cannot cover a domain write whose audit insert never commits.

**Required theoretical/technical completion:** Inventory every mutation in deep-code-index.json. Put domain state, masked audit and required outbox into one DB transaction, lock/version-check the affected record, inspect row counts and return its committed version. External effects use F04 outbox/object staging. Preserve already-atomic createRequest/act, asset assignment and ticket creation.

**Independent acceptance:** Inject audit/outbox failure for each mutation and prove no unlogged business state; concurrency audit old/new values match actual committed transition; retries use a stable operation key.


## C22 — Refresh rotation is stateless and login failure increments race

**Requirement anchors:** NFR-03, CORE-10. **Reuse/repair cards:** [F03](01-DATA-AND-FOUNDATIONS.md), [F01](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/auth/auth.service.ts:78`, `backend/src/core/auth/jwt.ts:29`, `backend/src/modules/auth/auth.repository.ts:41`, `backend/src/modules/auth/auth.router.ts:86`.

**Observed:** Refresh signs another token but has no session/token-family persistence, jti or used-token invalidation; old refresh remains valid until expiry if the account is active. Logout clears the cookie only. Login failure uses a previously read counter, so simultaneous failed attempts can overwrite increments; backoff and token lifetimes are hardcoded.

**Required theoretical/technical completion:** Clarify session/logout/replay policy with security under D03; implement approved token-family/revocation model if required, not an invented new MFA product. Make failure count/backoff atomic and policy-configured; recheck active account and scope per request. Avoid falsely attributing this stateless design to a proven frontend refresh-rotation collision.

**Independent acceptance:** Concurrent failed attempts cannot lose counts; locked/deactivated users cannot refresh; captured old refresh after use/logout follows the signed replay policy; frontend multiple 401 handling is tested against the actual contract.


## C23 — HTTP contract does not meet the sponsor rule end to end

**Requirement anchors:** CORE-10, NFR-03. **Reuse/repair cards:** [F03](01-DATA-AND-FOUNDATIONS.md), [F01](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `frontend/src/lib/api.ts:32`, `backend/src/api/orpc.ts:93`, `backend/src/core/rbac/employee-scope.ts:10`.

**Observed:** All 153 procedures declare output, but 39 lack an explicit input declaration (many are no-payload operations). Business authed and withAnyPermission paths remain; withAnyPermission selects the first held permission rather than combining documented scopes. employeeScopeSql(undefined) is unrestricted. Frontend manually casts JSON generics and has no OpenAPI-generated client. Express terminal errors use error while the helper reads message.

**Required theoretical/technical completion:** Resolve D03 single permission grants without removing authorized personas; explicitly model empty input and exact schemas. Fail closed for missing required scope at business boundaries. Generate the frontend HTTP client from checked OpenAPI and align transport/error/envelope contracts; reserve unavailable/pending only for known missing modules.

**Independent acceptance:** Contract generation/schema parity check, malformed output/input, missing scope, two differently scoped grants, revoked permission, body-too-large error, and all existing ESS/admin callers have correct typed behavior.


## C24 — Approval deep links may show and act on a different request

**Requirement anchors:** WF-04, WF-01. **Reuse/repair cards:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `frontend/src/pages/approvals/ApprovalsPage.tsx:55`.

**Observed:** If /approvals/:id is missing from the loaded inbox, item falls back to inbox[0]. A stale/deep link can therefore display and act on a different request. The screen also lacks a full historic request load/resubmission path despite the timeline/resubmit backend endpoints. Batch approval is separate calls with no per-item committed outcome summary.

**Required theoretical/technical completion:** Resolve route ID exactly; load authorized detail/timeline for that ID, show unavailable/decided/forbidden state explicitly, and never silently substitute an actionable request. Add validated domain correction/resubmit screens after C04. Show batch per-item outcomes/retry-safe selection.

**Independent acceptance:** Unknown/closed/forbidden request ID cannot act on first inbox row; historic deep link displays correct record and timeline; partially failed batch accurately identifies succeeded/failed records.


## C25 — Attendance/report figures use incomplete or wrong source semantics

**Requirement anchors:** RPT-01, RPT-03, RPT-04, LV-07, ATT-08. **Reuse/repair cards:** [W04](05-WORKPLACE-AND-ANALYTICS.md), [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md).

**Actual source:** `backend/src/modules/reports/muster.service.ts:195`, `backend/src/modules/reports/kpi-snapshot.service.ts:48`, `backend/src/modules/reports/dashboard.service.ts:298`.

**Observed:** Muster charges every HD as 0.5 LOP even when its leave_type_id denotes paid half-day leave. Muster/KPI/BU OT sums detected day-record minutes rather than finalized approved OT. KPI annualized attrition uses current active headcount, and historical-date rebuilds read current placement/status for several metrics. HR/BU dashboards perform live aggregations; processed-row absenteeism denominator hides missing scheduled days.

**Required theoretical/technical completion:** Define authoritative payable-session units and approved OT aggregation under D05/D06, effective population/history and exact docs06 denominators. Use validated immutable/snapshot inputs with freshness metadata and drilldowns; preserve unavailable nulls until payroll/contract inputs exist. Snapshot/filter/export populations must remain consistent after transfers.

**Independent acceptance:** Paid vs unpaid half-day leave, half work/absence, CO-vs-pay OT, sparse days, mid-period join/exit/transfer and historic rebuild each match independent expected population/amount; scoped tile drilldown matches exported rows; load targets proved.


## C26 — Helpdesk allows unrelated users to read/reply by ticket ID

**Requirement anchors:** HD-01, NFR-03. **Reuse/repair cards:** [W02](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/helpdesk/helpdesk.router.ts:125`, `backend/src/modules/helpdesk/helpdesk.router.ts:148`, `backend/src/modules/helpdesk/helpdesk.service.ts:267`.

**Observed:** Thread/reply are authed; only internal-note visibility/flag checks agent permission. They do not require caller to be raiser, authorized assignee/agent or another approved participant. Agent queue/status/performance also do not apply resolved organization/subject scope.

**Required theoretical/technical completion:** Specify ticket participation and agent population; check it before thread/reply/status/export. Mask/restrict internal notes independently. Resolve category role routing against subject scope instead of first role holder. Do not fix the leak by removing employee ability to report an issue.

**Independent acceptance:** An unrelated employee guessing a ticket ID cannot read/reply; scoped agent cannot cross OU; raiser and valid agent retain permitted conversation; audit exports preserve internal-note restrictions.


## C27 — Helpdesk receipt, escalation and historical SLA reporting are incomplete

**Requirement anchors:** HD-01, WF-03. **Reuse/repair cards:** [W02](05-WORKPLACE-AND-ANALYTICS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md).

**Actual source:** `backend/src/modules/helpdesk/helpdesk.service.ts:83`, `backend/src/modules/helpdesk/helpdesk.service.ts:368`, `backend/src/modules/helpdesk/helpdesk.service.ts:404`.

**Observed:** acknowledged_at is stamped before actual notification delivery. Escalation increments a counter and notifies the same assignee; concurrent sweeps are not protected by a conditional state transition. Performance breach count only includes unresolved tickets whose due time has passed, losing resolved-late historical breaches. Reopening clears resolution timestamps without an immutable per-cycle event model.

**Required theoretical/technical completion:** Add approved escalation-recipient/level matrix and append-only SLA lifecycle evidence under D11. Make sweeps conditional/atomic with notification outbox, distinguish queue/receipt/ack, and define monthly hit-rate numerator/denominator including late resolved cases and reopen cycles.

**Independent acceptance:** Resolved-late ticket remains a breach; reopen history survives; two sweep workers produce one level/outbox; higher escalation reaches its sanctioned eligible recipient; reports reconcile to event histories.


## C28 — Current backend verify gate is red; seed imports have side effects

**Requirement anchors:** NFR-04, NFR-03. **Reuse/repair cards:** [F01](01-DATA-AND-FOUNDATIONS.md), [F03](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/settings/seed.ts:214`, `backend/tests/settings-seed.test.ts:18`, `backend/vitest.config.ts:17`, `backend/tests/setup-database.ts:5`.

**Observed:** Fresh frontend verify passes 233 tests. Backend verification with TEST_DATABASE_URL and DATABASE_URL explicitly empty passes static checks and 88 tests, skips 164 DB tests, and fails coverage: lines/statements29.98%, functions19.17%, branches87.33%. Separate backend build passes. settings-seed.test imports seed.ts, whose main runs immediately; the test logs invalid DB env and could seed an allowed target merely from import. Current dedicated *_test protection is present and must be preserved.

**Required theoretical/technical completion:** Separate pure settings seed data from executable CLI entry; no I/O on test import. Establish a sanctioned isolated reproducible test target, recover migrations, run all applicable integration suites and full coverage gate. Do not lower thresholds or claim DB/production acceptance from passing no-DB tests.

**Independent acceptance:** Importing seed definitions never opens/writes DB or sets process exit state. Full verify on dedicated target reaches required coverage and build; app-target/collision safeguards fail closed; skipped suites and environment reasons explicitly reported.


## C29 — Historical migration/type divergence is not resolved by code inventory

**Requirement anchors:** NFR-08, NFR-04. **Reuse/repair cards:** [F01](01-DATA-AND-FOUNDATIONS.md), [F02](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/core/db/types.ts:911`, `backend/scripts/verify-migrations.ts:9`.

**Observed:** The dated recon lists applied migrations absent from current source and more relations/fields than current typed DB. Source rehearsal tooling and isolated CI exist, but neither establishes those historical artifacts nor current deployed catalog parity. This audit did not run a new live DB comparison.

**Required theoretical/technical completion:** Recover original migration provenance and approved specs; classify every observed relation/field and reconcile types/constraints on a clean target before dependent schema work. Keep unrelated DB-only modules blocked on D12; no guessed replacement business schemas.

**Independent acceptance:** Source-built disposable target, audited forward reconciliation, type/catalog parity, active trigger/constraint proof and restore evidence; all historical gaps have an owner/disposition. Do not mutate old audit history.


## C30 — Pending screens and workflow definitions are not domain implementations

**Requirement anchors:** PAY-03, LC-01, LC-06, LN-01, CLM-01, TE-01, ATT-14. **Reuse/repair cards:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [P05](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [L02](04-LIFECYCLE-AND-FNF.md), [L03](04-LIFECYCLE-AND-FNF.md), [L04](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md), [T01](06-TRAVEL-ATS-AND-MOBILE.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md), [T03](06-TRAVEL-ATS-AND-MOBILE.md), [T04](06-TRAVEL-ATS-AND-MOBILE.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md), [X01](06-TRAVEL-ATS-AND-MOBILE.md).

**Actual source:** `backend/src/api/router.ts:27`, `frontend/src/pages/payroll/PayrollPage.tsx:68`, `frontend/src/pages/travel/TravelPage.tsx:73`, `frontend/src/pages/recruitment/RecruitmentPage.tsx:37`.

**Observed:** The actual app router has no payroll/loan/claim/travel/recruitment business router. Lifecycle has boarding/exit reports and queued daily email only; workflow definitions do not supply join/confirm/transfer/resignation/F&F services. Six explicit screen resource calls have no matching literal route: payroll runs, my payslip, loans, claims, travel trips, recruitment requisitions. GPS columns alone are not a mobile submission flow.

**Required theoretical/technical completion:** Build the already-specified P/L/T/R/X cards in existing stage order, using the verified foundational boundaries and signed decisions. Keep pending UI honest; replace hand-authored assumed DTOs with the approved generated contract when each domain lands. Obtain external source/checkouts before claiming ATS/EMS absorption coverage.

**Independent acceptance:** Each requirement in pack11 maps to a registered validated endpoint, persisted transaction, correct screen and independent test/UAT evidence; no future route/table appears as existing merely because a screen/definition references it.


## C31 — Master import/read implementation does not complete master governance

**Requirement anchors:** CORE-01, CORE-03, CORE-07, CORE-08, CORE-12. **Reuse/repair cards:** [F02](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md), [L03](04-LIFECYCLE-AND-FNF.md), [P01](03-PAYROLL-LOANS-CLAIMS.md).

**Actual source:** `backend/src/modules/employees/import.schemas.ts:48`, `backend/src/modules/employees/import.service.ts:56`, `backend/src/modules/employees/employees.repository.ts:95`, `backend/src/modules/employees/employees.service.ts:303`.

**Observed:** Statutory/bank fields accept strings without all specified validation; enrichment does not provide the complete grade/salary/family/document/history catalog or controlled master editing. Directory activeOnly includes onboarding while active facets exclude it, so list/facet totals can differ. Status facets deliberately include all statuses. Existing exact e-code allocation/uniqueness, fixture-scoped tests and masking must be preserved.

**Required theoretical/technical completion:** Implement the full signed F02 field ownership/validation/catalog/editor/import plan and C01 scope. Define deliberate active/onboarding populations and align facets/list without hiding exited discoverability. Account/entity normalization is approved mapping, not fuzzy inference.

**Independent acceptance:** All CORE-08 negative cases, valid complex names, staged enrichment completeness and exact source reconciliation; directory/facets share the intended population; real import proof required before G0/G2.


## C32 — Contextual help and training need an explicit completion card

**Requirement anchors:** CORE-14. **Reuse/repair cards:** [W05](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `frontend/src/pages/_shared/ModuleState.tsx:27`, `frontend/src/ui/EmptyState.tsx:17`.

**Observed:** Teaching empty states and pending explanations exist. The inspected frontend does not contain the complete role/module quick-guide and printable training set required by CORE-14 and docs13 cross-cutting workstream. A generic not-built panel is not training or a working daily action.

**Required theoretical/technical completion:** Add W05 contextual help, one-page role guides and approved short walkthroughs tied to real permitted workflows. Keep implementation task/API details out of employee guidance. No LMS/appraisal product is added.

**Independent acceptance:** For each released role/module the guide matches current screen/permissions, daily action is teachable, masked data remains masked, accessible help works in both themes, and HR records training/UAT acceptance.


## C33 — Reliability artifacts require operating proof

**Requirement anchors:** NFR-01, NFR-02, NFR-05, NFR-06, NFR-07. **Reuse/repair cards:** [F01](01-DATA-AND-FOUNDATIONS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md).

**Actual source:** `.github/workflows/ci.yml:46`, `scripts/deploy.sh:10`, `backend/src/core/db/database.ts:17`.

**Observed:** CI, freeze check, structured logging, partition migrations and pooling code exist. This does not prove PgBouncer production routing, alerts, off-box backup/WAL/PITR restore, load targets, real connector lag, all-screen accessibility/responsiveness or deployment readiness. Backend scripts currently have no payroll golden-master/property/mutation/shadow program because the payroll engine is not built.

**Required theoretical/technical completion:** Execute and retain docs14 tiered reliability evidence at the appropriate stages; role-separated DB credentials, pool/read/report topology, worker lag/dead-letter/device alarms, restore drill and real scale fixtures. Add payroll independent goldens/property/mutation/shadow checks as P02/P03 land. Avoid counting a configuration file as a completed operational control.

**Independent acceptance:** Measured 3k/10k workload, agreed export/paint latency, pool/replica readiness, queue crash/retry, real restore checksum/ledger/audit validity, payroll gates and mobile/keyboard/contrast UAT.


## C34 — Engagement APIs need full structured survey and publisher surfaces

**Requirement anchors:** EN-01, EN-02, EN-03. **Reuse/repair cards:** [W03](05-WORKPLACE-AND-ANALYTICS.md), [F03](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/engagement/polls.service.ts:76`, `backend/src/modules/engagement/polls.service.ts:164`, `frontend/src/pages/workplace/EngagementPage.tsx:45`.

**Observed:** Announcement/poll/pulse APIs and HMAC-backed one-response dedupe exist. Current pulse is a single question/options model, not the approved multi-question structured survey catalog. Publisher/audience/results/admin experience and broad notification delivery are not fully covered by the employee feed page. Preserve anonymous response no-actor audit and identity-masked result behavior.

**Required theoretical/technical completion:** Resolve survey schema D11 and audience/scope rules; reuse existing anonymous dedupe, add approved publisher/editor/results/export screens and structured question/version/response model only after spec reconciliation. Do not derive recommendations from unspecified survey data under SOW194 without D08.

**Independent acceptance:** Named/anonymous response behavior, eligibility, repeated response, closed polls, publisher scope, structured scoring/version and privacy-safe export; no hardcoded HMAC identity key leak.


## C35 — Money discipline must include asset costs and future obligations

**Requirement anchors:** AST-06, PAY-03, NFR-04. **Reuse/repair cards:** [W01](05-WORKPLACE-AND-ANALYTICS.md), [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md).

**Actual source:** `backend/src/modules/assets/assets.service.ts:456`, `backend/src/modules/assets/assets.service.ts:509`, `backend/src/core/money/money.ts:17`.

**Observed:** Money primitives exist in core, but asset maintenance accepts JS number, writes String(number), and converts DB NUMERIC back to Number. It is not currently a payroll calculation, yet any recovery/expense linkage must not import that representation into money arithmetic. Future salary/loan/claim/travel engines are absent, so paise discipline is not established for those flows.

**Required theoretical/technical completion:** Use approved decimal-string/paise DTO conversion and core Money for monetary operations, central rounding and preserved NUMERIC storage. Link inventory cost to an independently approved recovery obligation rather than silently deducting cost; FX precision and rate provenance remain D10.

**Independent acceptance:** Decimal/large-value/negative/currency cases reject or round exactly under approved policy; paise conservation, recovery authorization and no duplicate settlement hold across domain links.


## C36 — Absence/late alerts and scheduling semantics need full workflow coverage

**Requirement anchors:** ATT-10, ATT-11, LC-03. **Reuse/repair cards:** [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [F04](01-DATA-AND-FOUNDATIONS.md).

**Actual source:** `backend/src/modules/attendance/absence.service.ts:68`, `backend/src/modules/lifecycle/boarding-exit.service.ts:157`, `backend/src/jobs/worker.ts:85`.

**Observed:** Absence scan creates cases and UAB notifications; show-cause letter requires an HR action and transport is queued only. Late/early per-person alert coverage and exact configured hierarchy/time/plant recipients remain incomplete. Boarding email time is hardcoded, and the report queries a global current master population, not an effective per-plant scoped delivery artifact.

**Required theoretical/technical completion:** Resolve automatic vs deliberate HR letter issuance under the spec and D04; implement idempotent per-day/policy alert keys, configured effective recipients/timezone/calendar and report partitioning by authorized audience. Reconcile gaps before absence action, retain due-date/case/history and actual receipt proof.

**Independent acceptance:** Offline/incomplete day does not trigger false punitive absence; repeat scan sends one intended event; late/early rules and all hierarchy recipients proved; empty-day/per-plant email and show-cause signature/delivery are evidenced.


## C37 — Routine day updates and locking invalidate manager sign-off

**Requirement anchors:** ATT-03, ATT-12, ATT-15. **Reuse/repair cards:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md).

**Actual source:** `backend/migrations/1752030000000_roster-noop-approval-guard.ts:7`, `backend/src/modules/attendance/day-status.service.ts:392`, `backend/src/modules/attendance/month-lock.service.ts:249`.

**Observed:** The shared invalidation trigger has a semantic no-op guard for rosters only. Day-record updates invalidate the latest approval regardless of which fields changed. An unchanged recompute writes computed_at, and month locking changes is_locked on day records after checking sign-offs; either can append an invalidate event without a changed attendance fact.

**Required theoretical/technical completion:** Define the approved attendance fact revision/hash and invalidate on semantic inputs/payable facts, not merely computed timestamp or administrative freeze. Make manager approval/lock evidence refer to the same immutable revision. Preserve actual roster-change invalidation and no-op protection.

**Independent acceptance:** Approve manager month then unchanged recompute: approval stays valid. Lock approved month: latest accepted sign-off remains valid. Change punches/shift/leave/payable sessions: sign-off invalidates exactly once and blocks lock.

## Preserve what is already fixed

Current no-DB test isolation clears application DATABASE_URL; employee import cleanup is fixture-scoped. Current day readiness gates daily absence or either absent session; whole-day leave/AR clears stale session labels. Current recompute claim protects dirty rows inserted after claim. Manager approval invalidation is an append-only ledger with semantic no-op roster guard in migrations175197/175203. Device watermark advancement uses GREATEST and source175193 prevents regressions there. E-code allocation and ticket numbers use database serialization/sequences. Anonymous polls use HMAC-backed dedupe and suppress actor audit on response. Muster/report export scope exists in several paths. These deserve regression tests and reuse; do not recreate old bugs as if fixes were absent.

## What this audit cannot assert

No claim of exhaustive runtime defect discovery, legally current statutory engines, fresh catalog parity, deployed connector safety, full UI UAT or external application code coverage is made. An index may find a function/route without proving its complete behavior. All open findings are source-level evidence plus required tests; uncertain policy behavior is a D01–D12 decision, not a guessed fix. Actual EMS/ATS implementation requires sanctioned source access in T01/R01. Audit/plan artifact edits leave application source, migrations and phase gates unchanged.
