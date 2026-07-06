# Phase 3.5 — Travel & Expense (M13): absorb & supersede Yatra Avedan

**Target:** 4–6 weeks · **Gate:** G3.5 · **Spec:** docs/13 §6, docs/01 §8b (TE-01..12), docs/11
**Purpose:** the permanent, better version of the team's live T&E system — ported to Postgres, wired into payroll, rebuilt in Warm Editorial, then Yatra Avedan is retired.

> **Design firewall (docs/05 §0.1):** we port Yatra Avedan's *backend logic and data* — never its MUI screens. Every T&E screen is rebuilt from the frontend design system (`frontend/src/ui`). A ported MUI component is a defect.

---

## Stage T1 — Schema + core models port   `[ ☐ ]`
**Goal:** the T&E data model on Postgres, faithful to the proven Mongo design — with ledger discipline.
**Depends on:** Gate G3.
**Tasks:**
- [ ] TE-01/02 — Trip: name, Domestic/International, purpose, itineraries (flight/train/bus/hotel/car), visa flag + sub-flow, attachments (storage adapter), reference numbers; status machine incl. cancellation with reason/cost *(TE-04)*
- [ ] TE-05 — Budget engine: travel-mode budgets (air class + lowest-logical-fare + hours×cost, train coach, bus), hotel/night, DA, visa, own-arrangement; grade A/B/C entitlements (port `budgetAllowances`, `internationalTravelPolicy`)
- [ ] TE-08 — **Wallet + WalletTransaction immutable ledger** (credit/debit, source ADVANCE|CLAIM_SETTLEMENT, links, balance = SUM) — same discipline as `lv.ledger`
- [ ] TE-10 — Claim with line items: expense types, per-item receipt/date/amount/**currency + exchange rate**, travel segments, hotel stays, attachments
**Tests required:** ledger property tests (balance = SUM, append-only trigger); budget computation vs live Yatra Avedan examples; multi-currency capture.
**Exit criteria:** schema migrated; a sample live trip's budget reproduces Yatra Avedan's numbers exactly.

## Stage T2 — Workflows + settlement engine   `[ ☐ ]`
**Goal:** the clever part — advances, wallet settlement, and payroll recovery, on the generic WF engine.
**Depends on:** T1.
**Tasks:**
- [ ] TE-07 — Travel advance request linked to trip/budget; chain RM → HOD → Admin/Finance (+CEO stage by value); **send_back** supported; approval credits the wallet
- [ ] TE-09 — **Settlement:** claim approval reconciles claimed vs wallet advance → net payable **or** recoverable; AUTO/MANUAL mode, settledBy/At recorded; recoverable flows to **payroll deduction** (LN-03 tie-in) or wallet carry-forward
- [ ] TE-06 — Policy enforcement: over-budget flagged for higher approval, never silently blocked
- [ ] TE-11 — Claim chain (RM → Travel Admin/CM → CEO by amount) with send_back; reimbursement payout via payroll or off-cycle batch (reuses CLM-04 machinery)
**Tests required:** settlement matrix (advance > claim, < claim, = claim; carry-forward vs recovery); wallet reconciles to the rupee after every path; over-budget escalation.
**Exit criteria:** full cycle trip→advance→claim→settlement reconciles the wallet to zero (or exact carry) in every test path · a recoverable lands as a deduction in the next payroll run.

## Stage T3 — Booking connector + Warm Editorial UI   `[ ☐ ]`
**Goal:** MMT corporate booking behind an interface, and every screen rebuilt in the house design language.
**Depends on:** T1; T2 for approval surfaces.
**Tasks:**
- [ ] TE-03 — Pluggable booking connector: port the MMT Corporate integration (push requisition, receive booking id/url, capture cost); "own arrangement" with reason + budget; provider swappable behind the interface
- [ ] UI rebuild from `frontend/src/ui`: trip request wizard, budget preview, advance flow, claim form with line items + receipt uploads, settlement view, T&E admin queues — **zero MUI**, signature-moment + accessibility bars apply *(05 §0.1/§6/§7)*
**Tests required:** connector contract tests against recorded MMT responses; component states ×7; axe checks both themes.
**Exit criteria:** a booking round-trips through the connector on staging · design review confirms no foreign UI language.

## Stage T4 — Migration, parallel run, decommission   `[ ☐ ]`
**Goal:** Yatra Avedan's data in, parity proven, old system retired.
**Depends on:** T2, T3.
**Tasks:**
- [ ] TE-12 — Migrate Yatra Avedan MongoDB (users, trips, claims, advances, budgets, wallets, transactions) with per-collection validation reports; map users to HRMS employee master; mirror the old MinIO bucket into SeaweedFS
- [ ] Parallel run: new requests in HRMS, wallets reconciled against Yatra Avedan until parity window closes
- [ ] Decommission: read-only freeze on Yatra Avedan → export archive → PM2 process retired; EMS MinIO retired after mirror verification
**Tests required:** migration reconciliation counts per collection; wallet balances match to the rupee post-migration.
**Exit criteria:** every migrated wallet balance = Mongo source · one full real trip→settlement cycle completed in HRMS · Yatra Avedan switched off with sponsor sign-off.

---

## Gate G3.5 — Phase 3.5 sign-off
- [ ] A full trip → advance → booking → claim → settlement cycle runs in HRMS and reconciles to the wallet to the rupee
- [ ] Recoverable/reimbursable amounts flow through payroll correctly (verified in a live run)
- [ ] Yatra Avedan data migrated with clean reconciliation; system decommissioned
- [ ] No MUI anywhere in the T&E surfaces (design review)
