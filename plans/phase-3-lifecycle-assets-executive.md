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

## Stage 3.3 — Transfers + assets   `[ ☐ ]`
**Goal:** internal movement with history, and the asset registry with the exit loop closed.
**Depends on:** 3.2 (clearances integration).
**Tasks:**
- [ ] LC-05 — Transfer workflows (department/location/cost-center/**entity** incl. new e-code per target series + payroll continuity per SOW-5.3); `employee_history` effective-dated rows
- [ ] AST-01..03 — Asset registry (search by asset_no/serial/holder incl. third-party), allocation to employees + third parties, warranty past-dates allowed
- [ ] AST-04..06 — Resigned-employee asset view + return in exit clearance; non-returned dashboard tile; maintenance/incident/lost handling
**Tests required:** entity transfer generates correct new e-code + continuity rows; exit clearance lists exactly the holder's open assignments; history rows drive R23.
**Exit criteria:** an entity transfer preserves payroll continuity in the next run · a resigned employee's unreturned asset blocks Admin clearance until dispositioned.

## Stage 3.4 — Helpdesk + engagement   `[ ☐ ]`
**Goal:** the support and communication surfaces (also the platform's own feedback channel).
**Depends on:** Phase 1 workflow/notification spine.
**Tasks:**
- [ ] HD-01 — Tickets: categories, auto-acknowledge + assignment routing, SLA escalation matrix, thread with attachments, monthly performance report (R29); **"HRMS platform" category live from day one** (07 §4b)
- [ ] EN-01..04 — Announcements (audience-filtered), polls (anonymous-capable), pulse surveys with response analytics, policy-ack integration (CORE-13 tile)
**Tests required:** routing table; SLA escalation on test clock; anonymous survey dedupe (respondent_hash); R29 aggregates.
**Exit criteria:** a ticket escalates per matrix without manual touch · survey results render with zero identity leakage in anonymous mode.

## Stage 3.5 — Executive dashboards + BU dashboards   `[ ☐ ]`
**Goal:** the CEO deck, live — every KPI from the pptx, from snapshots, never fake data.
**Depends on:** 3.1–3.3 (lifecycle data feeds attrition/tenure).
**Tasks:**
- [ ] RPT-03 — `reporting.kpi_daily` nightly snapshot job; CEO dashboard at `/executive` (05 §4.8): demographics table by category, productivity/cost cards, absenteeism/attrition incl. **new-hire attrition 3/6/12 mo**, burnout index (defined in settings, labeled "index"); Contract column reads "Phase 4"
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
