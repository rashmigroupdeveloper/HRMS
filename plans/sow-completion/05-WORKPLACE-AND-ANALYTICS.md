# Workplace, documents and analytics

Read docs 01 M6–M9, 03 §9, 04, 05, **06 full catalog**, 08, 12, 13 Phase 3 and 14. Stages 3.3–3.5 in `plans/phase-3-lifecycle-assets-executive.md`; policy/letter work belongs to Stage 1.6 when applicable. Existing code is a starting point; every query/export needs F03 server scope.

## W01 — Assets (Stage 3.3)

**Theory and links:** `ast.assets` is the asset identity/register; `ast.assignments` records employee custody over time; `ast.maintenance` records repair/disposition history. Link employee holder to `core.employees`, action actor to `core.users`, and uploaded evidence to `core.documents`. Asset register status is a derived current projection; a lost asset is not a financial recovery until separately approved. On exit, L04 clearance references the actual open assignment/disposition. Never clear a Finance deduction merely by deleting an allocation.

**Already present:** `backend/src/modules/assets/assets.service.ts` and router support registration, allocation, return, loss/maintenance and report operations; `frontend/src/pages/workplace/AssetsPage.tsx` has register/allocation/return/outstanding surfaces. Dedicated maintenance/incident handling and exit-clearance linkage remain. Reuse state validation/locks rather than create a parallel asset subsystem.

**Completion:** lock asset on allocation and enforce one open custody assignment, eligible status and valid scoped employee; perform assignment/status/audit/outbox together. Return records actor, time, condition and evidence; maintenance closes/reopens custody only under approved transition rules. Damaged/lost cases preserve the last holder, assessment/evidence and authorized disposition. Cost/recovery policy needs an approved source; purchase cost is not automatically recoverable from salary. Add explicit clearance evidence/approved obligation reference via a documented amendment, not a text-matching join.

**Screens:** searchable register and holder timeline; allocation/return drawer; maintenance history/incident disposition; resigned holders/non-returned queues; R28 export with identical filters. Display asset code/category/status/holder/allocation date/return condition plus documented register fields; sensitive financial fields remain permission-masked. Employee can acknowledge own allocation; administrator cannot infer universal company scope from permission alone.

**Acceptance:** concurrent allocation only one winner; returned/lost/repaired transitions maintain history; exited employee's allocation blocks appropriate clearance until actual disposition; a recovery obligation is consumed once; register/status/holder/report totals agree; workflow notifications delivered. Preserve existing tests and add cross-domain cases.

## W02 — Helpdesk (Stage 3.4)

`hd.tickets` links raising user, assigned user, category, priority, status and SLA dates; `hd.ticket_messages` links thread to ticket and author. Inspect actual typed fields and migration first; baseline and observed schema differ. `helpdesk.service.ts`/router and `HelpdeskPage.tsx` already deliver ticket creation/assignment/replies/status and performance reads. Current thread/reply code lacks adequate subject authorization, and the escalation sweep notifies the same assignee instead of resolving a configured higher escalation recipient. Current category performance is not a complete historical SLA hit-rate measure.

**Theory:** a ticket is an accountable service request. Status history, messages, assignment and escalation are different events. Internal messages must never enter an employee response/export. Closing a ticket does not erase a missed SLA.

**Transactions:** create scoped ticket with SLA policy snapshot, assignment and outbox; append author-validated message with membership checks; lock/version-check transition/reassignment; record breach/escalation event with original due time and actual notification receipt. Proposed immutable event history/escalation matrix needs D11 schema approval. Configured category/priority timings, working calendar, pause rules, reopen behavior and levels need an explicit policy; no hardcoded fallback hours or silent reset on reassignment. Prevent duplicate escalation with deterministic ticket/level/attempt key. Fix/create worker queues under F04.

**Screens:** employee own ticket list/thread, authorized agent queue, triage drawer, category/priority/status/assignee, deadline and history, safe attachments, internal/public composer distinction, explicit resolution/reopen reason. SLA reports include closed breaches, elapsed/paused time and escalation delivery. The visible list and API enforce the same ownership/company scope, including direct ticket URL and exports.

**Acceptance:** employee A cannot read/reply to B's ticket; hidden internal text absent from all employee outputs; assignee/escalation changes route to entitled people; retry sends no duplicate event; missing recipient is actionable; R29 exact columns and historical denominator/closed tickets verified; working-hour boundaries independently derived. Review checked HD plan tasks against these gaps rather than assuming the stage passed.

## W03 — Engagement, policies and letters (Stage 3.4 / Stage 1.6 slices)

`eng.announcements` supports scoped audience feed; `eng.polls`/`eng.poll_responses` implement polls and single-question pulse with HMAC dedupe/anonymity. `core.policies` links document/version/audience to unique employee acknowledgments; letters use employee, template, signature and archive records. Actual services: `modules/engagement/{announcements,polls,audience}`, `modules/policies`, `modules/letters`. UI announcement feed and policies/letters exist; publisher/poll/survey completion remains. Doc 03's structured `eng.surveys`/responses are not equivalent to a `kind='pulse'` single question (D11).

**Theory:** publication determines an eligible audience; acknowledgment proves receipt/read action for a particular version; a vote is a response; absence of response is not disagreement. A policy repository does not automatically enforce its operational rule in attendance/payroll. Anonymous results must avoid identifying voters; anonymity doesn't remove dedupe or authorized aggregate access.

**Completion:** authorized publish/edit/archive with explicit audience and version; no historical policy-document replacement invalidating acknowledgments. Freeze whether anonymous at creation, enforce eligible respondent and one response, validate option/question IDs server-side and close date; record counts from eligible audience with a signed audience-change rule (D11). Do not collect free-form identity under an anonymous survey or expose HMACs in exports. Multi-question surveys need an approved question/answer schema and documented export/privacy semantics before migration. Birthday/anniversary scope, delivery channel and opt-out rules are policy decisions, not unrestricted DOB exports.

Policy acknowledgment inserts once for exact version/subject; nag unresolved audience with F04; R30 denominator follows that version's defined eligible population. New version creates a new obligation. Department-specific holiday adherence/recommendations are SOW scope decisions D08, not implied by repository upload. Letter templates are governed by signed HR/legal wording; track generating actor/source dates and signature authority. Salary/exit eligibility is P04/L05. F04 completes actual production rendering/storage/delivery; a saved text/PDF is not a delivered legal letter.

**Screens:** audience preview and publication queue; feed with attachments; poll create/respond/results; survey form/results only after schema decision; policy version/ack deadline and personal pending list; admin laggards with scoped exports; letters preview/archive/send receipt. Display no demo vote counts and no unrestricted demographic filtering of small anonymous groups; suppression/privacy policy must be approved, not guessed.

**Acceptance:** unauthorized audience cannot fetch attachments or respond; duplicate response/ack prevented; anonymous storage/export is inspected; expired poll rejects votes; policy version requires a new acknowledgment; outbox nags targeted only to unresolved people; template changes do not alter archived letters; R30 agrees with defined denominator.

## W04 — Reports and dashboards (Stages 1.7, 2.4–2.6, 3.5)

**Starting code:** `modules/reports/{muster,reports,reports-export,dashboard,kpi-snapshot}.service.ts` and router; report, executive and role-home pages. R1–R6/R24/R27 and workplace/policy slices have implementation; remaining payroll/lifecycle sources are absent or incomplete. CEO snapshots exist; BU uses live queries and accepts optional client filters without applying caller `permissionAccess`. Fix scope before displaying private organization aggregates; snapshot the heavy reads per docs14. Report names/scaffold menu items do not prove source coverage.

### Data and calculation contract

Employee/date reports join the effective employment/assignment at the event date. Payroll reports join the frozen run's assignment and calculation/version, never today's salary/master. Reporting has no authority to repair source facts. All reports specify grain (employee-day, request, component, settlement, snapshot), source keys, timezone/as-of interval, row cardinality and aggregation before a query is written. Join bills/approvers/components through preaggregation or separate detail reads so one-to-many joins cannot multiply money/headcount. Scope intersects server authorization with client filters before both aggregation and drilldown.

Use designated reporting queries, replica-ready boundaries, indexes and precomputed snapshots. Snapshot identifies date/entity/category, source cutoff/version and refresh status; partial/incomplete inputs show unavailable/stale with reason. Snapshot updates must be replayable and reject regressing freshness. Setting production output monthly requires entity/month/unit provenance, author/audit and version; a globally overwritten current scalar cannot explain historical productivity. Approve that effective input contract under D11.

### Complete report delivery map

The following maps every catalog report to its completion card; **exact columns and filters remain those in bundled docs06**, not a generic report-builder choice. Export and onscreen grain/order/filter definitions must match.

| Report | Authoritative source / necessary completion |
|---|---|
| R1 muster | A02/A05; employee×month daily statuses, managers/OU/plant/contact and totals; readiness and session reconciliation; documented 2,500×31 <10s target |
| R2 swipe detail | A01/A02; first/last/door/raw 17-column detail, cross-plant flag and HRMS-vs-source mismatch |
| R3 AR/OD | A03; workflow dates/actors/status plus applied-to-attendance proof |
| R4 late/early/UAB | A02; day facts and employee-month minutes/count, approved penalty linkage |
| R5 OT | A03/P02; detected/claimed/approved/deadline/lapsed, one pay-or-comp-off consumption |
| R6 absence | A05/W03; case stage/letter/owner/resolution plus weekly delivery |
| R7 pay register | P02/P04; run employee/component/days/net, frozen version |
| R8 bank | P04; bank-specific signed format, holds excluded, batch/payment result |
| R9 JV | P04; component→GL/cost-center mapping and debit=credit |
| R10 variance | P02/P07; previous comparable run, component delta and explainable reasons |
| R11 PF/ECR | P03; UAN/wages/EE/EPS/EPF/EDLI/admin/NCP, official target-period file contract |
| R12 ESIC | P03; IP/days/wages/EE/ER and official file contract |
| R13 PT | P03; state/slab employee and summary; jurisdiction resolved |
| R14 LWF | P03; location/period applicability and contributions |
| R15 TDS/24Q/Form16 | P03; immutable FY projection/YTD, corrections and filing acknowledgment |
| R16 CTC | P01/P04; employer cost with ER contribution and effective assignment |
| R17 loan/advance | P05/T02; immutable postings, balances/EMI/perquisite and settlement links |
| R18 F&F | L05; all source heads/TAT and paid acknowledgment |
| R19 holds | P02; type, reason, age, outstanding liability/release |
| R20 parallel | P07; source import mapping, employee/component deltas, signed exception |
| R21 offers | L01/R01; exact LOI status/probation% fields; no fake offer data |
| R22 recruitment | R01; recover HR's shared template before creating additional columns |
| R23 movement | L03; effective from→to assignments and approver |
| R24 joining/exit | L01/L04; actual conversion/approved exit, RM/plant/F&F status and daily receipt |
| R25 confirmation | L02; due/overdue/outcomes history |
| R26 attrition | L04/W04; reason, voluntary/involuntary classification, as-of tenure |
| R27 demographics | F02/L03; as-of employee/assignment and historical denominator |
| R28 assets | W01; status/holder/non-returned/resigned/maintenance |
| R29 helpdesk | W02; category/status/assignee, historical SLA hit/miss/escalation/aging |
| R30 policy | W03; version×eligible population vs acknowledgment, scoped laggards |
| R31 reimbursement | P06/T02; claimed/approved/paid, verification, entitlement utilization, taxable unsubstantiated amount |

### KPI semantics and screens

Implement every docs06 §4 KPI, each with underlying scoped list. Headcount uses active **as-of date**; average age/tenure excludes missing values and reports coverage, not zeros. Leadership uses configured grade-rank cutoff. CTC uses effective approved salary. Contract dependency remains unavailable/on-roll-basis until approved contract-worker data exists. Output metrics explicitly identify output units/month/entity; hours derive from processed attendance, costs from immutable payroll plus ER contributions. Approved OT is not detected OT; paid OT cost is not an estimated hourly rate.

Absenteeism uses UAB+A over scheduled working days; half-day/session weighting must be approved D05. Attrition denominator is average headcount over the chosen period, not today's count; annualization convention/zero-denominator handling must be signed under D11. 90/180/365-day new-hire cohorts use eligible observation windows and disclose censored cohorts; don't classify new joiners as surviving a year prematurely. Burnout proxy uses configured weights/z-score baseline and source definitions; it is explicitly an index, with no invented scores if source completeness/baseline is missing.

Role dashboards retain docs06/05 prescribed widgets: HR ops, BU scoped OU, CEO, payroll exceptions/statutory calendar, device gaps, manager approvals/roster. Recover BU supplied format and recruitment template (D08). Server APIs enforce scope for summary and detail, no broad aggregate followed by frontend filtering. Tiles show unit, date range, refresh/completeness, formula tooltip and linked underlying list; approved unavailable states until domain lands. Filters, export and drilldown preserve context across navigation.

**Acceptance:** hand-derived seeded scenarios for every KPI and boundary (join/exit/transfer/effective salary/month/FY/missing DOB/zero hours); reconcile each register to its ledger/run; no money multiplication by joins; restricted user's summary and direct drilldown agree; export same rows/columns/filters; async export with audit for large sets; measure source scale and target performance without applying arbitrary limits. CEO sign-off is G3 evidence, not just a checked RPT task.

## W05 — Contextual help, training and operational adoption

**Authority:** CORE-14; docs01, docs07 §4b, docs13 §7 and docs05/12. This is a cross-cutting completion card attached to the original module stage/UAT work, not a new LMS module or a new phase.

**Existing code:** `frontend/src/ui/EmptyState.tsx`, `pages/_shared/ModuleState.tsx`, role navigation, helpdesk and existing module forms provide teaching and pending states. A complete role/module guide catalog, printable quick guides and accepted walkthrough set are not evidenced in this checkout.

**Theory:** teach the real permitted action, its required input, its committed result and the next responsible person. A guide must distinguish submitting a request, receiving approval, posting a ledger effect and receiving payment. A technical task ID or backend route is not an employee instruction. Show missing permissions or incomplete data as an actionable support path.

**Technical/data connection:** begin with version-controlled guide content keyed to approved role/module/action and the actual screen/API contract version. Reuse existing session permission navigation and helpdesk categories. Do not create a new training database, completion counter or employee scoring model unless HR approves a source-backed requirement. Mask screenshots/examples and use synthetic records; links to business records still enforce server scope. The separate HR UAT/training acceptance register records guide version, audience, reviewed workflow and signed session evidence.

**Screens:** contextual help on each released module; a short permitted-action guide with required fields, validation/error explanations, approval/status/payment meaning and support link; printable one-page ESS/manager/HR/payroll/admin guides; short approved walkthroughs. Compose existing UI and keep filters/drafts intact when help opens. Cover desktop/mobile, keyboard, both themes and reduced motion.

**Acceptance:** every released role/module has an accurate reviewed guide; an HR witness completes the intended daily action from it; guide examples match current permitted screens and generated API; inaccessible tasks are not advertised; no personal/statutory data leaks; capture per-phase training/UAT approval without ticking a business capability or gate from documentation alone.

<!-- DEEP-AUDIT -->
## Current code repair obligations (09 Oct deep review)

These are required additions to the relevant cards, not implementation ticks. Read [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md) for exact symbols/lines, transactions and independent acceptance cases. All PRD requirements are covered in [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md).

- **C01 — Permission scopes are not propagated consistently** (W01, W03, W04): Build the per-procedure subject/company/OU/field scope map from docs08. Intersect filters with live grants, check both old and new placement on mutations, and resolve statutory/compensation grants separately. Preserve existing scoped muster/supporting report and audit queries; this finding does not say all routes are unscoped.
- **C16 — Notification receipt, drain and transport are incomplete** (W02, W03): Complete F04 short durable leases, idempotent outbox keys, transport retry/backoff/dead-letter and provider/in-app receipts; create every queue on a clean DB before schedules. Resolve SLA intimation source D04. Required policy thresholds belong in validated settings.
- **C18 — An unreturned asset becomes reusable stock** (W01): Model physical receipt separately from not-returned/loss/dispute disposition. Keep outstanding custody and clearance blocked until signed recovery/write-off decision; resolve approved recovery through F&F obligation, never through inventory status alone. Add row/state locks and transition guards so return/loss/assignment cannot race.
- **C19 — Policy acknowledgement eligibility and KPI population disagree** (W03, W04): Reuse one eligibility query for list, content, acknowledge, reminder, tile and export; record policy version/audience semantics under D11. Validate effective publication behavior, and preserve legitimate historical acknowledgements without counting them in an unrelated current population.
- **C20 — Letter creation is fragmented and merge identity is overridable** (W03): Define protected authoritative merge fields and allowed supplementary schema. Escape/render content according to MIME; stage object bytes and atomically create metadata+letter+workflow attachment+audit/outbox. Add versioned template/content provenance, rejection state and issuance eligibility; clean orphans through reviewed reconciliation, not deletion of approved history.
- **C21 — Several audited mutations commit before their audit/outbox** (W01, W02, W03): Inventory every mutation in deep-code-index.json. Put domain state, masked audit and required outbox into one DB transaction, lock/version-check the affected record, inspect row counts and return its committed version. External effects use F04 outbox/object staging. Preserve already-atomic createRequest/act, asset assignment and ticket creation.
- **C25 — Attendance/report figures use incomplete or wrong source semantics** (W04): Define authoritative payable-session units and approved OT aggregation under D05/D06, effective population/history and exact docs06 denominators. Use validated immutable/snapshot inputs with freshness metadata and drilldowns; preserve unavailable nulls until payroll/contract inputs exist. Snapshot/filter/export populations must remain consistent after transfers.
- **C26 — Helpdesk allows unrelated users to read/reply by ticket ID** (W02): Specify ticket participation and agent population; check it before thread/reply/status/export. Mask/restrict internal notes independently. Resolve category role routing against subject scope instead of first role holder. Do not fix the leak by removing employee ability to report an issue.
- **C27 — Helpdesk receipt, escalation and historical SLA reporting are incomplete** (W02, W04): Add approved escalation-recipient/level matrix and append-only SLA lifecycle evidence under D11. Make sweeps conditional/atomic with notification outbox, distinguish queue/receipt/ack, and define monthly hit-rate numerator/denominator including late resolved cases and reopen cycles.
- **C32 — Contextual help and training need an explicit completion card** (W05): Add W05 contextual help, one-page role guides and approved short walkthroughs tied to real permitted workflows. Keep implementation task/API details out of employee guidance. No LMS/appraisal product is added.
- **C33 — Reliability artifacts require operating proof** (W04): Execute and retain docs14 tiered reliability evidence at the appropriate stages; role-separated DB credentials, pool/read/report topology, worker lag/dead-letter/device alarms, restore drill and real scale fixtures. Add payroll independent goldens/property/mutation/shadow checks as P02/P03 land. Avoid counting a configuration file as a completed operational control.
- **C34 — Engagement APIs need full structured survey and publisher surfaces** (W03): Resolve survey schema D11 and audience/scope rules; reuse existing anonymous dedupe, add approved publisher/editor/results/export screens and structured question/version/response model only after spec reconciliation. Do not derive recommendations from unspecified survey data under SOW194 without D08.
- **C35 — Money discipline must include asset costs and future obligations** (W01): Use approved decimal-string/paise DTO conversion and core Money for monetary operations, central rounding and preserved NUMERIC storage. Link inventory cost to an independently approved recovery obligation rather than silently deducting cost; FX precision and rate provenance remain D10.
- **C36 — Absence/late alerts and scheduling semantics need full workflow coverage** (W03): Resolve automatic vs deliberate HR letter issuance under the spec and D04; implement idempotent per-day/policy alert keys, configured effective recipients/timezone/calendar and report partitioning by authorized audience. Reconcile gaps before absence action, retain due-date/case/history and actual receipt proof.
