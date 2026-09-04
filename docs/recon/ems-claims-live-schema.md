# Recon — EMS live claims backend (read-only, 3 Sep 2026)

**Method:** read-only SSH as the non-root `emsrashmimetalik` account; source files read, nothing
modified, no database writes. Source of truth: `/home/emsrashmimetalik/backend/backend/src/`.

**Why this exists:** `docs/11` was written from an earlier snapshot and over-weights travel; the local
`~/Documents/YatraAvedan` copy is missing the money models entirely. This file records what the live
system *actually* runs, so Phase 3.5 ports behaviour rather than a description.

**No credentials are recorded here.** Those shared in chat must be rotated (CLAUDE.md §5).

---

## 1. The finding that reshapes the plan: **the Budget IS the travel request**

`trips` has 0 records not because travel is unused, but because the **Budget model absorbed the
travel-request role**. `IBudget` carries the entire itinerary:

`travelType` (Domestic/International) · `region` · `city` · `travelMonth` · `fromLocation` ·
`toLocation` · `purposeOfTravel` · `travelStart` / `travelEnd` · `noOfNights` ·
`travelDeskBooking{airTicket, hotels, visa}` · `travelModes[]` · `lowestLogicalAirfare` ·
`flyingHour` · `costPerFlyingHour` · `hotelBudgetPerNight` · `totalHotelBudget` ·
`localConveyanceType` · `localTransport` · `dailyAllowance` · `trainBudget` · `busBudget` ·
`selfVehicleBudget` · `localTravelKm` · `ownArrangementBudget` + `ownArrangementReason` ·
`visaCost` + `visaStatus` · `miscellaneousExpense` + `miscellaneousReason` ·
`advanceRequired` + `advanceReason` · `limitExceedReason`

So docs/01 **TE-01 (trip) and TE-05 (budget) are one object in reality**, not two. Building a separate
Trip alongside a Budget would give users two places to describe the same journey.

## 2. Money position is held as COUNTERS, not a ledger

`Budget` carries running totals: `claimedAmount`, `claimedAirfare`, `claimedHotel`,
`claimedDailyAllowances`, `claimedMiscellaneous`, `claimedVisa`, `claimedLocalTravel`
(plus deprecated `claimedDailyAllowance`, `claimedFood` kept for old documents).

`Claim` carries its own snapshot of what it charged — `budgetReserved{total, travel, hotel,
daily_allowance, visa, local_travel, misc}` — plus `budget_reserved_id`, the budget the reservation
actually sits against, which **may differ from `budget_id`** after a draft budget switch. That
snapshot exists so a resubmit or delete refunds the exact amounts previously charged.

Also: `totalEstimatedCost` (requested) is distinct from `approvedBudget` (what the approver granted).

> **HRMS deliberately diverges here.** CLAUDE.md rule 3 is "ledgers, not counters" — a maintained
> running total is one the application can get wrong, invisibly, until finance finds it. We keep an
> append-only reservation ledger and derive the position. The **category breakdown and the
> `budget_reserved_id` behaviour must survive the change**, because both exist for a real reason.
> Migration reconstructs ledger rows from the live counters.

## 3. Approval routing — `escalationHelper.resolveNextSupervisor()`

Walks the submitter's own record: `reporting_manager_id → hod_id → Admin`. Rules, in order:

1. **RM step** — taken only if `reporting_manager_id` resolves to a user who is **not** the submitter
   (by `_id` and by `userid`) **and is not the submitter's own HOD**. That last guard is not in the
   sponsor brief: *if your RM is also your HOD, the RM step is skipped* so the same person does not
   approve twice.
2. **HOD step** — resolves `hod_id`; skipped if it resolves to the submitter.
   ⚠️ **Fallback worth flagging:** if `hod_id` is unset or unresolvable it selects
   `User.findOne({ role: 'hod' })` — *any* user holding the HOD role. That can route a claim to an
   arbitrary department head. **Do not port this fallback**; route to the HR/compliance queue instead.
3. **Admin step** — `User.findOne({ role: ADMIN })`, the single admin account.

**Two status vocabularies exist for the same walk**, selected by a `style` argument:

| style | RM | HOD | final |
|---|---|---|---|
| `budget` | `Pending RM` | `Pending HOD` | `Pending Admin` |
| `standard` / `claim` | `RM_PENDING` | `HOD_PENDING` | `ADMIN_PENDING` |
| `trip` | — | — | `TRAVEL_ADMIN_PENDING` |

A wart to normalise on port, not to reproduce.

**Claim status set:** `DRAFT · RM_PENDING · HOD_PENDING · ADMIN_PENDING · APPROVED · REJECTED · EDIT`
(`EDIT` is the send-back state.) Approval actions: `accept · reject · send_back · edit`.

## 4. Settlement — `claimSettlement.calculateClaimSettlement()`

```
AUTO   → settlementAmount = min(walletBalance, claimAmount)
MANUAL → settlementAmount = manualAmount
         throws if manualAmount > claimAmount
         throws if manualAmount > walletBalance
netPayable = claimAmount − settlementAmount
```
Both inputs clamped at 0 first. Simple, and worth porting exactly — including the two refusals.

## 5. Constraints and idempotency actually enforced

| Where | Rule |
|---|---|
| `Claim` | `unique_active_claim_per_budget` — unique on `budget_id`, partial filter `status NOT IN ['REJECTED','Rejected']`. **Only rejection frees a budget** — a settled claim still blocks a second one. (Note the case-variant list: legacy data carries both spellings.) |
| `WalletTransaction` | **unique `transactionReference`** — the idempotency guard. Also indexed on `empId+createdAt`, `claimId`, `advanceId`. |
| `Wallet` | `{empId, walletBalance}` — a mutable counter, same caveat as §2. |

## 6. Claim line items (`IClaimItem`)

`slNo · receiptNo · billDate · currencyCode · currencyName · receiptAmount ·
expenseType(travel|daily_allowances|hotel|miscellaneous|visa|local_travel) ·
travelMode(Air|Train|Bus) · travelFrom/To · travelFromDate/ToDate ·
hotelName · hotelLocation · checkIn · checkOut · purpose · remarks ·
attachment_path · attachment_filename`

FX is held **on the claim, not the line**: `fxRateToINR: Record<string, number>` (a per-currency map)
plus `fxRateDate`, with `total_amount`, `total_amount_inr` and `display_currency`.

## 7. Other utilities present (not yet read in detail)

`approvalChain.ts` (202 lines, with `approvalChain.SAMPLES.md` and a test), `budgetAccess.ts`,
`budgetAllowances.ts`, `budgetLock.ts`, `claimCurrency.ts`, `fxConversion.ts`,
`internationalTravelPolicy.ts`, `orgLabels.ts` — several with colocated `.test.ts`. Read these before
building the entitlement/grade-allowance path (`domestic_level` Dom-A..F, `international_level`
Int-A..C on the user record).

## 8. Consequences for the plan

1. **Merge TE-01 into TE-05.** One object: a travel request that carries its own budget. Stage T5's
   "trip" is not greenfield — it already exists, as the Budget.
2. **Keep the ledger, keep the categories.** Per-category reservation and the `budget_reserved_id`
   indirection both survive; the mutable counters do not.
3. **Match the live uniqueness rule**: only a rejected claim frees its budget.
4. **Do not port the arbitrary-HOD fallback** (§3.2) or the single-admin final step.
5. **Normalise the two status vocabularies** into one.

---

# PART 2 — The claim & budget logic, function by function (read 3 Sep 2026)

Source: `/home/emsrashmimetalik/backend/backend/src/modules/{claims,budgets,advances,wallet}/`.
Read-only. **This section is the specification.** Where our implementation differs from anything
below, our implementation is wrong unless the difference is recorded in §9 with a reason.

## 6. `createClaim(user, {claims, intent, budget_id}, files)`

The order is load-bearing — each guard assumes the previous one passed.

```
1  referenceNo = generateClaimReferenceNo()
2  budget = Budget.findById(budget_id)            → 'Budget not found'
3  budget.status !== 'Approved'                   → 'Selected budget is not approved'
4  assertBudgetOwner(budget, user)
5  assertNoActiveClaimOnBudget(budget_id)
6  rates = getRates().rates                        (ONE fx snapshot for the whole claim)
7  claimItems = raw.map(mapRawClaimItem(item, rates, file))   file field = `attachment_${slNo}`
8  amountFields = buildClaimAmountFields(claimItems, rates)   → total_amount, total_amount_inr,
                                                               fxRateToINR{}, display_currency
9  status = 'DRAFT'
10 if intent === 'submit':
      routing = buildSubmissionApprovalChain(user)
      status  = routing.status          (empty chain ⇒ 'APPROVED' — admin self-submission)
      approvals = routing.approvals
11 requested = sumItemCategoriesInINR(claimItems, rates)
12 freshBudget = repairZeroedTravelCapOnBudget(Budget.findById(budget_id))
13 if intent === 'submit':
      assertBudgetLimits(convertBudgetCapsToINR(freshBudget, rates), requested)   ← PER CATEGORY
14 if intent === 'submit':
      submitted_at        = now
      budgetReserved      = requested          (the per-category object, not a total)
      budget_reserved_id  = budget_id
15 if intent === 'submit':  TRANSACTION { Claim.create(...) ; applyBudgetClaimDelta(budgetId, requested) }
      then notify ONLY approvals[0]
   else: Claim.create(...)          (a DRAFT reserves NOTHING)
```

**`intent` is part of the contract.** A claim is saved as a draft or submitted; a draft holds no
reservation. Our API creates then submits as two calls, which is not the same thing — a draft must be
storable without touching the budget.

**Only the first approver is notified**, not the whole chain.

## 7. `assertBudgetLimits` — the check is PER CATEGORY, never on a total

From `claimBudgetLogic.ts`, with `netClaimedForLimitCheck(claimed, credit) = max(0, claimed − credit)`
where `credit` is what THIS claim already holds (so a resubmit nets out its own prior reservation):

| Category | Running total | Cap |
|---|---|---|
| travel | `claimedAirfare` | `lowestLogicalAirfare` |
| hotel | `claimedHotel` | `totalHotelBudget` |
| daily allowance | `resolveBudgetClaimedDailyAllowances(budget)` | `resolveBudgetDailyAllowances(budget)` |
| miscellaneous | `claimedMiscellaneous` | `miscellaneousExpense` |
| visa · local travel | same shape | `visaCost` · `localTravelBudget` |

Each breach **throws** `ClaimValidationError('Claim amount exceeds available <category> budget')`.
There is **no over-budget-with-escalation path anywhere in the live system.**

## 8. Statuses and guards — the exact vocabulary

**Claim:** `DRAFT · RM_PENDING · HOD_PENDING · ADMIN_PENDING · APPROVED · REJECTED · EDIT`
**Budget:** `Draft · Pending RM · Pending HOD · Pending Admin · Approved · Rejected`
**Send-back is role-stamped** — `getClaimSendBackStatus(editorRole)`:
`Sent Back by RM` · `Sent Back by HOD` · `Sent Back by Admin` (default: Admin).
`isClaimSentBackStatus(s)` = `s === 'EDIT' || s.startsWith('Sent Back')`.

`assertClaimApprovable(claim)` — four refusals, verbatim:

| Condition | Message |
|---|---|
| `status === 'DRAFT'` | `Draft claims cannot be approved` |
| status in REJECTED set | `Claim is already rejected` |
| `APPROVED` or `settlementStatus === 'settled'` | `Claim is already finalized` |
| sent-back | `Sent-back claims must be edited and resubmitted by the requester` |

`assertNoActiveClaimOnBudget` message names the offender:
`This budget already has an active claim (<reference_no>). Only one claim per budget is allowed.`

`REJECTED_CLAIM_STATUSES = ['REJECTED', 'Rejected']` — both spellings exist in live data.

## 9. Expense-type aliases (legacy data carries every spelling)

```
daily_allowances | food | daily_allowance          → 'daily_allowances'
local_travel | 'local transport' | local_transport → 'local_travel'
travel · hotel · miscellaneous · visa              → unchanged
```
`normalizeExpenseType()` runs on every item. An importer that skips it will mis-bucket real claims.

## 10. Reservation release

`clearClaimBudgetReservation(claim)` unsets **both** `budgetReserved` and `budget_reserved_id`, and
`applyBudgetClaimDelta` reverses the per-category counters. Release is always the *stored snapshot*,
never a recomputation — which is why the snapshot exists.

## 11. Settlement (`getSettlementPreview` / `adminSettleClaim`)

Preview before settle is a first-class endpoint; the arithmetic is §4 above.

---

# 12. Divergence register — what OURS does differently, and why

Anything here is a deliberate decision that must survive review, or a defect to remove.

| # | Live | Ours | Verdict |
|---|---|---|---|
| D1 | Mutable `claimed*` counters on Budget | Append-only `pay.claim_reservations` ledger | **Keep** — CLAUDE.md rule 3. Position derived, never maintained. Migration reconstructs rows from the counters |
| D2 | Per-category caps, each throwing | **Total-only check** | **DEFECT — must fix.** Someone can blow the hotel line while under the total |
| D3 | Over-budget always throws | `overspendAllowed` flag + escalation | **REMOVE.** Invented; not in the source. TE-06 can be revisited separately as an explicit change request |
| D4 | `intent: 'save' \| 'submit'`; a draft reserves nothing | create-then-submit, two calls | **DEFECT — must fix.** Drafts must be storable without touching the budget |
| D5 | Statuses `DRAFT/RM_PENDING/.../EDIT`, send-back role-stamped | Own vocabulary; send-back not role-stamped | **Align.** Keep ONE vocabulary internally, but the role stamp is real information and must be preserved |
| D6 | No entitlement funding concept | `funding_kind: 'budget' \| 'entitlement'` | **REMOVE.** Invented ahead of a requirement; docs/03's entitlement model is a separate future decision |
| D7 | `normalizeExpenseType` aliases | none | **DEFECT — must fix.** Import will mis-bucket |
| D8 | Notify `approvals[0]` only | not wired | **Fix with the workflow wiring** |
| D9 | Single admin terminates every chain | `role:hr_head` queue | **Keep** — documented as GAP-D01; removes a single point of failure without changing the rule |
| D10 | Refusals as thrown strings | typed refusal objects incl. `not_integer` | **Keep the type; drop the invented codes.** Messages must match the live wording |

**Rule going forward: nothing enters the claim/budget path that is not in this document.** New
behaviour is a change request against the spec, not a design decision taken mid-implementation.
