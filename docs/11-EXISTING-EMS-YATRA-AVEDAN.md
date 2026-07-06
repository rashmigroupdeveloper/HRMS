# 11 — Existing In-House System: "Yatra Avedan" T&E / Claims EMS

**Method:** read-only SSH to RML's EMS server (`rashmimetaliks.com`, cPanel/AlmaLinux), 5 Jul 2026. Explored code only; nothing modified. **Credentials were shared in chat — rotate the SSH and MinIO passwords.**

**Headline:** RML's team has **already built and deployed** a substantial Travel & Expense / Claims system ("Yatra Avedan" = "travel application"). It is live (`pm2` process `ems-backend`, 28h uptime). It **overlaps and exceeds** the HRMS M11 (advances) and M12 (claims/reimbursement) specs, and it is on a **different stack** than both the ATS and this HRMS plan. This forces an architecture decision (see §5).

---

## 1. What it is

A corporate Travel & Expense Management platform: employees raise trips (domestic/international), the system integrates with **MakeMyTrip Corporate** for booking, enforces **budget/allowance policy** (incl. international travel policy + multi-currency), routes **approvals** (RM → Travel Admin/Chandan Modi → CEO) with escalation and send-back, then handles **expense claims**, **advances**, a **wallet**, and **settlement** (auto/manual, net payable). Branded "Yatra Avedan API — Enterprise Architecture."

This is literally the **"Travel Advance" module** from pain point PP-1 (the "Chandan Modi Ji" solution) — `CHANDAN_MODI` is a named approver role in the code. That pain point is already being solved here.

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

## 6. Housekeeping / security
- Rotate: the SSH password (`emsrashmimetalik`) and the MinIO console password now that they're in chat.
- The unified employee master is the crux: Yatra Avedan `User`, the ATS users, greytHR, and the HRMS must not become four disagreeing copies. Whichever option, **one system owns the employee master** (recommend: the HRMS) and the others sync from it.
- `.env` on the server holds live secrets (JWT, Twilio, MMT, MinIO keys, Mongo URI) — not copied here; treat that box as production.
