# 11 — Existing In-House System: "Yatra Avedan" T&E / Claims EMS

**Method:** read-only SSH to RML's EMS server (`rashmimetaliks.com`, cPanel/AlmaLinux), 5 Jul 2026. Explored code only; nothing modified. **Credentials were shared in chat — rotate the SSH and MinIO passwords.**

**Headline:** RML's team has **already built and deployed** a substantial Travel & Expense / Claims system ("Yatra Avedan" = "travel application"). It is live (`pm2` process `ems-backend`, 28h uptime). It **overlaps and exceeds** the HRMS M11 (advances) and M12 (claims/reimbursement) specs, and it is on a **different stack** than both the ATS and this HRMS plan. This forces an architecture decision (see §5).

---

## 1. What it is

A corporate Travel & Expense Management platform: employees raise trips (domestic/international), the system integrates with **MakeMyTrip Corporate** for booking, enforces **budget/allowance policy** (incl. international travel policy + multi-currency), routes **approvals** (RM → Travel Admin/Chandan Modi → CEO) with escalation and send-back, then handles **expense claims**, **advances**, a **wallet**, and **settlement** (auto/manual, net payable). Branded "Yatra Avedan API — Enterprise Architecture."

This is literally the **"Travel Advance" module** from pain point PP-1 (the "Chandan Modi Ji" solution) — `CHANDAN_MODI` is a named approver role in the code. That pain point is already being solved here.

---

## 0. UPDATE — 2026-07-06 live database read (as-built has moved on)

A second read-only pass (SSH + `mongosh` against the live Atlas cluster `yatra-avedan.fbkxpf1.mongodb.net`) shows the app was **rebuilt** since the 5 Jul pass. The live `pm2` process `ems-backend` now runs from `~/backend/backend` — a **cleaner TypeScript/Mongoose 9.5/Express 5 rewrite** (not the old `yatra-avedan-mdb` tree, which is now retired to `.trash`). Deps confirm the stack: `mongoose`, `zod 4`, `@aws-sdk/client-s3` (MinIO), `twilio`, `resend`, `nodemailer`, `xlsx`, `fuse.js`, `helmet`, `express-rate-limit`. Storage is MinIO (`STORAGE_PROVIDER=minio`, bucket `ems-uploads`).

**Modules (live):** `auth · users · trips · approvals · claims · advances · budgets · wallet · currency · mmt · locations · analytics · dashboard · finance · email` — note **`finance`** is new vs the 5 Jul list.

### 0.1 The headline finding — a live, high-quality employee master (1066 people)

The `users` collection holds **1,066 employees** and is the single most valuable asset for the HRMS. **`userid` is the greytHR employee code** (`RML035384`, `RDL002412`, `EIPL0346`) — the *same* format as the greytHR ESS login `RML033903`. **This means the EMS master joins directly to greytHR/payroll on `userid` with no fuzzy matching.** It resolves the previously-open "authoritative source / match key for initial employee load" question.

Fill rates (of 1066):

| Field | Filled | Note |
|---|---|---|
| `userid` (= greytHR code) | 1066/1066 | primary join key to greytHR/payroll |
| `designation` | 1066/1066 | 176 distinct values — needs normalization on import |
| `gender` | 1066/1066 | |
| `department` | ~1066 | 112 distinct — needs normalization (e.g. Production vs Production-Hotmill) |
| `reporting_manager_id` | 1064/1066 | hierarchy near-complete; apex node is `RML0001` (CEO Cell) |
| `hod_id` | 1064/1066 | HOD reference near-complete |
| `phone` | 996/1066 | |
| `encrypted_password` (bcrypt) | 1066/1066 | everyone can already authenticate |
| `phone_verified` | 5/1066 | Twilio OTP barely adopted |
| `level` (A/B/C in schema) | **0/1066** | grade dimension is **empty** — sourced from greytHR/payroll, not here |

Extra fields present beyond the TS interface: `domestic_level`, `international_level` (travel-class grades, *not* HR pay grades), `hod_name`, `reporting_manager` (manager name). **What the EMS master does NOT have** (must come from greytHR/payroll on import): date of birth, date of joining, pay grade/CTC, statutory IDs (PAN/Aadhaar/UAN/ESIC), bank details, PF/ESI numbers.

**Decision (fold into Phase 0 / doc 07 G0):** seed the HRMS employee master from the **EMS `users` collection** (cleanest hierarchy + identity we have), keyed on `userid`, then **enrich each row from the greytHR export** (DOB, DOJ, grade, statutory IDs, bank) matched on the same `userid`. Import validators (CORE-12) must (a) dedupe the entity master, (b) normalize the 176 designations / 112 departments, (c) fix the `userid` typos found (e.g. `EIPL0346` vs `EIPLL366` double-L).

### 0.2 Entity master is **14 legal entities**, not 6 — with data-quality flags

The `company` field spans 14 distinct strings. This supersedes the 6-entity list in doc 00 D3 / doc 09:

| Company (as stored) | Headcount | Flag |
|---|---|---|
| Rashmi Metaliks Limited | 667 | India — RML |
| Rashmi Green Hydrogen Steel Ltd | 174 | India — RGH |
| Reach Dredging Limited | 96 | India — RDL |
| Rashmi 6 Paradigm Limited | 57 | India — RPL (the "6" is an OCR/typo — verify canonical name) |
| eHoome iOT Pvt. Limited | 19 | India |
| Koove iOT Pvt. Limited | 16 | India |
| Koove Organic Chemical Pvt. Limited | 14 | India |
| Rashmi Metalix Ltd | 6 | **DUP of RML — misspelling; merge on import** |
| Rashmi Pipes And Fittings FZCO Dubai | 5 | **Non-India (Dubai) — out of India-payroll scope (RPF)** |
| Reach Mining Tz Limited | 3 | **Non-India (Tanzania)** |
| Rashmi Rare Earth Limited | 3 | India |
| Rashmi Metaliks UK Limited | 3 | **Non-India (UK)** |
| Rashmi Metaliks Bahrain W.L.L | 2 | **Non-India (Bahrain)** |
| Rashmi Group | 1 | holding/parent placeholder |

Implication: the HRMS **company master must dedupe and canonicalize** (one RML, not RML + "Metalix"), and the India-payroll engine runs only for the India entities — the 5 non-India entities (Dubai, Tanzania, UK, Bahrain) are in the master but **out of the India statutory-payroll scope** (extends D3's existing RPF-Dubai carve-out to four more foreign entities). Confirm with HR which of the small India entities (eHoome/Koove) actually run payroll through this HRMS vs. are group companies out of scope.

### 0.3 Role model = derived, not stored (validates the HRMS approach)

The live `USER_ROLES` enum is only `{ admin, employee }`. The former named approver roles are gone: `LEGACY_ADMIN_ALIASES = ['super_admin','travel_admin','ceo','chandan_modi']` all `normalizeRole()` → `admin`. **RM and HOD are not stored roles — they are *derived* from being referenced as someone's `reporting_manager_id` / `hod_id`.** This is exactly the model doc 08 assumes (manager scope computed from the reporting tree, not a static role flag), and it confirms the HRMS should compute approver authority from the hierarchy while layering its richer 10-role permission model on top for the non-T&E modules.

### 0.4 Settlement schema is richer than §4 first captured (adopt verbatim into M13)

- **Claim** carries a per-category budget reservation `budgetReserved { total, travel, hotel, daily_allowance, visa, local_travel, misc }` plus `budget_reserved_id` (survives a draft budget switch, enabling accurate refund on resubmit/delete), `settlementStatus (unsettled|settled)`, `settlementMode (AUTO|MANUAL)`, `settlementAmount`, `netPayable`, `settledBy`, `settledAt`, and a **per-currency** `fxRateToINR` map. A partial unique index (`unique_active_claim_per_budget`) enforces one active claim per budget.
- **WalletTransaction** is a proper ledger: `source (ADVANCE|CLAIM_SETTLEMENT)`, `type (credit|debit)`, `amount` + `originalAmount/originalCurrency/fxRateToINR`, `settlementMode`, `balanceAfterTransaction`, and a **unique `transactionReference` for idempotency**. **Wallet** holds `empId → walletBalance (min 0)`.
- These are directly portable to the Postgres M13 tables in doc 03 — the idempotency key and per-category reservation are the two details a naive rebuild would miss; keep them.

**Live data volumes (2026-07-06):** users 1066 · budgets 10 · claims 2 · advances 1 · currencyrates 5 · refreshtokens 4 · wallets/trips/wallettransactions 0 · MMT reference (airports/hotelcities/carcities/trainstations) 0. So the app is **in early real use** — the employee master is fully loaded but T&E transaction volume is still tiny, which means **now is the ideal, low-risk window to supersede it** (little transactional history to migrate).

## 2. Stack (differs from ATS and from this HRMS plan)

| Layer | Yatra Avedan EMS | The ATS | This HRMS plan (docs 02) |
|---|---|---|---|
| Language | **TypeScript** | JS (React) | (unspecified) |
| Backend | Express 5 | Express | Express |
| **Database** | **MongoDB (Mongoose 9)** | **PostgreSQL** | **PostgreSQL** |
| Object storage | **MinIO (S3 API)**, bucket `ems-uploads` | local disk | local disk (planned) |
| Frontend | **MUI (Material UI) + MUI X date pickers** | **Tailwind (Warm Editorial)** | Tailwind (Warm Editorial) |
| Auth | JWT access 9h + refresh 10d, bcrypt, cookie | JWT | JWT |
| Validation | **zod** | — | zod (planned) |
| Email/SMS | nodemailer + **Resend** + **Twilio** (OTP) | nodemailer | nodemailer |
| Process | PM2 (`ems-backend`) | PM2 | PM2 |
| Notes | migrated Postgres→Mongo (legacy `yatra_avedan` PG config still present) | — | — |

So there are now **three stacks in play**: ATS (React/Tailwind/**PG**), Yatra Avedan (TS/MUI/**Mongo**), and my HRMS proposal (Tailwind/**PG**). The team's *newest* build is MongoDB + MUI.

## 3. Architecture (genuinely good — worth adopting the pattern)

Clean modular monolith, `controller / service / routes / repository` per module (same discipline as the ATS). Modules:
`auth · users · trips · approvals · claims · advances · budgets · wallet · currency · mmt · locations · analytics · dashboard · email`.

Core models (Mongoose): `User · Trip · Claim · Advance · Budget · Wallet · WalletTransaction · CurrencyRates · Lookup · RefreshToken`. Core utils: `budgetAllowances · claimSettlement · escalationHelper · internationalTravelPolicy`. There is a `claim.service.test.ts` (some test coverage).

**Approval model (reusable idea):** each Trip/Claim embeds an `approvals[]` array — `{approver_id, approver_role, action: accept|reject|send_back, comments, timestamp}` — with a status machine `DRAFT → RM_PENDING → TA_AND_CM_PENDING → CEO_PENDING → APPROVED|REJECTED|EDIT` and `escalationHelper.getNextApprovalRouting()`. Note the **`send_back`** action (return-for-edit) — richer than my WF spec, which had only approve/reject. **Adopt send_back into the HRMS workflow engine (WF-01).**

**User/org model already exists:** `userid, email, designation, department, company, level (A/B/C grade), reporting_manager(+id), hod_name(+id), role`. So a reporting + HOD two-level structure is already modeled — mirrors my `reporting_manager` + `functional_manager`. Roles: `admin` (super/travel/ceo/chandan_modi collapse to admin), `reporting_manager`, `hod`, `employee`.

## 4. What this already covers vs the HRMS plan

| HRMS spec | Status in Yatra Avedan |
|---|---|
| **M12 Claims & Reimbursements** (CLM-01..07) | **Built and exceeds it** — multi-currency, expense types (travel/daily-allowance/hotel/visa/misc/local), receipt attachments in MinIO, settlement (auto/manual, net payable), budget linkage |
| **LN-04 Travel advance** (PP-1) | **Built** — advances module + wallet + Chandan Modi approval |
| **WF workflow engine** (M6) | Partial, T&E-specific — approvals[] + escalation + send_back; not generic yet |
| Travel booking (not in HRMS scope) | Built — MakeMyTrip corporate integration |
| Budgets/allowances, international travel policy | Built — not in HRMS scope, bonus capability |
| Wallet/settlement ledger | Built — a real pattern for advance recovery (LN-03) |

**Conclusion:** the HRMS must **not rebuild** claims/advances/travel. It should **integrate with or absorb** Yatra Avedan.

## 4b. RESOLVED DIRECTION (sponsor, 5 Jul 2026)

**Yatra Avedan is transitional, not permanent. The HRMS is the permanent system and will become an "even better version" that absorbs Yatra Avedan's capabilities, then Yatra Avedan is retired.** The EMS approach is management-approved; use it as proven prior art and *expand the plan's scale* to make travel & expense a first-class HRMS capability done better.

Consequences for the plan:
1. **New module: M13 Travel & Expense Management** (PRD) — a superset of Yatra Avedan (trips + budgets/allowances + advances + wallet/settlement + multi-currency + international travel policy + booking integration), built into the HRMS and improved.
2. **Not "integrate with" — "absorb and supersede."** The HRMS reimplements/ports these capabilities; Yatra Avedan data migrates in; the live app is decommissioned once parity + payroll integration are proven.
3. **Adopt its proven assets — BACKEND AND LOGIC ONLY:** the module architecture (controller/service/routes/repository), the `approvals[]` + `send_back` + escalationHelper pattern, the **Wallet + WalletTransaction settlement ledger** (advance → wallet credit → claim settlement → net payable/recoverable), MinIO storage, MMT corporate-booking integration, multi-currency/exchange-rate handling.
   **DESIGN-LANGUAGE FIREWALL:** Yatra Avedan's frontend is **Material UI**. Do **not** port any MUI component. Every T&E screen is **rebuilt from scratch in the Warm Editorial system** (`packages/ui` on the ATS tokens) — see 05-UIUX §0.1. We take the data model and the business logic; we throw away the look. A ported MUI screen is a defect.
4. **Stack:** HRMS stays **PostgreSQL** for payroll/attendance/leave integrity (still the right call — the T&E ledgers and settlements especially benefit from transactions). Port Yatra Avedan's TypeScript + module pattern onto Postgres. Yatra Avedan's MongoDB becomes a **migration source**, not a permanent store. (This closes the A/B/C question below in favour of **B, evolving toward one platform** — the HRMS.)
5. **Employee master:** the HRMS owns it; Yatra Avedan, ATS, greytHR all sync from / migrate into it.

## 5. (Superseded by §4b) The decision this forced — kept for context

D4 said "one platform, same stack as ATS (Postgres/Tailwind)." That assumed the ATS was the only prior art. It isn't. Three coherent paths:

**Option A — Standardize on the newest build (MongoDB + this module pattern).**
Build the HRMS on TypeScript/Express/**MongoDB**/MinIO using Yatra Avedan's architecture; absorb Yatra Avedan as the T&E module; integrate the ATS (Postgres) over API. Pros: aligns with the team's current momentum and skills; claims/T&E already done; MinIO for documents already running. Cons: **MongoDB is a hard fit for payroll** — statutory calculations, ledgers, and to-the-rupee auditing want transactions and relational integrity; the ATS stays on a different DB.

**Option B — Keep HRMS on PostgreSQL (my original), integrate Yatra Avedan over API.**
Payroll/attendance/leave on Postgres (transactional integrity where it matters most); ATS aligns; Yatra Avedan stays on Mongo and the HRMS calls it for claims/advances (or we port it later). Pros: right DB for payroll; ATS consistency; least disruption to the running T&E system. Cons: two databases in the group (Postgres for HRMS/ATS, Mongo for T&E); some duplicated employee master (sync needed).

**Option C — Consolidate everything onto one stack (bigger migration).**
Pick one DB and one UI kit and converge ATS + Yatra Avedan + HRMS. Cleanest end-state, biggest short-term cost; likely not worth it now.

**My recommendation: Option B, with three adjustments to the HRMS docs:**
1. **Adopt Yatra Avedan's module architecture and approval pattern** (controller/service/routes/repository, `approvals[]` with **send_back**, escalationHelper) as the HRMS backend convention — the team already knows it.
2. **Do not build M11/M12 from scratch** — treat Yatra Avedan as the T&E/claims service; the HRMS references it (single sign-on + employee master sync) and consumes claim/advance data for payroll recovery (LN-03) and F&F.
3. **Reuse the running MinIO** (`ems-uploads`) as the HRMS document store instead of local disk (updates 02-ARCH §1) — it's already deployed and backed by the pattern in `storage.service.ts`.
Keep payroll/attendance/leave on PostgreSQL for transactional/audit integrity (the one place Mongo would hurt).

**Decision needed from you:** A, B, or C? Until you pick, docs 02–03 keep PostgreSQL as the assumption (Option B) but this file is the flag that the choice is now explicit, not implicit.

## 6. Live MongoDB snapshot — `ems_db` (read-only recon, 6 Jul 2026)

Second recon pass: queried production MongoDB (not code). Confirms the EMS is not a prototype — it holds a **group-wide employee directory** that is immediately useful for HRMS Phase 0 migration.

### 6.1 Collection counts

| Collection | Count | HRMS relevance |
|---|---|---|
| **users** | **1,066** | Employee master seed (TE-12 migration + Phase 0 org load) |
| budgets | 9 | Trip budget requests (M13 `te.budgets`) |
| claims | 2 | Live claim workflow (1 APPROVED, 1 DRAFT) |
| advances | 1 | Travel advance (LN-04 / TE-07) |
| currencyrates | 5 | Multi-currency (TE-05) |
| refreshtokens | 4 | Active sessions |
| trips / wallets / wallettransactions | 0 | Built but unused so far |

### 6.2 User record shape (maps to `core.employees`)

Fields present on every user document:

`userid` · `username` · `email` · `phone` · `gender` · `company` · `department` · `designation` · `role` · `domestic_level` · `international_level` · `reporting_manager` · `reporting_manager_id` · `hod_name` · `hod_id` · `encrypted_password` (bcrypt) · `created_at` · `updated_at`

**Coverage:** 1,064 / 1,066 users have both `hod_id` and `reporting_manager_id` populated — mirrors HRMS `reporting_manager` + `functional_manager` (CORE-03).

**Roles:** 1,065 `employee` + 1 `admin` (single admin — redundancy risk).

**Gender:** Male 1,031 · Female 35 (useful for CEO dashboard demographics once HRMS owns master).

### 6.3 Company ↔ e-code prefix (migration key)

| Prefix | Count | EMS company name |
|---|---|---|
| RML | 757 | Rashmi Metaliks Limited |
| RGH | 121 | Rashmi Green Hydrogen Steel Ltd |
| RDL | 96 | Reach Dredging Limited |
| RPL | 30 | Rashmi 6 Paradigm Limited |
| EIP | 16 | eHoome iOT Pvt. Limited |
| KIO | 14 | Koove iOT Pvt. Limited |
| KOL | 14 | Koove Organic Chemical Pvt. Limited |
| RRE | 6 | Rashmi Rare Earth Limited |
| RPF | 5 | Rashmi Pipes And Fittings FZCO Dubai |
| RMT / RMB / RBS / RAS | ≤3 each | UK / Bahrain / Tanzania / Group |

This aligns with HRMS `core.companies` e-code series (CORE-02) and greytHR entity prefixes — **use `userid` as the join key** when reconciling greytHR export ↔ EMS ↔ ATS.

### 6.4 Travel entitlement tiers (policy engine seed)

Domestic levels (count): **Dom-F 754** · Dom-E 193 · Dom-D 84 · Dom-C 22 · Dom-A 10 · Dom-B 3

These map directly to M13 budget/allowance rules (`budgetAllowances`, `internationalTravelPolicy` in EMS code). Port as `te.travel_levels` lookup table when absorbing M13.

### 6.5 Org richness

- **~90+ distinct departments** (top: Sales & Marketing 80, Finance & Accounts 69, Project 63, Production 52, Production-Hotmill 50, QA & QC 43, Mechanical Maintenance 40, Human Resource 16)
- **~100+ distinct designations** (top: Engineer 121, Junior Diploma Engineer 87, Executive 78, Assistant Manager 64, Manager 61, Deputy Manager 28, DGM 19)
- Heavy industrial/steel-plant org structure — matches RML's real operating model, not a generic IT company template

### 6.6 Claim & budget schemas (concrete M13 port targets)

**Claim line item fields (live):** `slNo`, `receiptNo`, `billDate`, `currencyCode`, `currencyName`, `receiptAmount`, `expenseType` (e.g. `travel`), `travelFrom`/`travelTo`, `travelFromDate`/`travelToDate`, `purpose`, `remarks` — plus receipt attachments in MinIO `ems-uploads/claims/`.

**Budget document fields (live):** 40+ fields including `travelType`, `region`, `travelModes`, `hotelBudgetPerNight`, `dailyAllowance`, `visaCost`, `advanceRequired`, `totalEstimatedCost`, `claimedAmount`, `approvals[]`, `approvedBudget`, `status` — this is the full TE-02/TE-03 schema to port to Postgres.

### 6.7 What this means for HRMS build

| HRMS need | EMS provides |
|---|---|
| Phase 0 employee master load | 1,066 rows with ecode, company, dept, designation, RM, HOD, email, phone |
| CORE-03 dual manager | `reporting_manager_id` + `hod_id` already populated |
| CORE-05 employment category inference | Designation + department patterns distinguish white/blue collar |
| M13 TE-12 data migration | Source of truth for users/budgets/claims/advances when Yatra Avedan retires |
| LN-03 / CLM-07 payroll recovery | `settlementStatus`, `settlementAmount` on claims → payroll deduction posting |
| PP-1 Travel Advance | Already live — do not rebuild; absorb pattern |
| MinIO document store | `ems-uploads` bucket with real claim attachments — reuse pattern (02-ARCH §1) |
| WF-01 `send_back` | Approval arrays on budgets/claims (when populated) |

**Caveat:** EMS `userid` may not match greytHR `ecode` 1:1 for every row — run a reconciliation import with per-row validation report (CORE-12) before treating EMS as authoritative over greytHR for payroll/statutory fields (PAN, UAN, bank, DOJ). EMS has **no statutory IDs** — greytHR/Adrenalin export still required for PAY-06 fields.

---

## 7. Housekeeping / security
- Rotate: the SSH password (`emsrashmimetalik`) and the MinIO console password now that they're in chat.
- The unified employee master is the crux: Yatra Avedan `User`, the ATS users, greytHR, and the HRMS must not become four disagreeing copies. Whichever option, **one system owns the employee master** (recommend: the HRMS) and the others sync from it.
- `.env` on the server holds live secrets (JWT, Twilio, MMT, MinIO keys, Mongo URI) — not copied here; treat that box as production.
- **`NODE_ENV` not set on `ems-backend` PM2** — same cookie-Secure-flag risk as VBMS; fix before HRMS SSO integration testing.
