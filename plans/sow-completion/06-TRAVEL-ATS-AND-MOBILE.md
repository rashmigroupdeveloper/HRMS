# T&E absorption, ATS and mobile scope

Read docs 00 D3/D4, 01 TE-01–12/ATT-14, 11 **including §0 amendments**, 03/04 money, 08 workflows, 10, 13/14 and UI05/12. Track T1–T4 in `plans/phase-3.5-travel-expense.md`. Phase 4 remains explicitly unscoped: its first task is a sanctioned PRD/contract, not guessed implementation.

`TravelPage.tsx`/`RecruitmentPage.tsx` are HRMS starting surfaces, not ported business engines. `api/router.ts` has no travel/ATS business module. Doc11 records a live external EMS implementation on earlier dates; it is not proof of access, current schema or today's transaction volumes. Never reuse old shared credentials. Authorized source capture must be read-only and sanitize PII/secrets before fixtures are committed.

## T01 — Faithful schema and policy port (Stage T1)

**Theory:** a trip expresses travel intent; budget authorizes entitlements; booking commits provider obligations; advance creates accountable funds; claim provides actual expenses/evidence; settlement reconciles expenses against accountable funds; payroll/off-cycle pays or recovers the net. These records are connected but not interchangeable. Travel A/B/C/domestic/international tiers are not payroll grade ranks.

Doc03 does not specify a complete `te` schema. Historical DB already contains pay budgets/claim lines/reservations with gaps versus doc03's simpler claims model. **Before migrations**, recover EMS model/service/tests and historical migration provenance (F01/D11), produce a field-by-field approved schema amendment reconciling P06 and T01, and choose one owner for shared claims/payout. Do not create duplicate `pay.claims` and `te.claims` for the same expense without an explicit distinction and linkage. Proposed separate travel schema/table names below describe responsibilities; exact names/fields are not yet locked.

| Object | Required relations / provenance |
|---|---|
| Trip and itinerary | Employee + legal payer, domestic/international, purpose/name; ordered flight/train/bus/hotel/car segments with dates/locations, visa subflow, documents and provider references (TE-01/02/04) |
| Budget and categories | Trip/employee, policy version and travel tier/region; mode/class/lowest-logical-fare/hours-cost, hotel nights, DA, visa, own-arrangement, local/misc; approved budget and approval history |
| Advance | Employee/trip/budget, requested/approved amount, workflow, funding/payout acknowledgment and wallet posting reference |
| Claim and lines | Employee/trip/budget/workflow, per-category reservation and original reservation budget; each bill links document, date, receipt number, expense type, currency/amount and segment/stay details |
| Wallet ledger | Employee/payer, source ADVANCE or CLAIM_SETTLEMENT, credit/debit, original amount/currency/FX, unique transaction reference, source obligation and settlement mode/actor/time |
| Settlement | Approved claim version and eligible advance postings; calculated settlement/net payable/recoverable, mode and actor/time, claim's settled status, payout/recovery obligation |
| Booking | Trip/segment/provider request/id/status/cost/currency; cancellation/refund evidence; independent from an approval step |
| FX and policy | Currency rates/source/effective timestamp and conversion rounding version; effective travel entitlement policies with approved provenance |

Create real FKs for internal links, checks for positive amounts/valid dates/currency/rate/state, one-active-claim-per-budget business key, immutable ledgers and idempotency keys. Preserve source `_id`→new PK map and external `userid`→employee map; do not join people by a fuzzy name or discard a mapping because employee changed entity. Approved tier missing means blocked budget, not automatic A/default tier.

Port budget rules from `budgetAllowances`/`internationalTravelPolicy` and recorded real examples; no guessed rates/classes/ceilings. Version policies; show eligible baseline and excess requiring higher approval (TE-06), not silent cap or block. Verify calendar/segment overlap/number of nights, itinerary changes, own-arrangement reasons and cancelled segment costs. Imported legacy fixtures are not the statutory payroll rate source.

**Money/FX:** use backend Money for INR settlement, retain original currency and exact captured conversion rate/source. D10 must approve currency minor-unit precision and conversion rounding; existing INR paise type must not silently be reused for every currency. Never fetch today's rate to recalculate an already approved claim. Handle different bill currencies per line, preserving FX map and derived INR totals. Account for non-refundable booking/cancellation amounts under approved policy rather than negative expense tricks.

**Acceptance:** verified EMS budget examples reproduce exactly; category sum equals total; no invented employee/tier; shared claim model has one authoritative obligation; immutable ledger/budget reservation constraints and concurrent claim tests; source model/schema mapping reviewed with signed gaps before T1 done.

## T02 — Advance, claims and settlement (Stage T2)

Reuse P06 reservation/verification and P04 payout primitives. Workflow chains follow TE-07/11 and approved amount thresholds in settings, with no date-of-month cutoff. Send-back releases/moves reservations against `budget_reserved_id` before resubmission; it cannot refund a newly selected budget for a reservation made against the old one. Scope/resubmission transaction follows A03. Claim bill verification precedes financial approval; approving request cannot make a missing bill verified.

**Advance:** authorization and actual disbursement are distinct. Original stage says approval credits wallet; decide D10 whether that credit represents committed accountable funds or funds actually sent. Preserve that distinction in posting/funding evidence so payroll does not recover an undisbursed amount. Lock wallet/obligation on posting; unique transactionReference prevents repeat approval/retry credit. Balance is SUM of immutable postings; any materialized balance is a reconciled projection, never authority.

**Reservation:** line/category demand and approved/active claim consumption must use a signed formula distinguishing reserved vs approved vs paid. Lock budget/category on reserve/change/release; two concurrent requests cannot overconsume without required excess approval. One active claim per budget matches captured EMS partial unique index. Terminal rejection/deletion cancels reservation by compensating event; no ledger deletion. Define amendment after approval/settlement explicitly under D11.

**Settlement:** calculate approved eligible expenses minus eligible accountable advance for that claim. Illustrative arithmetic (not policy): ₹10,000 funded advance and ₹8,000 approved expense → ₹2,000 recoverable; ₹12,000 expense → ₹2,000 payable; equal → zero. The common expense/advance amount is cleared, while only the net becomes a new payable/recoverable. Budget amount is not expense amount. Previously settled/returned/consumed advance cannot be reused. AUTO/MANUAL mode records authorizer and reason, not arbitrary manual net overrides.

Commit claim settled state, wallet settlement postings, released reservations, net obligation, audit and outbox atomically. Record settlement mode/settledBy/At and original source keys. P02 consumes recoverable once as approved deduction or approved carry-forward policy; P04 pays payable via payroll **or** off-cycle batch, never both. Manual cash/bank return must have acknowledgment and a separate reversal/return posting; closing a claim is not proof of employee recovery. Cross-entity funded advances cannot be silently netted against a different legal payer.

**Concurrency/crash rules:** lock source claim/version and wallet/budget records in stable order; retry by unique settlement reference. Approval retry, worker retry, run recomputation and payment retry must preserve one obligation/consumption. Claimed line changes after approval require a new revision/approval; completed financial effects require compensating events. Never edit posted wallet amounts to force zero balance. Nonnegative wallet policy must distinguish debt/recoverable record from wallet available funds; do not silently truncate debt to zero.

**Screens:** advance request/tracking with funding proof; claim line form with bill/FX preview and budget utilization; verifier sees original evidence and decisions; approver sees scope, excess and chain; settlement breakdown shows advance cleared/net payable/recoverable/carry-forward/payment-run reference. Employee and finance see the same committed figures with appropriate masking. No “settled” label while payroll deduction or net payment is unacknowledged without showing those separate statuses.

**Acceptance:** advance greater/equal/less than expense; multiple currencies; rejected/sent-back/budget switch; partial approved lines; concurrent attempts; no duplicate wallet posts or payroll recovery; cash return/carry-forward/off-cycle branch; insufficient funds/failed payment; conservation after each event and same results after replay. G3.5 requires a real payroll-connected settlement, not these unit tests alone.

## T03 — Booking connector and screens (Stage T3)

Obtain recorded MMT Corporate contract, sandbox/test authorization and sanitized responses. Define swappable connector for requisition, booking/reference URL, status/cost and cancellation/refund; unsupported provider capabilities remain explicit. HTTP request and DB transaction cannot be atomic: persist operation intent and idempotency/reference, call provider outside lock, reconcile uncertain outcome before retry. Verify callback authenticity/replay and allow-listed booking URL. No assumed provider endpoints, credentials or service-level promises.

Rebuild in Warm Editorial, preserving backend behavior only: trip wizard/itinerary, policy-backed budget preview, own-arrangement justification, visa steps, advance, line claims/receipt upload, settlement history and travel admin queues. Each displayed figure identifies policy/FX version and is server-derived; draft editing does not change approved obligations. Cancellation shows reason, confirmed provider cost/refund and approval state separately.

**Acceptance:** connector contract fixtures and real authorized staging round trip; repeated/timeout request no duplicate booking; refund/cancellation conservation; every interactive state and both-theme accessibility; no MUI/second UI primitives; request→approval→booking→claim context persists through screens.

## T04 — Migration and retirement (Stage T4)

Capture a timestamped read-only source inventory of users/trips/budgets/claims/advances/wallets/transactions/rates and object metadata; previous 06 Jul counts are historical. Validate actual fields and unique keys before mapping. Import via immutable source mapping and versioned batch/report; quarantine unknown employee/entity/tier/reference, unsupported state, FX gaps and missing receipts. Import opening ledger with proven balance/source movements; don't count both historical transactions and an opening total for the same period. Every wallet and reservation balance must reconcile independently to source.

Mirror MinIO source objects into SeaweedFS through the storage adapter; record original key→new key, byte size/content hash and missing file exceptions. Maintain metadata/document FK integrity and access scope. Source remains read-only recon until a controlled cutover.

Define the exact parallel ownership window: which system accepts new requests, when old writes freeze, final delta export, pending approvals/advances transfer and queued notification handling. No uncontrolled dual-write settlement. Sponsor approves reconciled counts, every financial balance, receipt hashes, pending workflows and rollback checkpoint. After cutover, old requests cannot issue payments or ledger events. Archive recoverably and restrict legacy access; PM2 retirement/storage retirement is a separate explicit operational action after proof and sign-off, not a migration script side effect.

**Acceptance:** per-collection counts/keys/statuses; per-employee wallet and obligation to paise; FX totals and document hashes; missing/extra rows disposition; one full real trip with payroll settlement; signed freeze/cutover/restore evidence; no credential reuse. Then G3.5 review.

## R01 — ATS boundary, then absorption (Stage 0.6 SSO / 3.1 LOI / Phase 4A)

Before absorption, validate the actual authorized ATS contract and stable external IDs for LOI/candidate/join status. Doc02 currently chooses a direct **read-only cross-database** read/sync boundary until absorption; retain that choice unless an approved architecture amendment changes it. A connector still defines its typed intake contract, source cursor and replay behavior; frontend never imports the other project's source. HRMS owns employee identity; ATS owns candidate/requisition/offer until approved cutover. Preserve explicit candidate→employee linkage once hired, authorized document access and idempotent offer changes.

Known approved Phase 4 scope: `recruit` schema candidates/vacancies/offers; LOI Initiator→Plant Head/GM→HR Head→CEO→issue workflow; R21/R22 internal source; Warm Editorial `/recruitment` shell; standalone retirement. Full candidate screening/interview/offer schema, state transitions, salary negotiation controls and shared report template are **not specified sufficiently in current pack**. First deliver a source-code/schema/route/test inventory from ATS, signed PRD and exact migration/API contract. Don't manufacture recruitment features to fill a placeholder.

Reuse workflow notification/attempt logic, L01 conversion and P01 salary authority. Offer approval writes issued LOI snapshot; an altered CTC/probation after approval requires reapproval. Issuing offer ≠ accepted ≠ joined. Replays cannot create duplicate employee/e-code. Absorption must migrate references/attachments/pending approvals with counts and retire legacy write ownership only after acceptance. SSO permission mapping cannot grant payroll access simply because ATS logged someone in.

## X01 — Mobile geo attendance and contract workers (Phase 4C/4B)

ATT-14 requires sales/field mobile attendance feeding the same attendance pipeline. Existing mobile source enum/storage path is a scaffold. Approve exact policy/PRD for geofence, captured location accuracy, device/identity evidence, offline queue, trust of timestamp, supervisor exceptions, retention and employee notice. No guessed radius, fraud score, tracking interval or all-day tracking.

Proposed submission includes authenticated subject, server receive time, approved client capture evidence, unique event key and source='mobile'; coordinates only under approved purpose/retention. Validate duplicates/stale/offline events and timezone, preserve immutable event provenance, reconcile to day/session processing. Server authorization and anomaly handling are required; a frontend GPS marker is not identity proof. ESS PWA shows capture/queued/sent/accepted/rejected states and own resulting attendance; retries preserve key. Approve ATT-14 pull-forward as a stage amendment if required before Phase 4.

Contract workers remain D3 deferred. Deliver workshop/PRD covering contractor identity/legal payer, gate-pass linkage, contractor muster, compliance, authorization and report denominator before schema/UX. Do not model contractors as normal payroll employees merely to populate CEO Contract column. Activate that metric only after approved source and reconciliation. This plan includes the scoping work; it intentionally does not invent missing contractual or legal rules.

<!-- DEEP-AUDIT -->
## Current code repair obligations (09 Oct deep review)

These are required additions to the relevant cards, not implementation ticks. Read [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md) for exact symbols/lines, transactions and independent acceptance cases. All PRD requirements are covered in [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md).

- **C30 — Pending screens and workflow definitions are not domain implementations** (T01, T02, T03, T04, R01, X01): Build the already-specified P/L/T/R/X cards in existing stage order, using the verified foundational boundaries and signed decisions. Keep pending UI honest; replace hand-authored assumed DTOs with the approved generated contract when each domain lands. Obtain external source/checkouts before claiming ATS/EMS absorption coverage.
- **C35 — Money discipline must include asset costs and future obligations** (T02): Use approved decimal-string/paise DTO conversion and core Money for monetary operations, central rounding and preserved NUMERIC storage. Link inventory cost to an independently approved recovery obligation rather than silently deducting cost; FX precision and rate provenance remain D10.
