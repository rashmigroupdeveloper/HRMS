# Rashmi Group HRMS — Executive Summary & Recommendation

**Project:** Custom HRMS for Rashmi Metaliks Limited (RML) and group entities
**Prepared:** 3 July 2026
**Status:** Approved decisions locked (see §3). Documentation set complete — see index in §7.

---

## 1. Why this project exists

RML ran three parallel HR-technology efforts in 2025. All three failed to deliver:

| Effort | Vendor | Outcome |
|---|---|---|
| Payroll + ESS on greytHR | Protiviti | ~93% of SOW "complete" on paper, but 25+ open pain points: broken OT module, no HR/CEO dashboards, wrong payslip templates, leave credits failing, F&F workflow never notified approvers, reports never configured, exited employees still "active" |
| HRMS (Core HCM + Recruiting) | Workday + Deloitte | Stalled at ~9% progress; payment-terms dispute; Workday rejected deferral request. Dropped. |
| ATS | Protiviti (greytHR ATS) | Quoted ₹1,800/login, 10-day promise slipped for months, "presented ATS not aligned with shared requirements". RML built its own ATS in-house instead — and it works. |

The in-house ATS (`interview_scheduling`) proved the model: a custom-built tool on React + Express + PostgreSQL, in the "Warm Editorial" design language, delivered what two vendors could not. **This HRMS extends that success to the full employee lifecycle.**

Cost context: Protiviti billed ₹4.75L one-time setup + ~₹93k/month for deployed resources (April 2025 invoice), plus ongoing dependency where "RML team is providing most of the inputs, and Protiviti is only executing the payroll run."

## 2. Build vs. buy — recommendation and reasoning

**Recommendation: BUILD, as one platform with the existing ATS.** Not the same software rebuilt — a broader platform that absorbs the ATS as its recruitment module.

**Why build:**
- Two vendor implementations failed on exactly the items RML cares about (dashboards, reports, OT, alerts, workflows). The gap was never features — greytHR *has* an OT module — it was *fit and follow-through*. A custom build makes fit the default.
- Payroll dependency is currently human, not systemic ("high level of dependency on the RML team"). Owning the engine removes the vendor and the implant resource costs (~₹11L+/year run-rate).
- The ATS demonstrated in-house delivery capability and management confidence in it.
- Requirements are unusually well documented (this repo): SOW line items, pain points with names and dates, report templates, LOI workflow, CEO dashboard KPIs. Low ambiguity = low custom-build risk.

**Why not adopt an open-source HRMS wholesale (Frappe HR / Horilla / OrangeHRM):**
- Different stacks (Frappe/Python/MariaDB; Horilla/Django; OrangeHRM/PHP) — none reuse the ATS codebase, design system, or team knowledge.
- Their UI cannot be made to match the Warm Editorial design language without effectively rewriting their frontends.
- OrangeHRM has no Indian statutory compliance built in; Frappe HR's India payroll is good but tied to the Frappe framework.

**What we take from open source instead (see 02-ARCHITECTURE §7 for specifics):**
- **Frappe HR (MIT)** — port its salary-structure/formula-component data model, income-tax slab engine design, and leave-ledger pattern to PostgreSQL. Its `biometric-attendance-sync-tool` is the reference pattern for Kent/Astra device ingestion.
- **Horilla (LGPL)** — reference for PF/ESI/TDS rule configuration UX.
- **Libraries (drop-in):** `docx`/docxtemplater (letters — already used in ATS), ExcelJS (muster/report exports — already used), BullMQ or pg-boss (payroll runs, alert queues), node-cron (leave accrual, absentee scans), Recharts (dashboards — already used).

## 3. Locked decisions (from sponsor, 3 Jul 2026)

| # | Decision | Choice |
|---|---|---|
| D1 | Payroll scope | **Full in-house payroll engine** — PF, ESIC, PT (WB), LWF, TDS, Form 16, F&F computed by the HRMS. Protiviti retired after parallel-run. |
| D2 | Workday | **Dropped/stalled.** This HRMS is the system of record. |
| D3 | Coverage | **Employees on rolls first** (white collar, blue collar, trainees, consultants). Entities: **RML, RGH, EIPL, RPL, RDL** (India) run the full India-payroll engine. **RPF (Dubai) is in the employee master but OUT of the India statutory-payroll scope** — no PF/ESIC/PT/TDS; its payroll is handled separately (manual/UAE-WPS) until a Dubai module is scoped. Contract-worker module deferred (schema reserves `employment_category='contract'`). |
| D4 | ATS + EMS relationship | **One platform, reached safely.** Same stack, same design tokens, single PostgreSQL server, shared SSO. The HRMS is the permanent system that **absorbs and supersedes** both the existing ATS (→ Recruitment module, Phase 4) and the team's live "Yatra Avedan" Travel & Expense/Claims EMS (→ M13, Phase 3.5); both are then retired. Adopt Yatra Avedan's proven TypeScript module architecture, `send_back` approvals, wallet/settlement ledger, and MinIO storage. Payroll/attendance stay on PostgreSQL for audit integrity. See **11-EXISTING-EMS-YATRA-AVEDAN.md**. |
| D5 | Hosting | **Self-hosted on RML's WHM server (full root).** Node apps under PM2 behind reverse proxy; PostgreSQL on the same box; nightly off-box backups. |

## 4. What the HRMS is (one paragraph)

A single web platform (plus the existing ATS) where: every employee has one master record from the day their LOI is accepted; Kent/Astra biometric swipes flow in automatically every few minutes and become processed attendance with shift, OT, late/early and absentee logic applied; leave, regularization, OD, comp-off, resignation, confirmation, transfer and loan requests move through configurable multi-level approval workflows with escalation; payroll runs monthly from that trusted attendance with full Indian statutory output (payslips, bank file, PF ECR, ESIC, PT, TDS/24Q, Form 16, JV); every report the HR team has ever asked Protiviti for is a self-serve export; and the CEO, plant heads and HR see live dashboards of the exact KPIs in the CEO Dashboard deck — with daily boarding/exit and absentee alerts emailed automatically, without exception.

## 5. Success criteria (traceable, not aspirational)

1. Every one of the 26 pain-point rows (02 Jul 2025 sheet) and 16 ESS pending-implementation rows maps to a shipped feature — traceability matrix lives in 01-REQUIREMENTS-PRD §9.
2. One month of payroll parallel-run matches Protiviti's register to the rupee (or differences are explained and accepted) before cut-over.
3. Muster report with Reporting Manager, Emp ID, and Cost Center columns downloadable by any authorized manager in < 10 seconds.
4. Daily 07:00 boarding/exit email and weekly absentee (7–10 day) show-cause queue run without manual triggering.
5. CEO dashboard renders every KPI on the HR Dashboard deck (manpower demographics by category, CTC averages, productivity/cost metrics, absenteeism, attrition incl. 3/6/12-month new-hire attrition) from live data.

## 6. Top risks (full register in 07-ROADMAP §5)

| Risk | Mitigation |
|---|---|
| Payroll compute errors → statutory/legal exposure | Port Frappe HR's proven calculation model; 1–2 month parallel run vs Protiviti register; payroll lock + audit trail |
| Kent biometric feed unreliability (root cause of the 200+ attendance mismatches) | Pull-based ingestion with per-device watermark + gap detection + device-offline alerting; raw swipes stored immutably so attendance can be recomputed |
| Single-server WHM hosting for a payroll system | PM2 + PostgreSQL PITR (WAL archiving), nightly off-box encrypted backups, documented restore drill; VPS migration path documented |
| Scope creep (HRMS = 13 modules incl. absorbed T&E + recruitment) | Phased roadmap with hard phase gates; Phase 1 ships the pain-point killers before payroll; absorptions (T&E Phase 3.5, ATS Phase 4) sequenced after core value |
| One-developer bus factor | This documentation set is written to be executable by any competent developer or AI agent without additional context |

## 7. Documentation set (read in this order)

| Doc | Contents |
|---|---|
| **00-EXECUTIVE-SUMMARY.md** | This file — recommendation, decisions, risks |
| **01-REQUIREMENTS-PRD.md** | Every requirement, traced to its source document line; personas; traceability matrix |
| **02-ARCHITECTURE.md** | Stack, WHM deployment topology, integrations (Kent, ATS, email, SAP loans), security, open-source adoption detail |
| **03-DATABASE-SCHEMA.md** | Every table and every column with its purpose — no speculative columns |
| **04-MODULE-SPECS.md** | Exact behavior of each module: attendance processing rules, leave accrual, OT 48-hour rule, payroll calculation order, statutory formulas, F&F, workflows |
| **05-UIUX-SPEC.md** | Warm Editorial design system (tokens verbatim from the ATS), page-by-page layout specs, interaction and motion rules |
| **06-REPORTS-AND-DASHBOARDS.md** | Every report with exact columns (muster, offer, attrition, CEO dashboard KPIs with formulas) |
| **07-ROADMAP.md** | Phases, sequencing logic, estimates, risk register, parallel-run and cut-over plan |
| **08-ROLES-AND-PERMISSIONS.md** | Role catalog (superadmin → employee incl. manager-of-managers), full permission grid, per-role navigation/dashboards, default approval chains per request type |
| **09-GREYTHR-RECON-FINDINGS.md** | Live read-only recon of RML's greytHR (employee + DGM accounts): real leave types, salary components + payslip template, TDS structure, shift/session config, full workflow catalog, group entities (RML/RGH/EIPL/RPF/RPL/RDL), ESS/manager parity targets |
| **10-INDIA-PAYROLL-STATUTORY-REFERENCE.md** | Verified current statutory seed data — PF/ESIC/PT-WB/LWF/income-tax slabs, gratuity/bonus, leave floors, compliance calendar, golden-test fixtures |
| **11-EXISTING-EMS-YATRA-AVEDAN.md** | The team's live in-house Travel & Expense/Claims EMS (TS/Mongo/MinIO/MUI); what to absorb, the resolved direction (HRMS supersedes it → M13), stack decision |
| **12-VISUAL-REFERENCE-CREXTIO.md** | The design *feel*: Nixtio/Crextio philosophy, the realized ATS recipe, 2026 warm-neutral trend validation, curated mood board and anti-references — companion to 05-UIUX |
| **13-MASTER-BUILD-PLAN.md** | The **executable plan**: numbered step-by-step tasks per phase with acceptance checks + gates, the scale posture (provision for 3k, replica-ready for 10k: partitioning + PgBouncer now, replica on trigger), cross-cutting workstreams, open decisions, and immediate next actions. Read after 07-ROADMAP; this is the build's working document. |
| **14-TECH-STACK-AND-RELIABILITY.md** | Research-verified **tech decision record + reliability program**: industry findings, stack verdicts (SeaweedFS replaces MinIO; Kysely; typed RPC; Money module; max-strict TS), DB/payroll/attendance correctness patterns (retro recompute-and-delta, hash-chained audit, sync watermark), the tiered zero-Sev1 reliability program, and the honest "0 bugs" contract. Where it conflicts with 02, doc 14 wins. |
| **10-INDIA-PAYROLL-STATUTORY-REFERENCE.md** | FY 2025-26 statutory rates (PF/ESIC/PT/LWF/TDS/bonus/gratuity), calculation pseudocode, RML policy flags, salary structure templates, golden-test fixtures, compute-vs-filing checklist |
