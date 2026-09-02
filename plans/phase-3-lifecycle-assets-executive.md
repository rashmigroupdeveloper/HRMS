# Phase 3 — Lifecycle · Assets · Helpdesk · Engagement · Executive

**Target:** 5–6 weeks · **Gate:** G3 · **Spec:** docs/13 §6, docs/04 §4/§6, docs/01 §7–8, docs/06 §3–4
**Purpose:** the full employee journey (join → confirm → transfer → exit with F&F), the supporting modules, and the executive layer.

---

## Stage 3.1 — Onboarding bridge + probation/confirmation   `[ ☐ ]`
**Goal:** ATS-joined candidates become employees without a single manual email; probation closes itself out.
**Depends on:** Gate G2 (salary switch needs live payroll).
**Tasks:**
- [ ] LC-01 — ATS "Joined List" → `core.onboarding_candidates` (nightly sync, full LOI payload); pre-join link on personal email with delivery tracking + resend; HR "Convert" wizard (e-code preview, salary from LOI CTC + probation %) *(SOW-3.2a)*
- [ ] LC-02 — Onboarding task fan-out to IT/Admin/HR with due dates + escalation at +2 days; `biometric_registered` telemetry
- [ ] LC-04 — Probation board: reminders at due−30/−14/−7; review form → confirmation chain (RM → HR Head); outcomes confirm (sets date, **creates confirmed-phase salary row — PAY-02 e2e** + letter), extend, separate *(PI-ESS-8/10)*
**Modules/files:** `backend/src/modules/lifecycle/{onboarding,probation}/`
**Tests required:** conversion round-trip (candidate → employee → salary row); link-delivery tracking states; confirmation triggers salary switch on test clock.
**Exit criteria:** a test candidate goes LOI → pre-join → convert → tasks fanned out, zero manual steps · a confirmation flips the salary phase and issues the letter.

## Stage 3.2 — Separation, clearances, F&F   `[ ☐ ]`
**Goal:** the resignation pipeline where **every approver provably gets notified**, ending in a correct settlement.
**Depends on:** Gate G2 (F&F runs on the payroll engine).
**Tasks:**
- [ ] LC-06 — Resignation in ESS → chain (RM → HR Head → HR ops) with `notified_at` receipts; notice-period computation; HR-initiated absconder path from absence cases; status timeline visible to employee/RM/HR *(PP-14 fix)*
- [ ] LC-06 — Department clearances fan-out (IT/Admin/Finance/HR) with asset auto-check *(AST-04)*
- [ ] PAY-15 — F&F: days payable + EL encashment + notice recovery + **gratuity** (formula per signed eligibility mode) + holds release + dues; TAT clock (per verified Labour Codes value); relieving/experience letters gated on `paid` *(golden G8 written first)*
- [ ] 10 §8 — **Labour Codes re-verification recorded** (F&F TAT days, wages ≥50% CTC) before this stage's exit
- [ ] LC-07 — Exit day cascade: status+DOL exactly once (CHECK), removed from all active lists/rosters/approvals, alumni ESS mode (payslips/Form 16 only)
**Tests required:** golden G8 (gratuity 8y7m → ₹1,67,008); notice-recovery math; exit cascade (no exited employee in any active list query — the PP-17 regression test); every-step-notified assertion.
**Exit criteria:** a full synthetic resignation runs system-only with receipts at every step · F&F statement matches hand-computed fixture · exited employee appears nowhere active.

> **Assets delivered 1 Sep 2026 — evidence:** migration `1751980000000_assets-module`; `backend/src/modules/assets/*`; `frontend/src/pages/workplace/AssetsPage.tsx` (register + not-returned tabs, allocate/return drawers). **7 integration tests** (`tests/assets.integration.test.ts`) covering past-warranty acceptance, holder XOR, double-allocation refusal, damaged-return routing, the leaver tile, three-way search and the permission gate. Backend `npm run verify`: **174 tests green**. Verified live end to end against the running API.
> **Bug found and fixed by those tests:** DATE columns arrive from pg at LOCAL midnight, so `toISOString()` reported every warranty and exit date **one day early** in IST. Now routed through the shared `formatDbDate` helper.

## Stage 3.3 — Transfers + assets   `[ ☐ ]`
**Goal:** internal movement with history, and the asset registry with the exit loop closed.
**Depends on:** 3.2 (clearances integration).
**Tasks:**
- [ ] LC-05 — Transfer workflows (department/location/cost-center/**entity** incl. new e-code per target series + payroll continuity per SOW-5.3); `employee_history` effective-dated rows
- [x] AST-01..03 — **DONE 1 Sep 2026.** `ast` schema + `modules/assets` + real UI at `/assets`. Search covers asset_no · serial · category · holder name · e-code. Warranty accepts PAST dates (AST-02 — no constraint, deliberately: greytHR blocked these and staff entered wrong dates). Holder is employee XOR third-party, enforced by a DB CHECK, and a partial unique index guarantees one open assignment per asset.
- [x] AST-04..06 — **DONE 1 Sep 2026.** `GET /assets/held-by/{employeeId}` is the exit-clearance list; `GET /assets/non-returned` is the AST-05 tile (kit held by people who have already exited, with their DOL). Returns record `ok | damaged | not_returned` — `not_returned` is a first-class outcome that keeps clearance open, and a **damaged** return routes to maintenance rather than back into stock so it is never reallocated broken. Maintenance/incident/damage/lost trail with cost; a `lost` entry immediately makes the asset unallocatable.
**Tests required:** entity transfer generates correct new e-code + continuity rows; exit clearance lists exactly the holder's open assignments; history rows drive R23.
**Exit criteria:** an entity transfer preserves payroll continuity in the next run · a resigned employee's unreturned asset blocks Admin clearance until dispositioned.

## Stage 3.4 — Helpdesk + engagement   `[ ☐ ]`
**Goal:** the support and communication surfaces (also the platform's own feedback channel).
**Depends on:** Phase 1 workflow/notification spine.
**Tasks:**
- [x] HD-01 — **DONE 1 Sep 2026.** `hd` schema + `modules/helpdesk` + real UI at `/helpdesk` serving all three shells docs/08 §3 names (employee "My tickets", agent "Queue", HR "Performance"). Categories carry their own SLA **and routing role as DATA** — a ticket is assigned by resolving that role through RBAC, never a hardcoded assignee. Every ticket gets an SLA clock at creation (`sla_due_at NOT NULL`) and an auto-acknowledgement; the queue sorts by SLA so what is about to breach comes first. Escalation sweep is idempotent per window. `hd.ticket_messages` is **append-only by DB trigger** (SOW-9.4) and internal notes are invisible to the raiser. **"HRMS platform" category seeded live from day one** (07 §4b). R29 monthly performance + Excel export.
- [x] EN-01/02/03 — **service + router + API DONE 2 Sep 2026** (`modules/engagement`: `/engagement/announcements*`, `/engagement/polls*`). Announcements reach an AUDIENCE ({categories, departmentIds, locationIds} — the same shape the policy publisher uses, CORE-13), never "everyone" by default; withdrawal is a flag, never a delete. Publishing is gated on `engagement.publish`; reading your own feed and answering a poll addressed to you is `authed`, so a mis-provisioned employee is never the one who hears nothing. Poll anonymity is fixed at creation and enforced by CHECK. **Schema gap found and fixed:** the shipped dedupe index only covered `respondent_user_id`, which is NULL on an anonymous poll — so anonymous polls could be stuffed without limit. Added the `respondent_hash` docs/03 §9 specifies (salted HMAC keyed on the app secret: dedupes without storing identity) + an identity-mode CHECK, in migration `1752040000000`. Anonymous responses are deliberately NOT audited — an audit row records the actor and would re-attach the identity the schema exists to remove. 7 integration tests (`tests/engagement.integration.test.ts`); the ballot-stuffing test was verified to FAIL without the fix. ESS announcement feed rendered on `/engagement`. **Remaining:** EN-04 already live via CORE-13; the publisher console + polls UI are frontend work.
**Tests required:** routing table; SLA escalation on test clock; anonymous survey dedupe (respondent_hash); R29 aggregates.
**Exit criteria:** a ticket escalates per matrix without manual touch · survey results render with zero identity leakage in anonymous mode.

## Stage 3.5 — Executive dashboards + BU dashboards   `[ ☐ ]`
**Goal:** the CEO deck, live — every KPI from the pptx, from snapshots, never fake data.
**Depends on:** 3.1–3.3 (lifecycle data feeds attrition/tenure).
**Tasks:**
- [~] RPT-03 — **snapshot + dashboard DONE 1 Sep 2026** (cost metrics await Phase 2). `reporting.kpi_daily` + `buildKpiSnapshot` job; `/api/reports/executive` reads **precomputed rows only** — opening the page never aggregates (docs/06 §4, CLAUDE.md §1.9). Live today: manpower count by category, average age, tenure, leadership %, absenteeism %, overtime hours, attrition rate, leavers, new-hire attrition 3/6/12 mo. `value` is **nullable with an `unavailable_reason`** so an uncomputable metric reads as ABSENT, never as 0 — the UI shows the reason on hover. Contract column reads "Phase 4" per docs/05 §4.8. CEO counters roll in once with the specified **40ms stagger** (capped at 300ms).
- [ ] RPT-04 — BU/plant-head dashboards (OU-scoped); R23 promotion/movement, R25 probation-due, R26 attrition reports
- [ ] Reports catalog page (05 §4.7) completing R-coverage: R21/R22 keep reading ATS data via integration until Phase 4
**Tests required:** every KPI formula vs 06 §4 definition on a synthetic dataset (hand-computed); snapshot refresh idempotence; counters never re-animate on poll (frontend test).
**Exit criteria:** CEO dashboard renders every pptx KPI from snapshots, first paint <2 s · KPI numbers tie out to their drill-down lists.

---

## Gate G3 — Phase 3 sign-off
- [ ] A real resignation processed system-only — every approver notified with receipts, F&F paid, letters issued through the system
- [ ] CEO dashboard reviewed and accepted by CEO Cell
- [ ] Asset exit-clearance loop closed on a real exit
- [ ] Labour Codes verification recorded; F&F TAT setting confirmed
- [ ] UAT sign-offs: HR ops (lifecycle), Admin (assets), CEO Cell (dashboard)
