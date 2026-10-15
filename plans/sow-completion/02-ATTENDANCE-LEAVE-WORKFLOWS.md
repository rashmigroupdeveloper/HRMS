# Attendance, leave and workflows

Authority: ATT-01..18, LV-01..09, WF-01..04, RPT-01/06, CORE-09/13; docs03–06/08–09/13–14 and the 07 Oct attendance recon. Existing stages 0.6 and 1.1–1.8. For every task reuse its current code; payroll integration is P02/P03, not a second attendance engine.

## Relationship and result contract

| Grain | Connections | Required behavior |
|---|---|---|
| Raw event | swipe employee_id → employee if resolved; door_code ↔ devices.door_code logical/natural mapping; source and received time preserved | Immutable original fact; unknown employees stay explicit unmatched facts. Historical live catalog lacked employee FK; validate/repair after provenance recovery without rewriting raw evidence |
| Completeness | device_watermarks.device_id → devices; ingestion source cursor separate | Device contact/swipe arrival is not proof all punches through shift-end arrived |
| Schedule | roster `(employee_id,work_date)` → employee/shift; employee_shifts → weekday/Saturday shifts; holiday → location | Resolve effective schedule for that historical day; current employee_shifts is one row/person and needs effective-history decision D07 |
| Processed day | day_records `(employee_id,work_date)` → employee/shift/leave_type | One daily summary plus optional ordered P/A/O sessions; minutes/source/reason/computed time/lock remain traceable |
| Exception request | regularizations.employee_id → employee; workflow_request_id → request | Subject/date/kind agrees with approved request; request is attached before auto-skip hooks can finalize |
| OT | overtime employee/day → employee; workflow → request; comp-off credit → leave ledger; payroll item → pay item when built | Detected ≠ approved ≠ paid; money XOR comp-off; one consumption posting |
| Leave | application → employee/type/workflow; ledger_txn_id → ledger; cancellation workflow → request | Ledger subject/type matches application; reject mismatched valid IDs, not just nonexistent IDs |
| Lock | month_lock `(company_id,month)` → company; manager approvals → company/month/manager/actor | Approvals are append-only approve/invalidate events; payroll lock snapshot must reflect most recent effective approvals |
| Muster | reporting.muster_month → company/month/employee and source build | Derived view/read model; never authoritative payable-day input when underlying lock facts disagree |

## A01 — Real Kent ingestion and trustworthy completeness

**Stages:** 0.1 protocol decision, 0.6 spike, then 1.1 productionization in separate sessions. Reuse `kent-connector.ts`, `kent-sync.job.ts`, `ingest.service.ts`, device-health/exception APIs and pages; migrations175182–175184/175192–175193; kent-ingestion/stage11/device-watermark tests. `connectorFor()` currently chooses MockKentConnector; do not credit it as a real integration.

**Theory:** late/offline/out-of-order punches are ordinary; an offline door must yield unknown/incomplete attendance, not false absence. Cross-plant doors are valid; mapped cost-center remains payroll allocation.

**Technical:** obtain IT-approved pull/push/CSV contract and sanitized examples; document field mapping and timestamp/timezone semantics for all 17 source columns. Pull with overlap/backfill; commit immutable insert, dedupe, quarantine/unmatched classification and dirty dates before ACK/cursor advancement. Natural key and partition key must produce dedupe across retries/month boundaries. If a missing direction/door makes a key ambiguous, define canonicalization without losing original values.

Completeness receipt declares which doors/intervals are gap-free; heartbeat and source fetch cursor cannot replace it. Quarantine implausible future/ancient timestamps; policy window in settings; source clock drift visible. Reconnection floods batch recompute fairly; do not starve approval/payroll pools. Recover contaminated watermark data from proven receipts, not GREATEST over test facts or guessed now().

**Screens:** door/source last contact, completeness through time, pending interval, lag, quarantine/unmatched counts; raw-event drawer retains source values; reviewed employee linking uses explicit reconciliation event/projection if raw append-only prevents mutation. Do not casually enable UPDATE of raw swipes to link identity; D07 must specify the resolution structure.

**Acceptance:** one real sanctioned day reconciles by e-code/door/time; duplicate imports create no duplicate facts; gaps and partial-session absence held; unknown employee remains visible; offline/backfill/night-boundary scenarios; real alerts delivered. G0/G1 still require operational evidence.

## A02 — Shift, roster, daily/session results and week-offs

**Stage:** 1.2. Reuse attendance-config router, `day-status.service.ts`, `session-status.ts`, `roster.service.ts`, shift/holiday migration and masters/team/calendar screens. Relevant tests: stage12-day-status, attendance-session*, stage17-manager-approval-roster. Current code supports fixed/night/session/grace/schemes and manual roster updates; automatic rotation/flexible semantics are not specified by the current implementation alone.

**Theory:** establish a dated policy matrix per relevant entity/category/plant: weekday/Saturday/week-off/holiday, shift windows, paid/unpaid breaks, threshold basis, grace/late/early, penalty outcome and allowed flexible/rotation behavior. Exact greytHR session fraction is unverified. Ordered session glyphs do not themselves define pay.

**Resolve D05/D07 before new calculations:** whether split-session presence uses worked duration, first-to-last overlap or approved tenant rule; rotations and flexible core-window rules; department-specific calendar requested by SOW57 versus location-only PRD; effective scheduling table design. Do not add an automatic roster generator without its approved pattern/tie-breakers.

**Algorithm after sign-off:** dated roster → dated employee scheme fallback → night window attribution → calendar → approved leave/OD/permission/manual facts → raw FILO span minus applicable break → approved threshold/session outcome → late/early/detected OT → readiness → persisted day. Show precedence conflicts explicitly; holiday/week-off work generates OT/comp-off candidate rather than discarding work. One swipe cannot silently prove a full span. Manual/regularized/locked results remain protected.

Current processor uses first/last span; split sessions compare overlap to a configured fraction. Current `recomputeDay` already gates any A session; regularization clears old labels. Preserve and test these fixes. Approved mixed off summary P:O/A:O follows signed scheme; no new payable formula inferred from O. Full-day absence must not be finalized until relevant doors are complete.

Week-close rules count qualifying statuses per docs04 §1.2; zero qualifying days makes WO unpaid; entire-month absence makes all WOs unpaid. Paid leave versus physical-work interpretation requires D05/D06 where docs disagree; do not count unpaid LWP as paid leave. Every policy multiplier/divisor/rounding lives in settings or master data, no hidden constants.

**Mutation boundary:** roster/shift changes check actor scope, effective dates and locked months; log history; dirty only affected unlocked days; invalidate applicable manager approval events; recompute and rebuild muster. Effective-dated assignment exclusions must be designed from recovered schema, not added to a one-row current assignment table blindly.

**Screens:** manager roster grid with bulk fill, selected employees/date range, shift/week-off preview and validation; HR shift editor showing times/session/break/threshold policy; holiday calendar with supported scope; employee day drawer with raw swipes, effective schedule, daily/session results, readiness and source. Display incomplete as incomplete, never zero-hours confirmed absence. HR manual override requires reason and two-session summary where needed; manager gets apply/approve actions only.

**Acceptance:** hand-reviewed night/Saturday/half-day/off/holiday/sandwich/single-swipe fixtures; historical recompute unchanged under later master edits; same-company placement enforced; legitimate cross-plant punches count; locked roster mutation rejected; UAT ties each outcome to policy version.

## A03 — Generic workflow safety, requests, permission, OD and OT

**Stages:** 1.3 then 1.4. Reuse `createRequest(db,params,attach)`, `act`, `resubmit`, `runEscalations`, inbox/timeline and definition seed; attendance requests/regularization/OT/hooks; ApprovalsPage/TeamPage/OtDecisionsPage. Existing concurrency locks open step in `act`; new hooks must retain transactional behavior. Register hooks in both app and worker.

| Command | Preconditions and atomic effect | Follow-up |
|---|---|---|
| Raise | Valid subject/scope, typed domain payload, definition; create request + domain row via attach callback before advancing | Resolve RM/functional/role/delegation; queued notification within same transaction |
| Approve | Actor is current resolved approver and scope still permits subject; lock actionable step | Store decision/audit, advance or fire final domain hook once |
| Reject | Mandatory domain-specific reason; actionable step | Terminal domain rejection, release reservations; no paid posting |
| Send back | Permitted in definition; preserve prior review trail | Editable domain draft and reservation correction; no approval effect |
| Resubmit | Requester owns sent-back request; new validated domain data and version | Update domain + payload consistently, restart chain, retain attempt history |
| SLA breach | Locked current pending step; policy data decides escalation/lapse | Add actual responsible recipient, auditable action, retry-safe final hook |

Current `resubmit` changes generic payload; each money/lifecycle module must supply validated domain update/reservation handling. Never trust arbitrary workflow JSON as salary input. Vacant approver follows approved auto-skip behavior with audit, not silent assumed consent. Delegation windows/recipients and step attempt uniqueness must be resolved centrally.

AR: past dates/window/reason; Permission: bounded start/end times and signed impact; OD: past or future and remote/site use; each belongs to requesting employee and signed approval chain. Applied flag means domain fact actually committed; rejected/locked date cannot be reported as applied. Whole-day approved changes clear session labels or replace with consistent explicit sessions.

OT: detected/claimed/approved minutes distinct; manager summary groups actual scoped employees; deadline per accepted intimation policy; at breach lapse. Approval is ≤ permitted minutes and race-safe with lapse. WO/H conversion writes immutable CO credit and marks converted; approved pay creates exactly one payroll-consumption reference under P02. Rate/base arithmetic stays in payroll, not manager screen. Preapproval meaning/rule is D06; ordinary post-detection approval is not automatically preapproval.

**Screens:** inbox type/subject/period/reason/step/SLA/queue/send status; decision inline ≤2 clicks; rejection/comment validation; read-only signed payload; requester resubmit preserves draft and displays changed version; OT detected/claimed/approved/conversion/payout columns and deadline. Negative own/subtree/OU ID checks cover list/detail/action/export.

**Acceptance:** concurrent approve/reject/lapse produces one final effect; vacancy/delegation/resubmit/revoked grant fixtures; domain/workflow subject match; every final hook atomic; actual notification evidence, not timestamps alone; future OD and permission time ranges tested.

## A04 — Leave types, ledger, accrual, cancellation, RH and encashment

**Stage:** 1.5; payout consumes P02/P03, annual job in its own appropriate completion stage. Reuse `leave-core.service.ts`, `leave-apply.service.ts`, router/hooks; migrations175188; MyLeave/LeaveApplyDrawer/LeaveAdmin; stage15 integration tests. Leave catalog create/update, year-end API and ledger are already present; HR register/configuration UI and scheduled carry-forward are incomplete.

**Theory:** balance at business date = immutable credits/debits through that date. Available = balance − valid pending reservations; CO eligibility/expiry requires actual approved WO/H work. CL/SL/EL/Election/CO/LWP/ML/RH catalog comes from docs09/approved policy, not fabricated accrual rates. EL service threshold and half-day/sandwich restrictions use policy data.

**Transactions:** serialize employee/type balance consumption; create application+workflow+reservation consistently; on approve write one debit plus attendance effect; on rejection release pending reserve; approved cancellation has its own chain and reversal credit + dirty-date recompute. Never delete an approved application or subtract mutable balance directly. Block or defer locked-day change according to audited correction/retro design; a ledger reversal without authorized attendance effect is a consistency failure.

Current leave approval/cancellation clear session labels; leave cancellation resets unlocked affected record then queues recompute. Prove that pending recompute prevents month lock and that source watermark still protects false absence. Half-day leave plus worked other-half must resolve to explicit payable truth under D05; existing HD alone cannot certify the other half worked or whether leave is paid.

Accrual jobs have unique employee/type/period keys; retry does not double-credit. Current docs04 say approval gaps flag employees without blocking credit, while ATT-12 wording implies approval precedes credit. D02 selects the approved interpretation before changing behavior. CO expiry/carry-forward allocate consumed credits by documented order (e.g. earliest-expiry only if signed); lapsed amount excludes already-used credits. Fiscal/calendar leave year boundary and carry cap are signed policy, not guessed 31 Dec.

Encashment: current request approval debits ledger, with audited clamp if balance shrank. Payout is absent. Introduce an explicit payable obligation linked to that actual debit/request and run/batch consumption so encash is paid once. D06 resolves whether clamp or re-approval is acceptable; do not pay originally requested days after a smaller posted debit. F&F uses the same encash entitlement/payment primitive, preventing double-consumption.

**Screens:** HR type editor with effective policy, categories/gender/service/accrual/half-day/sandwich/carry/encash; own balances with posted/pending/available/expiry; company register scoped by employee/type/period; accrual exception list; year-end preview showing opening/movements/carry/lapse; encash approval and paid/unpaid references. Employee gets cancellation timeline and RH annual-limit state.

**Acceptance:** independent expected balance/half/sandwich/expiry fixtures; concurrent submissions cannot overspend; duplicate callbacks/jobs don't duplicate ledger; RH cap respected; manual adjustment reason/audit; lock/recompute/ledger consistency; approved encash actual days equal payable obligation.

## A05 — Lock, muster, absence/letters/policies and G1 closure

**Stages:** 1.6 then 1.7 then 1.8. Reuse absence service/router, letters/policies, boarding-exit, manager-approval/month-lock/muster and supporting-report services; respective pages; stage16/stage17 tests. This closes behavior/readiness around working code.

Lock is a transaction that rechecks pending requests, unmatched/quarantined evidence, per-door completeness through final shift, dirty recompute queue and effective manager sign-offs; approved exclusions/carry decisions are explicit. It records company/month/checklist/version and freezes day facts. Roster/request/employee-placement mutation invalidates affected approvals before lock. Payroll consumes the same lock ID and input cutoff, not an unlocked cached muster.

Muster is built from processed day/leave/type/approved OT + scoped employee/history snapshot. Columns exactly R1: ecode/name/RM/functional manager/department/designation/OU/cost-center/contact/category; day glyphs preserve sessions; totals present/absent/HD/paid-unpaid WO/H/leave by type/OD/CO/UAB/LOP/OT. List/export use identical filters. Precomputed build timestamp, lock status and totals are visible; no client aggregation or silent truncation.

Absence case watch/show-cause/warning thresholds from policy; HR issues official letter with signature workflow, not automatic termination based solely on a scan. Returned/regularized/exited closes case appropriately. UAB/late/early alerts follow matrix and delivered receipts. Policy publication/ack/nag records reading; general compliance adherence requires D08, not a misleading percent tile.

Daily boarding/exit report covers yesterday in IST and sends even empty; recipient scope is configured; email/archive/export consistent. LifecyclePage currently uses a UTC-derived date; reconcile business-date helpers at this boundary before claiming exact period parity.

**Acceptance:** processed/muster/export totals equal independently checked facts; whole-month parallel attendance review; no false absence under delayed door data; managers use approvals; required alerts/daily mail delivered; HR ops signs G1. Do not mark this complete from typecheck/unit fixtures alone.

<!-- DEEP-AUDIT -->
## Current code repair obligations (09 Oct deep review)

These are required additions to the relevant cards, not implementation ticks. Read [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md) for exact symbols/lines, transactions and independent acceptance cases. All PRD requirements are covered in [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md).

- **C01 — Permission scopes are not propagated consistently** (A04): Build the per-procedure subject/company/OU/field scope map from docs08. Intersect filters with live grants, check both old and new placement on mutations, and resolve statutory/compensation grants separately. Preserve existing scoped muster/supporting report and audit queries; this finding does not say all routes are unscoped.
- **C02 — Generic workflow creation bypasses domain validation** (A03, A04): Make domain endpoints the validated creation boundary. Decide whether the generic HTTP creator is needed; if retained, allow only approved definitions with exact zod payload, one permission, subject ownership and an atomic domain attachment. Final hooks must consume validated authoritative domain facts and fail closed on malformed/mismatched subject, rather than silently returning.
- **C03 — Workflow role queues ignore grant scope** (A03): Resolve role-holder eligibility against subject and action scope for notification, inbox, action, escalation and timeline. Preserve current request-step locking. Decide team-role notification semantics under D03/D04; do not hardcode new role names.
- **C04 — Resubmission and editable chains can diverge from domain facts** (A03, A04): Specify request revision + validated domain revision and chain version/snapshot under D11. Atomically revalidate dates/balance/scope and synchronize domain facts on resubmit; link every step/event to the approved revision. Define explicit handling of already-open requests when administrators publish a new chain.
- **C05 — Delegation and step configuration need server invariants** (A03): Record delegation authority/ceiling/window policy and chain numbering/required-reason rules, then enforce server-side and at the DB where appropriate. Audit delegation atomically and preserve who delegated each actual step.
- **C06 — OT workflow decision and domain posting are split** (A03, A04): Carry validated requested minutes and pay-vs-CO choice as authoritative decision facts. Apply final workflow state, OT status, unique CO posting, audit and outbox in the same final transaction. Recheck authority, pending state and accepted intimation deadline under D04/D06. Intermediate approval must not authorize payment/credit; add one posting key per OT entry and inspect affected rows.
- **C07 — Leave reservations and RH caps are not serialized** (A04, A03): Choose one employee/type reservation locking protocol shared by leave, encash, cancellation, RH and relevant jobs. Validate and reserve inside the creation transaction, revalidate on final approval, and add approved overlap/idempotency constraints with explicit half-session semantics. Keep ledger balances derived; do not add mutable balance counters.
- **C08 — Approved request write-back can silently skip attendance** (A03, A04, A05): Share the company-month synchronization boundary between lock and request finalization. Define manual precedence and post-lock cancellation/retro policy under D05/D11. Count intended/applied days explicitly; either complete approved effects atomically, reject/defer, or create an approved historical correction obligation. Never claim applied when protected rows were silently skipped.
- **C09 — CO expiry misses the all-expired case and lapse jobs race** (A04): Specify signed FIFO/expiry allocation and year boundary, handle an empty live-credit set, and use serializable bucket handling plus deterministic job/posting identity. Preserve immutable postings and exact units; schedule year-end only after D02/D06.
- **C10 — Accrual fidelity and manager approval conflict remain** (A04, A05): Resolve D02 with HR, including proration, missing attendance and approval readiness. Implement the signed eligibility/exception queue contract and effective dates; enforce mandatory manager lock precondition if the approved spec retains it. Do not silently choose either contradictory credit rule.
- **C11 — Month lock omits dirty-queue and expected-day completeness** (A05, A02): Add scoped completeness and dirty-work blockers, accepted carry decisions, effective eligible population and source reconciliation. Lock/recompute/final hooks must share synchronization so evidence cannot turn stale between checklist and commit. Preserve current device coverage and advisory-lock protections.
- **C12 — Recompute flags are lost on process death after claim** (A02): Replace destructive claim with a durable lease/work-item acknowledgment protocol or execute an equivalent recoverable job model. Preserve new dirty revisions arriving while work runs. Treat configuration loading and crashes as replayable failures, not absent work.
- **C13 — HR manual status retains stale derived links** (A02, A04, A03): Define source precedence and correction obligations for each derived field and linked posting. Apply permitted manual state plus invalidation/dirty dependencies/audit atomically; retain approved historical money through delta corrections.
- **C14 — Scheduled Kent sync always selects a mock under the real source key** (A01): Select the sanctioned real connector through environment/adapter configuration; fail startup/sync closed in production when it is absent. Keep simulation in explicit disposable/dev targets with distinct provenance and clock bounds. Reconcile historical simulated rows using approved read-only evidence before any repair proposal.
- **C15 — Lossless feed and concurrent source watermark need completion** (A01, A02): Document every raw field, immutable identity and duplicate key with the actual Kent source. Preserve lossless payload/field provenance. Serialize source fetch/advance or use a monotonic concurrency-safe receipt cursor without mistaking it for completeness. Unmatched reconciliation must preserve immutable original events and supply a safe mapping design under D07.
- **C16 — Notification receipt, drain and transport are incomplete** (A03): Complete F04 short durable leases, idempotent outbox keys, transport retry/backoff/dead-letter and provider/in-app receipts; create every queue on a clean DB before schedules. Resolve SLA intimation source D04. Required policy thresholds belong in validated settings.
- **C21 — Several audited mutations commit before their audit/outbox** (A04): Inventory every mutation in deep-code-index.json. Put domain state, masked audit and required outbox into one DB transaction, lock/version-check the affected record, inspect row counts and return its committed version. External effects use F04 outbox/object staging. Preserve already-atomic createRequest/act, asset assignment and ticket creation.
- **C24 — Approval deep links may show and act on a different request** (A03): Resolve route ID exactly; load authorized detail/timeline for that ID, show unavailable/decided/forbidden state explicitly, and never silently substitute an actionable request. Add validated domain correction/resubmit screens after C04. Show batch per-item outcomes/retry-safe selection.
- **C25 — Attendance/report figures use incomplete or wrong source semantics** (A02, A04, A05): Define authoritative payable-session units and approved OT aggregation under D05/D06, effective population/history and exact docs06 denominators. Use validated immutable/snapshot inputs with freshness metadata and drilldowns; preserve unavailable nulls until payroll/contract inputs exist. Snapshot/filter/export populations must remain consistent after transfers.
- **C36 — Absence/late alerts and scheduling semantics need full workflow coverage** (A05): Resolve automatic vs deliberate HR letter issuance under the spec and D04; implement idempotent per-day/policy alert keys, configured effective recipients/timezone/calendar and report partitioning by authorized audience. Reconcile gaps before absence action, retain due-date/case/history and actual receipt proof.
- **C37 — Routine day updates and locking invalidate manager sign-off** (A02, A05): Define the approved attendance fact revision/hash and invalidate on semantic inputs/payable facts, not merely computed timestamp or administrative freeze. Make manager approval/lock evidence refer to the same immutable revision. Preserve actual roster-change invalidation and no-op protection.
