# Lifecycle and final settlement

Read docs 01 M5, 03 §7, 04 lifecycle/§6.7, 08 workflows, 09 LOI recon, 10 statutory, 13 Phase 3 and 14. Execute the corresponding stage in `plans/phase-3-lifecycle-assets-executive.md`. Requirement families: LC, PAY-02/07/15, CORE-02/06/08, AST-04, RPT-02/05. SOW assignments are exhaustive in the crosswalk.

## Starting evidence and data contract

`backend/src/modules/lifecycle/{lifecycle.router,boarding-exit.service}.ts` provides boarding/exit queries and exports; `frontend/src/pages/lifecycle/LifecyclePage.tsx` is not a complete lifecycle mutation module. Generic confirmation/resignation/transfer workflow definitions do not establish domain execution. Do not mark a flow delivered from these names.

| Relationship | Specified purpose / completion rule |
|---|---|
| ATS candidate + LOI reference → `core.onboarding_candidates` | External references, not a cross-database PostgreSQL FK. Validate a signed/versioned integration contract; retain external source and replay key. |
| Candidate → `core.employees` → `core.users` | Convert once; employee is business identity, user is login. Atomic e-code allocation using existing DB function. `employee_id` on candidate records conversion. |
| Employee → `core.onboarding_tasks` | Explicit assigned stakeholder, due date, completion actor/time; biometric registration is evidence, not a checked box without an external result. |
| Employee → `core.probation_reviews` → `wf.requests` | Approved outcome controls confirmation/extension/separation; due date and salary effective date are related but distinct. |
| Employee → `core.employee_history` | Before/after organization, reporting manager and category facts with effective dates; resolve complete temporal model under D07/D11. |
| Employee → `core.separations` → `wf.requests` | Requested LWD remains separate from approved LWD. Preserve resignation date, reason and initiating actor. |
| Separation → `core.clearances` | One department row per separation; positive evidence and explicit flagged items. |
| Separation → `pay.fnf_settlements` → `pay.payroll_runs` | Reciprocal `fnf_id`/`separation_id` must resolve to the same settlement, with real FKs and unique business keys in reconciled schema. |
| Clearance → asset allocations, loans, claims, documents | Proposed explicit evidence references. Free-text remarks alone cannot settle custody or a financial obligation. |

Doc 03 tables are a baseline contract, not proof they are reproducibly migrated/typed today. Resolve missing migrations first. New token expiry/hash, effective assignment, obligation links and clearance evidence records below are **proposed schema amendments**, requiring approved spec changes and migrations; do not silently add columns to fit a screen.

## L01 — Joining and onboarding (Stage 3.1)

**Theory:** an accepted offer is a proposed employment agreement; joining establishes employment. Sending a prejoin email does not establish delivery, completion or joining. Keep no-show/cancellation separate from active employees and headcount.

1. Validate the incoming LOI against its documented §1–4 fields: personal identity/contact, offered position/unit/category/replacement e-code, offered CTC, probation duration/percentage, proposed DOJ/location and employment terms. Map department/unit/designation labels to sanctioned masters or quarantine; do not create masters automatically from typos.
2. Upsert candidate by verified external reference/idempotency key; reject conflicting repeated payloads for review. Store contract version and source provenance without logging PII. Send a bounded, revocable prejoin invitation through F04. The baseline plaintext token is unsuitable for production: propose hash-at-rest, expiry, single-use and access limited to that candidate, with approved retention. Public invitation access is a documented narrow exception to authenticated business APIs (D03), never a general employee API bypass.
3. Candidate submits validated personal/bank/statutory/dependent data and documents. Mark prejoin complete only when required fields pass F02 and document persistence succeeds. HR reviews mismatches; do not overwrite a previously confirmed statutory ID through an ATS retry.
4. On verified joining, lock candidate, validate eligibility and canonical company, allocate e-code once, create employee/user linkage, create effective salary setup obligation and stakeholder tasks, append audit and enqueue notifications in one DB transaction. External mailbox/Kent/object actions occur afterward through idempotent workers.
5. Stakeholder task completion requires evidence (email identity, Kent employee binding, allocation record, induction acknowledgment, salary assignment). Escalation resolves current entitled actors and records delivery; role labels alone are not a recipient list.

**Screens:** offer register uses exact R21 columns including probation % and LOI Accepted/Rejected/Yet to Accept; prejoin form shows required fields, validation, saved draft and outstanding documents; HR conversion preview shows source→master mapping and duplicate candidates; onboarding board shows owner/deadline/delivery/evidence and blockers. Never render statutory fields to an unauthorized stakeholder. Joining changes are not possible through a report filter.

**API design:** add candidate intake/read/review/convert and task completion procedures through the lifecycle public API boundary. Names and paths are proposed; pick registered permission codes from the seeded catalog or amend its spec. Scope by authorized entity/employee and candidate ownership; no handler role literals. Emit OpenAPI and regenerate frontend client.

**Acceptance:** duplicate LOI/concurrent conversions create one employee/e-code; no-show leaves no active salary; invitation cannot read another candidate or replay after conversion; missing required bank/Kent/salary task remains visible; R21/R24 counts tie to domain records; successful mail receipt and conversion audit are inspectable.

## L02 — Probation and confirmation (Stage 3.1)

Use actual DOJ, contractual duration and existing review history to derive due reviews; period arithmetic/calendar and extension rules must be signed, not approximated as months×30. Workflow records manager recommendation, extension months/reason, approver, outcome and effective date. Extension creates a new review event/due date; it does not rewrite the earlier decision. Termination starts L04 rather than deleting the employee.

On final confirmation approval, atomically record the review outcome and a new effective salary assignment (P01), update the derived current employment state and append audit/outbox. Never edit a prior paid salary assignment. A mid-month switch requires D10's approved segmentation; a past effective date becomes a retro delta. Reminder/escalation deadlines use F04 delivery semantics.

**Screens:** probation queue and R25 show DOJ, due date, tenure, recommendation and overdue status; review form shows 70/80/90 contract percentage only if supported by actual LOI, effective salary preview and required approval. Employee sees the approved letter and date, not internal manager notes without entitlement.

**Acceptance:** repeated approval cannot double-switch salary; extension does not trigger confirmation pay; an absent/late manager is escalated and notified; payroll compares before/after effective segments with independent money expectations; dates and R25 reconcile.

## L03 — Transfers and promotions (Stage 3.3)

**Theory:** movement changes assignments, not person identity. Stable employee PK is the join key even if an approved company-specific e-code policy issues a new external code. Do not casually regenerate e-code or move historical attendance/payroll under today's company.

Transfer request captures old/new company, location/plant/OU/department/manager/designation/grade and effective date, reason, salary impact if any and approving workflow. Only documented movement fields may be changed; resolve temporal assignment/e-code policy in D07/D09. Check every new master belongs to the intended entity. Cross-company movement must explicitly determine closing/opening statutory employment and YTD treatment under Payroll/Legal approval; identity preservation does not imply merging legal payer liabilities.

After final approval, transactionally append history/effective assignments, update derived current fields, schedule effective salary/recomputation/scope changes and notify old/new owners. No closed attendance/payroll rewrite. Pending approvals are reassigned only under an explicit workflow transition with audit; asset custody remains until an actual return/reallocation event. Persist a future-effective transfer as scheduled, not instantly effective.

**Screens:** old→new comparison; effective-date validation; impacted approvals/salary/asset owners; history timeline and R23. Preview is server-calculated; action labels distinguish scheduled from applied.

**Acceptance:** future transfer doesn't alter today's access/headcount; historical reports use as-of assignment; approval retry applies once; unauthorized destination entity rejected; cross-company case has sanctioned statutory/YTD treatment and balanced cost allocations.

## L04 — Resignation, withdrawal and clearances (Stage 3.2)

Create separation and workflow atomically via the existing workflow attach pattern. Prevent concurrent active separations through an approved business key. Validate resignation date/requested LWD/notice terms against the contract, not a global invented notice period. HR-initiated absconding/termination requires its documented evidence trail from absence cases; automatic detection cannot silently terminate employment.

Approval fixes approved LWD, sets `on_notice`, creates IT/Admin/Finance/HR clearances and F&F draft/outbox atomically. Authorized withdrawal/rejection retains history, cancels unresolved tasks and reverses only authorized unlocked effects; define withdrawal after approved/paid settlement explicitly (D11). A flagged clearance lists custody/debt evidence, proposed recovery and approver; it is not itself a payroll deduction. Finance must approve the recoverable amount and lawful treatment before P02 consumes it.

Lock separation/clearance rows on transition; require expected state/version to avoid double completion. Queries enforce subject access; line managers/clearance teams see only their assigned scope. API permission does not substitute employee ownership. IT cannot use clearance as authority to view unmasked payroll/bank fields.

**Screens:** ESS resignation shows notice comparison and tracked notification/approval steps; HR exit queue shows requested vs approved LWD, pending clearances, legal/internal deadlines and F&F status; department view shows its concrete obligations and evidence; employee sees allowed status/reasons. R24/R26 use the same record and filters.

**Acceptance:** every approval step has the promised delivery evidence; withdrawal cannot leave active deductions; assets are returned or explicitly approved for loss/recovery; loan/advance balances reconcile; approved LWD flows once to employee status and statutory DOL exports; lost-notification scenario is reproduced and passed.

## L05 — F&F and alumni (Stage 3.2)

F&F reuses P02/P03; no second salary/statutory calculator. Freeze approved LWD and input provenance: days payable from locked attendance through LWD, unpaid/held salary liability, leave encashment under policy, approved notice recovery, loan/advance outstanding, claims reimbursements, approved asset recoveries, gratuity/bonus/other heads and TDS. Capture source record/version for each head and attach a `calc_note`. Settlement preview must distinguish proposed vs approved clearances and money. Gratuity eligibility/rates/caps and tax treatment need D01/D10 official-policy confirmation; do not hardcode the baseline shorthand.

State path follows doc 03: draft → clearances_pending → computed → approved → paid, with authorization and audited allowed reversals before commitment. `paid` requires recorded payment acknowledgment, not generated bank file. Lock/recompute rules follow P02; repeated settlement/release/payout cannot reuse a payroll obligation. Two F&F runs in one month must be possible under approved run identity; baseline unique company/month/type conflict is D11. Intercompany recoveries/payments remain balanced by legal payer.

Track contractual SOW three-working-day service turnaround separately from applicable wage payment deadline; Legal resolves D01/D11. Clearance delay cannot be assumed to extend statutory wages. Show deadline origin, clock start and unresolved exception. No automatic three-day SLA promise until source timezone/calendar/cutoff is approved.

Generate R18 statement, payslip, bank/JV/statutory outputs from the frozen settlement. Relieving/experience letters use approved employment dates and the paid/cleared eligibility in docs 04; salary certificates derive from approved payroll/salary data rather than untrusted supplied gross. Any sponsor exception needs an audited decision and new eligibility rule.

Exit changes access at approved effective date. Alumni may read only their own payslips/Form 16/allowed letters through a restricted central permission and ownership policy. Docs conflict between deactivating user on exit and retaining alumni login: decide D03/D11, don't disable then bypass auth. Preserve employee, audit, ledger, statutory and storage history; no hard delete.

**Screens:** input/source breakdown, clearance blocker list, every calculation line, taxable treatment and approved revisions, payout acknowledgment, letters with eligibility explanation and alumni own-document library. No editable final net field or naked negative-net bank export; negative recovery handling requires signed P02 policy.

**Acceptance:** positive/zero/negative settlement cases; paid hold release once; advance/loan/asset conservation; two monthly F&F cycles; correct dates/statutory bases; independently checked money; R18/bank/JV totals agree; paid-letter gate; alumni cannot access active employees; one real exit through payout/letters and sponsor sign-off for G3.

<!-- DEEP-AUDIT -->
## Current code repair obligations (09 Oct deep review)

These are required additions to the relevant cards, not implementation ticks. Read [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md) for exact symbols/lines, transactions and independent acceptance cases. All PRD requirements are covered in [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md).

- **C01 — Permission scopes are not propagated consistently** (L01): Build the per-procedure subject/company/OU/field scope map from docs08. Intersect filters with live grants, check both old and new placement on mutations, and resolve statutory/compensation grants separately. Preserve existing scoped muster/supporting report and audit queries; this finding does not say all routes are unscoped.
- **C16 — Notification receipt, drain and transport are incomplete** (L01): Complete F04 short durable leases, idempotent outbox keys, transport retry/backoff/dead-letter and provider/in-app receipts; create every queue on a clean DB before schedules. Resolve SLA intimation source D04. Required policy thresholds belong in validated settings.
- **C18 — An unreturned asset becomes reusable stock** (L04): Model physical receipt separately from not-returned/loss/dispute disposition. Keep outstanding custody and clearance blocked until signed recovery/write-off decision; resolve approved recovery through F&F obligation, never through inventory status alone. Add row/state locks and transition guards so return/loss/assignment cannot race.
- **C20 — Letter creation is fragmented and merge identity is overridable** (L01, L02, L05): Define protected authoritative merge fields and allowed supplementary schema. Escape/render content according to MIME; stage object bytes and atomically create metadata+letter+workflow attachment+audit/outbox. Add versioned template/content provenance, rejection state and issuance eligibility; clean orphans through reviewed reconciliation, not deletion of approved history.
- **C30 — Pending screens and workflow definitions are not domain implementations** (L01, L02, L03, L04, L05): Build the already-specified P/L/T/R/X cards in existing stage order, using the verified foundational boundaries and signed decisions. Keep pending UI honest; replace hand-authored assumed DTOs with the approved generated contract when each domain lands. Obtain external source/checkouts before claiming ATS/EMS absorption coverage.
- **C31 — Master import/read implementation does not complete master governance** (L01, L03): Implement the full signed F02 field ownership/validation/catalog/editor/import plan and C01 scope. Define deliberate active/onboarding populations and align facets/list without hiding exited discoverability. Account/entity normalization is approved mapping, not fuzzy inference.
