# 07 — Implementation Roadmap

Sequencing logic: **ship the pain-point killers first (attendance/leave/reports — where Protiviti failed hardest), earn trust with visible wins, then take over payroll with a parallel run.** Payroll before trusted attendance would be building on sand — payroll consumes locked attendance (hard dependency in the schema).

Workstream assumptions: 1 senior full-stack developer + AI agents, HR SME availability (Rachna/Sushanta-level) ~2 h/week for policy answers, IT contact for Kent access. Durations are calendar working weeks and include tests per the global TDD/80% rule; treat as estimates ±30%.

## Phase 0 — Foundations (2–3 weeks)
- Repo scaffold (monorepo per 02-ARCH §1), CI (lint, typecheck, tests), deploy script to WHM, PM2 config, staging vhost + DB.
- `packages/tokens` + `packages/ui`: port Card/DarkCard/Pill/StatusBadge/KpiNumber/DataTable/Drawer/Timeline/EmptyState from ATS.
- Auth (JWT issuer + refresh + lockout), RBAC tables, audit-log plumbing, settings store, notification queue + SMTP.
- Org structure + **employee master** (all CORE-01..08 validations), e-code generator, Excel bulk import with per-row validation report.
- **Employee-master seed (confirmed source, doc 11 §0):** import the **1,066-row EMS `users` collection** (cleanest hierarchy + identity we hold) keyed on **`userid` = greytHR employee code**, then **enrich each row from the greytHR export** on the same `userid` for the HR fields the EMS lacks (DOB, DOJ, grade, PAN/Aadhaar/UAN/ESIC, bank). Import validators must dedupe the 14-entity company master (merge the "Rashmi Metalix" misspelling into RML), normalize the 176 designations / 112 departments, and fix `userid` typos (e.g. `EIPLL366`).
- Migration dry-run: reconcile EMS-seeded master ↔ greytHR export row counts per entity before load.
- **Week-1 external dependencies (chase immediately, blocks Phase 1):** Kent access method (DB/API/CSV) from IT; bank bulk-file format from Finance; current leave policy matrix, shift definitions & grace rules from HR; payslip template sign-off; headcount confirmation (NFR-02).

**Gate G0:** employee master loaded and validated; SSO works against ATS; deploy pipeline proven.

## Phase 1 — Attendance, Leave, Workflows, Core Reports (6–8 weeks) → the visible win
- Kent connector + ingestion pipeline + device-health alerting (ATT-01/02) — *build first, let it accumulate data while the rest is built*.
- Day-status processor + recompute, shifts/rosters/holidays, week-off eligibility (ATT-03/04/05/09).
- Workflow engine + approvals inbox (WF-01..04). AR/OD (ATT-06/07), OT with 48h rule (ATT-08).
- Leave: types, ledger, accrual job, applications, comp-off (LV-01..05).
- Absentee engine + show-cause queue (ATT-10/11); daily boarding/exit email (LC-03) — *(small, huge visibility — deliver early in phase)*.
- Reports R1–R6, R24, R27; HR dashboard; manager team view; ESS home + my-attendance/leave; month-lock checklist (ATT-15).
- Letters engine (templates + show-cause + certificates) (CORE-09); policy acknowledgment (CORE-13).

**Gate G1:** one full month runs on HRMS attendance in parallel with greytHR; muster matches physical reality at the plant (spot-check vs Kent raw); managers doing approvals in-app; boarding/exit email running daily. *This gate replicates and fixes PP-9 — the 200-employee mismatch must be demonstrably impossible.*

## Phase 2 — Payroll & Statutory (8–10 weeks) → the takeover
- Salary components/structures/effective-dated assignments; probation % automation (PAY-01/02); CTC-vs-breakup validation.
- Run pipeline (draft→finalize, locks, immutability), proration/LOP/arrears (PAY-03/04/16), inputs, holds (PAY-08).
- Statutory: PF+ECR, ESIC, PT-WB, LWF, TDS projection + declarations + 24Q/Form 16 (PAY-09..13); golden-file test suite (§04-6.9) — *statutory formulas are test-first, no exceptions*.
- Payslip template + PDF render + ESS view (PAY-06); bank file; JV/GL mapping; reports R7–R19.
- Loans & advances module (M11) + SAP legacy import (PP-11).
- YTD import from Protiviti (mid-year TDS continuity), **parallel run 1–2 months (R20)**, cut-over sign-off (HR Head + Finance).

**Gate G2:** parallel-run register matches to the rupee (or signed-off differences); first live payroll month processed end-to-end; statutory files accepted by portals (ECR upload verified). *Protiviti retired after this gate.*

## Phase 3 — Lifecycle, Assets, Helpdesk, Engagement, Executive (5–6 weeks)
- Onboarding bridge from ATS + pre-join links + task fan-out (LC-01/02); probation/confirmation workflows + salary switch (LC-04, PAY-02 e2e).
- Separation pipeline + clearances + F&F (LC-06, PAY-15) with letter gating; transfers incl. entity transfer (LC-05).
- Assets (AST-01..06), Helpdesk (HD-01), Engagement (EN-01..04).
- CEO dashboard + KPI snapshots (RPT-03, R21–R23, R26, R28–R30); BU dashboards.
- F&F golden tests (gratuity/encashment/notice recovery); alumni ESS mode.

**Gate G3:** a real resignation processed system-only (every approver notified with receipts); CEO dashboard reviewed by CEO Cell; asset exit-clearance loop closed.

## Phase 3.5 — Travel & Expense absorption (M13 / TE-01..12) — supersede Yatra Avedan
The team's approved T&E system already exists (doc 11); this phase makes the HRMS its better, permanent replacement.
- Port the module pattern + models to Postgres: Trip, Budget/allowances, Advance, **Wallet + WalletTransaction settlement ledger**, Claim (multi-currency line items), international-travel-policy, MMT booking connector.
- Wire settlement → payroll (recoverable advances → deduction; reimbursements → payroll or off-cycle batch).
- **Migrate Yatra Avedan MongoDB data** (users/trips/claims/advances/budgets/wallets/transactions) into HRMS; parallel-run for parity.
- **Decommission Yatra Avedan** once parity + payroll settlement proven. (Gate G3.5: a full trip→advance→booking→claim→settlement cycle runs in HRMS and reconciles to the wallet to the rupee.)

## Phase 4 — ATS absorption + contract workers (scoped later)
- ATS frontend under HRMS shell consuming shared packages; recruit schema migration; offer report fully internal (R21).
- Contract-worker module (D3 deferral): contractor entities, gate-pass linkage, contractor muster & compliance registers — **separate PRD when RML prioritizes it** (schema already reserves `category='contract'`).
- Mobile/geo check-in PWA rollout to sales staff (ATT-14) if not pulled into Phase 1 by demand.

> **Consolidation goal:** by end state, the HRMS is the single platform — payroll/attendance/leave/lifecycle + T&E (ex-Yatra Avedan) + recruitment (ex-ATS) — owning the employee master, with greytHR retired. Yatra Avedan and the standalone ATS are absorbed, not perpetually integrated.

## Timeline summary

| Phase | Duration | Cumulative |
|---|---|---|
| 0 Foundations | 2–3 wk | ~3 wk |
| 1 Attendance/Leave/Workflows | 6–8 wk | ~11 wk |
| 2 Payroll & Statutory | 8–10 wk | ~21 wk |
| 3 Lifecycle/Assets/Executive | 5–6 wk | ~27 wk |
| 3.5 Travel & Expense (absorb Yatra Avedan) | 4–6 wk | ~32 wk |
| 4 ATS absorption + contract workers | scoped later | — |
| 4 ATS absorption / contract | scoped later | — |

≈ 6–7 months to full Protiviti replacement, with visible value from ~week 8 (Phase-1 attendance + daily emails + muster).

## 4b. Training & change management workstream (runs across all phases)

The greytHR rollout needed ~11 training sessions and HR *still* logged "ESS Admin Access Training" as a pain point (PP-v2-7). Training is a deliverable per phase gate, not an afterthought:

- **Per phase:** UAT with the actual users (HR ops for Phase 1 attendance, Subhasis + Finance for Phase 2 payroll) before the gate; their sign-off is part of the gate.
- **Materials:** 1-page role quick-guides (employee, manager, HR, payroll) per module, screenshots from the real system; short screen recordings for the 5 daily-loop actions; in-app contextual help + teaching empty states (CORE-14) reduce the need for live sessions.
- **Sessions:** one live session per audience per phase (employees via managers cascade at the plants; admins hands-on), plus an open office-hour in week 1 after each go-live.
- **Admin access matrix** published at each phase (who has which role — the transparency Protiviti never provided, PI-ESS-2).
- **Feedback loop:** helpdesk category "HRMS platform" from day one; weekly triage of tickets into bug/training-gap/feature-request during rollout months.

## 5. Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| 1 | Statutory calc error → penalty/legal | M | H | Golden tests, Frappe-HR-derived models, parallel run, statutory rates as reviewed data, payroll immutability + audit |
| 2 | Kent access blocked/slow (IT dependency) | M | H | Week-1 escalation item; CSV-drop fallback connector; RML owns Kent — CIO sponsor to unblock |
| 3 | Single WHM server failure during payroll week | L | H | PITR + nightly off-box backups + rehearsed restore (NFR-05); deploy freeze; documented VPS migration path |
| 4 | Policy ambiguity (grace, OT rates, notice periods) stalls build | H | M | Everything policy-like is a setting (§04-7); build with defaults, HR tunes later; weekly SME slot |
| 5 | Scope creep from stakeholder enthusiasm | H | M | Change requests map to requirement IDs; phase gates; non-goals list (PRD §11) |
| 6 | Adoption resistance (managers used to email/Excel) | M | M | ≤2-click approvals, muster parity from day one, phased trust-building; plant-head daily email creates pull |
| 7 | Bus factor (one developer) | M | H | This doc set is the spec-of-record; conventional stack; tests as executable documentation |
| 8 | Data migration quality (greytHR exports dirty) | M | M | Import validators with per-row reports (CORE-12); reconciliation counts vs source; go-live only on clean load |
| 9 | Parallel-run mismatch unexplained | M | H | Component-level Δ report; Protiviti contract kept alive until G2 sign-off |
| 10 | **Ongoing ownership / statutory maintenance** — industry rule of thumb: custom payroll needs ~15–20% of build effort/year *forever* to keep statutory logic current (Budget slab changes, PF/ESIC/PT notifications, Labour Codes). This is the #1 reason "buy" beats "build" for most orgs. | H | H | Rates are versioned **data** not code (doc 10 `statutory_rates`) so updates are row edits not redeploys; assign a named owner to review each Union Budget + statutory notification; golden tests catch regressions. **RML must budget this permanently — building is only worth it if you can staff ongoing ownership.** |
| 11 | Integration effort underestimated (industry: integrations are ~⅓ of build cost, always under-budgeted) | H | M | Kent, greytHR migration, Yatra Avedan absorption, ATS, SAP, MMT are all integrations — each is scoped with its own spike/gate; Kent spike is week-1 |

## 6. Immediate next steps (on plan approval)

1. Confirm week-1 external dependencies list (Phase 0) with IT/Finance/HR — send the asks today.
2. Scaffold `rashmi-hrms` monorepo + CI + staging deploy.
3. Port design tokens/primitives from ATS into `packages/ui`.
4. Employee master schema migration + import of current headcount export.
5. Kent connectivity spike (read one day of swipes end-to-end) — de-risk the highest-risk integration first.
