# Phase 3.5 — Claims & Travel (M12/M13): supersede the live EMS claim portal

**Target:** 4–6 weeks · **Gate:** G3.5 · **Spec:** docs/13 §6, docs/01 §8b (TE-01..12), docs/11
**Purpose:** the permanent, better version of the group's live claim system — ported to Postgres, wired into payroll, rebuilt in Warm Editorial, then EMS is retired.

> **Scope confirmed 3 Sep 2026 (sponsor): Travel & Expense and claims both stay IN scope**, rebuilt
> in our own UI/UX rather than integrated or left standing. This is the opposite call to the ATS and
> the CLMS, and deliberately so: claims and advances settle **through payroll** (advance recovery,
> reimbursement, deduction), so they cannot sit outside the system that runs payroll. Recruitment
> and contract labour have no such coupling.

---

## 🔴 The plan was aimed at the wrong core — corrected 3 Sep 2026

Sponsor supplied a full operational brief for the live system (**EMS / "ASTF Claim Portal"**,
`ems.rashmimetaliks.com`), which corrects two assumptions this phase was built on.

**Correction 1 — the live product is a CLAIM system, not a trip system.**

| Module | Live status |
|---|---|
| `budgets`, `claims`, `advances`, `approvals`, `auth`, `users`, `email`, `dashboard`, `analytics`, `finance`, `currency` | **in real use** |
| `trips`, `mmt`, `locations` (airports/hotelcities/carcities/trainstations), `wallet` | **built but never rolled out — 0 records in every one** |

docs/11 framed this as a travel system whose clever part is the wallet/settlement engine, and
TE-01..12 was written accordingly — trip-first, with the trip as the entry point. **That is not what
runs.** Zero trips, zero wallets, zero wallet transactions have ever been created. The thing 1,066
employees actually touch is **Budget → Claim → approval**.

**What this changes:** T1–T4 must be re-ordered so the *claim* spine is built and cut over first,
and the trip/booking/wallet surface is treated as greenfield (build it because M13 wants it, not
because we are replacing something in use). Porting a wallet ledger faithfully is meaningless when
production has never written a row to it.

**Correction 2 — the approval chain is a dynamic org walk, not a fixed chain.**

Not `RM → Travel Admin → CEO`. The live `escalationHelper.ts` (shared by claims, budgets and
advances) walks the **submitter's own** hierarchy from their user record:

```
submitter → reporting_manager_id → hod_id → Admin (final)
```

with four rules that are the actual specification and must be ported exactly:

| Rule | Behaviour |
|---|---|
| No valid RM on the record | skip straight to HOD |
| No valid HOD on the record | skip straight to Admin |
| Submitter **is** the Admin | auto-approved ("Admin Supremacy") |
| Submitter **is** an HOD | skip the RM step, go straight to Admin |

Per step the approver may **Accept · Reject · Send Back**, and the server refuses anyone who is not
the exact current pending approver (*"It is not your turn to approve this request"*).

HRMS's `wf` engine plus `core.reporting_tree` can express all of this, but **the skip-when-missing
and self-approval shortcuts are not currently modelled** — they need to be explicit chain rules, not
emergent behaviour. Add to `T2`.

## Semantics to port exactly (these are money rules)

1. **A budget must reach `Approved` before any claim can attach to it.** The backend blocks
   submission otherwise. Two-stage approval — budget first, then claim.
2. **The claimed amount is reserved from the budget at SUBMISSION, not at approval**, and refunded
   to the budget if the claim is rejected. This is a commitment ledger, and it is the single most
   important behaviour to reproduce: get it wrong and budgets silently over-commit.
3. Attachments live in MinIO (`ems-uploads`, real claim receipts confirmed present) → mirror into
   the SeaweedFS S3 adapter at migration.

## Migration is trivial *today* — and that is the argument for doing it now

Live volumes: **users 1,066 · budgets 7 · claims 2 · advances 1 · currencyrates 5 · everything else 0.**
A fully loaded employee master with essentially no transactional history. Every month of adoption
makes TE-12 harder, and this is as cheap as it will ever be.

**Password hashes are portable.** EMS stores bcrypt at **cost 10**, and HRMS hashes at cost 10
(`bcrypt.hash(plain, 10)` in `auth.service.ts`), so the 1,066 credentials carry over — employees do
not re-enrol. Confirms doc 11 §0.1. *Verify with `bcrypt.compare` against a sample before relying on
it.*

## Two live-system problems HRMS should fix rather than inherit

- **Single admin account for 1,066 employees** is the final approver for every claim, budget and
  advance in the group — an availability and audit single point of failure. In HRMS the final step
  is a *permission* (`claims.approve`) held by a role with several holders, and delegation already
  exists (WF-01). **Do not port the single-admin model.**
- **Signup depends on Twilio SMS OTP**, whose delivery is already flagged as unreliable in the live
  brief. HRMS logs in by e-code against the migrated hash, so the cutover removes this dependency
  entirely rather than reproducing it.

## Access & security note

Server, database, MinIO and Twilio credentials for the live system were shared in chat.
**Per CLAUDE.md §5 they must be rotated**, and the Twilio auth token is the most urgent — it can be
used to send SMS at the group's cost from anywhere. No credential is recorded in this repository,
and all recon to date has been read-only. If exact field-level schemas are needed later, the cheapest
safe route is a `mongodump` of `ems_db` (or a `findOne()` per collection) handed over as a file,
rather than granting an agent live production access.

> **Already harvested from this system:** the `send_back` action is in the HRMS workflow engine, and
> the `approvals[]` embedded-array shape informed WF-01.
>
> **Design firewall (docs/05 §0.1):** we port Yatra Avedan's *backend logic and data* — never its MUI screens. Every T&E screen is rebuilt from the frontend design system (`frontend/src/ui`). A ported MUI component is a defect.

---

## Ported faithfully vs deliberately improved

Live recon: [`docs/recon/ems-claims-live-schema.md`](../docs/recon/ems-claims-live-schema.md).
**Behaviour that people's money depends on is copied exactly. Mechanism is not.** The distinction
matters: if a settlement figure came out differently after the port, that is a defect; if the same
figure is reached by a ledger instead of a counter, that is the point of rebuilding.

**Copied exactly — a claim must behave identically**

| Rule | Why it is not negotiable |
|---|---|
| Budget must be `approved` before a claim can attach | changing it changes who can spend |
| Amount reserved at **submission**, refunded on rejection | the anti-over-commitment rule itself |
| Per-category reservation snapshot (`budgetReserved{}`) | categories are individually capped; a refund must return the same buckets |
| Reservation may sit on a different budget than the claim now points at (`budget_reserved_id`) | the refund must go where the money came from |
| Only a **rejected** claim frees its budget | a settled claim still blocks a second one |
| `approvedBudget` distinct from `totalEstimatedCost` | an approver may grant less than the ask |
| Settlement: `AUTO = min(advance, claim)`; `MANUAL` refuses above claim, then above advance | decides what reaches a bank account |
| Approval walk `RM → HOD → final`, with skip-if-missing, skip-if-self, and **skip RM when RM is also the HOD** | one person must not approve twice |
| `send_back` as a first-class action | already adopted into WF-01 |
| The budget **is** the travel request — one object | two objects would mean two places to describe one journey |

**Deliberately improved — and each has a reason**

| Live | Ours | Why |
|---|---|---|
| Mutable counters (`Budget.claimedAirfare…`, `Wallet.walletBalance`) | **Append-only ledger**, position derived | CLAUDE.md rule 3. A maintained running total is one the app can get wrong invisibly, until finance finds it |
| No visible concurrency guard on reservation | Budget row `FOR UPDATE` inside the transaction | two simultaneous submissions must not both read the same headroom and both pass |
| Throws on settlement breach | Typed refusal naming the ceiling hit | a thrown error surfaces as "something went wrong"; the user should be told *which* limit |
| Rules enforced in app code | Also `CHECK` constraints + append-only trigger | no code path can slip past a money rule |
| Missing HOD → `findOne({role:'hod'})` — **any** HOD | Route to the HR/compliance queue | routing a claim to an arbitrary department head is a real leak |
| Single admin is final approver for 1,066 people | `claims.approve` permission, several holders, delegation | availability and audit single point of failure |
| Three status vocabularies (`Pending RM` / `RM_PENDING` / `TRAVEL_ADMIN_PENDING`) | One | same walk, one name |
| JS floats for money | Branded integer `Paise` | docs/14 §6 — floats never touch money |
| `approvals[]` with timestamps | WF engine: SLA, escalation, delegation, **`notified_at` receipt** | docs/13 rule 8 — "the approver was never notified" must be impossible |
| — | Hash-chained audit log | every consequential mutation is provable |

## The UI is ours, not a port

Nothing of the live front end comes across. Every screen is composed from `frontend/src/ui` under the
Warm Editorial firewall (docs/05 §0.1), which means the claims surfaces inherit the philosophy the
rest of the product already follows:

- **Claims join the existing `/approvals` inbox.** A manager clears a claim from the same place they
  clear leave, with the same SLA pills and batch actions. The live system's separate approval screens
  are exactly the fragmentation docs/05 §6 bans — a second inbox is a second thing to forget.
- **≤2 clicks for the daily action**, state preserved across navigation, forms autosave.
- **The blocked action explains itself.** A refused claim names the budget, the remaining headroom
  and the shortfall — never a disabled button. That is why `checkReservation` returns the numbers
  rather than a boolean.
- **Evidence over assertion** — a settled claim shows its settlement figure and what it was recovered
  against, not a green tick.
- Teaching empty states, contrast ≥4.5:1 in **both** themes, keyboard-complete, axe-checked,
  reduced-motion respected, and usable on a phone.

---

> **Re-ordered 3 Sep 2026.** T1/T2 now build the **claim spine that 1,066 people actually use**;
> the trip/booking surface moved to T5 and is treated as greenfield, because production has never
> created a trip, a wallet or a wallet transaction. Cutting over the live thing first is what
> retires EMS soonest.

## Stage T1 — Budget & claim spine   `[ ☐ ]`
**Goal:** the two objects the live system runs on, in Postgres, with the commitment ledger intact.
**Depends on:** Gate G3.
**Tasks:**
- [ ] TE-05 — **Budget**: purpose, period, entity/cost-centre, per-category allowance, status machine `Draft → Pending → Approved → Closed`. Grade-driven entitlements (`domestic_level` / `international_level` on the live user record — Dom-A..F, Int-A..C — carry over as HRMS grade attributes).
- [ ] TE-10 — **Claim** with line items: expense type, receipt no/date, amount + currency + `fxRateToINR`, attachments (S3 adapter). One active claim per budget, enforced by a partial unique index as in the live model.
- [ ] **The commitment ledger (highest-risk item in this phase).** The claimed amount is reserved from the budget **at submission**, and refunded **on rejection** — not moved at approval. Model it as an append-only reservation ledger (`balance = SUM(rows)`), the same discipline as `lv.ledger`, never a mutable `remaining` column.
- [ ] Claim cannot attach to a budget that is not `Approved` — enforced server-side, as live.
**Tests required:** reservation property test (budget remaining = allowance − SUM(active reservations), across submit/reject/resubmit/delete in any order); one-active-claim-per-budget; multi-currency capture.
**Exit criteria:** a budget cannot be over-committed by any sequence of submissions and rejections.

## Stage T2 — Approval routing (the org walk)   `[ ☐ ]`
**Goal:** reproduce the live routing exactly, on the generic WF engine, then improve the one thing that is a risk.
**Depends on:** T1.
**Tasks:**
- [x] **Dynamic chain from the submitter's own record**: `reporting_manager_id → hod_id → final approver`, resolved per request off `core.reporting_tree`, not a static chain. — `claim` and `travel_budget` chains seed as `reporting_manager → hod → role:hr_head`; `approval-chain.ts` is a pure port of the live `buildApprovalChain`.
- [x] **The four escalation rules, explicitly modelled** (they are the spec, not emergent behaviour): missing RM skips to HOD · missing HOD skips to final · submitter-is-final auto-approves · submitter-is-HOD skips the RM step.
- [x] Per-step **Accept / Reject / Send Back**; server refuses anyone who is not the exact current pending approver. — proven on the running server: the claimant's own approve attempt returns `403 Not the current approver`.
- [x] **Do NOT port the single-admin model.** The final step is the `claims.approve` permission held by a role with several holders, with WF-01 delegation. The live system has one admin for 1,066 employees; that is the one behaviour we deliberately change, and the rationale belongs in the cutover note.
- [ ] TE-07 — **Advance** request sharing the same routing; approval credits the employee ledger.
- [ ] TE-09 — **Settlement**: claimed vs advance held → net payable **or** recoverable; recoverable flows to payroll deduction (LN-03), reimbursable to payroll or an off-cycle batch (CLM-04).
- [ ] TE-06 — Over-budget is flagged for higher approval, never silently blocked.
**Tests required:** routing matrix over every combination of present/absent RM and HOD, and submitter-is-HOD / submitter-is-final; "not your turn" refusal; settlement matrix (advance >, <, = claim); a recoverable reaching payroll input.
**Exit criteria:** every live routing rule reproduced with a test naming it · settlement reconciles to the rupee on every path.

## Stage T3 — Warm Editorial UI   `[ ☐ ]`
**Goal:** every screen rebuilt in the house design language — zero foreign UI.
**Depends on:** T1; T2 for approval surfaces.
**Tasks:**
- [x] **Approval inbox integration** — claims join the **existing** `/approvals` inbox, not a second one. `summarizeRequest('claim', …)` gives the manager the reference, the amount in rupees, the budget it draws on, what is left on that budget, and **the line items as a table** — because a claim is decided on its lines, not its total. The lines travel WITH the workflow request, so a claim edited later cannot silently rewrite the history of a decision already taken.
- [ ] UI from `frontend/src/ui`: budget create + approval queue, claim form with line items and receipt upload, settlement view, finance queues.
- [ ] ESS: `/my/claims` already routed — fill it against the real API.
**Tests required:** component states ×7; axe in both themes; approval items appear in the existing inbox with SLA pills. — inbox rendering covered by `request-summary.test.ts` (money in lakh grouping, ids never shown as rows, lines empty for every non-claim type) and confirmed end-to-end against the running server.
**Exit criteria:** design review confirms no foreign UI language · a manager clears a claim from the same inbox they clear leave from.

## Stage T4 — Migration, parallel run, decommission   `[ ☐ ]`
**Goal:** EMS data in, parity proven, EMS retired.
**Depends on:** T2, T3.
**Tasks:**
- [ ] TE-12 — Migrate `ems_db` (users → match on `userid` = e-code; budgets, claims, advances, currencyrates) with per-collection validation reports. **Volumes are tiny today — 7 budgets, 2 claims, 1 advance — so this is a one-shot, not a programme.**
- [ ] **Carry the bcrypt hashes** (EMS cost 10 = HRMS cost 10) so 1,066 employees do not re-enrol; verify with `bcrypt.compare` on a sample before relying on it.
- [ ] Mirror the MinIO `ems-uploads` bucket into the SeaweedFS S3 adapter; verify every claim attachment resolves before cutover.
- [ ] Parallel run, then decommission: read-only freeze → export archive → PM2 process retired.
- [ ] **Cutover removes the Twilio SMS OTP dependency** — HRMS logs in by e-code against the migrated hash. Note it as a benefit in the comms, since OTP delivery is already unreliable.
**Tests required:** per-collection reconciliation counts; every migrated attachment resolves; a migrated user logs in with their existing password.
**Exit criteria:** counts match source · one real claim completed end-to-end in HRMS · EMS switched off with sponsor sign-off.

## Stage T5 — Trip, booking & wallet (greenfield)   `[ ☐ ]`
**Goal:** the travel surface M13 wants — built fresh, because there is nothing in production to port.
**Depends on:** T4 (do not delay the EMS cutover for this).
**Tasks:**
- [ ] TE-01/02/04 — Trip with itineraries, international/visa sub-flow, status machine incl. cancellation with reason and cost.
- [ ] TE-03 — Booking connector behind a swappable interface (the live `mmt` module is unused, so there is no proven integration to inherit — treat the vendor as an open choice); "own arrangement" with reason + budget.
- [ ] TE-08 — Wallet as an immutable ledger with a unique `transactionReference` for idempotency, if and only if a trip advance flow needs it beyond T2's advance handling. **Challenge this before building it:** production has never used a wallet, so confirm the requirement rather than inheriting it from doc 11.
**Exit criteria:** a trip request routes and books on staging · any wallet built reconciles to the rupee.

---

## Gate G3.5 — Phase 3.5 sign-off
- [ ] A budget → claim → RM → HOD → final → settlement cycle runs in HRMS, reserving and releasing correctly
- [ ] Every live escalation rule reproduced, each with a test naming it
- [ ] Recoverable/reimbursable amounts flow through payroll correctly (verified in a live run)
- [ ] EMS data migrated with clean reconciliation; migrated users log in with existing passwords; system decommissioned
- [ ] Final approval is held by a role with **more than one** holder — the single-admin risk is not inherited
- [ ] No foreign UI anywhere in the claims surfaces (design review)
