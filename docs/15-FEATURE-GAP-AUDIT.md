# 15 — Feature Gap Audit (what a complete HRMS has that we don't)

**Audited:** 02 Sep 2026 · **Auditor:** deep review of `docs/00–14` + `plans/` + shipped code, benchmarked against the
2026 HRMS market and the current India statutory landscape.
**Companion doc:** [`16-MICROFEATURE-INVENTORY.md`](16-MICROFEATURE-INVENTORY.md) — the exhaustive
feature/micro-feature checklist per module and per role. **This doc says *what is missing and why it matters*;
doc 16 says *every individual switch, field, screen and rule* that a complete system needs.**

> **This document does not change scope.** It is an evidence-backed gap register. Every item marked `G` is a
> decision the sponsor must make: **build / defer / accept the risk**. Nothing here overrides docs 00–14 until
> it is promoted into 01 (requirements), 07 (roadmap) and 13 (build plan).

---

## 0. Method & evidence base

**What was audited**

| Source | What was extracted |
|---|---|
| `docs/00–14` + `docs/recon/` | Every requirement ID (CORE/ATT/LV/PAY/LC/WF/RPT/AST/HD/EN/LN/CLM/TE), every table, every report R1–R31, every role & permission |
| `plans/phase-0 … phase-4` | Checkbox state per stage → what is actually delivered vs. planned |
| `backend/src/modules/*`, `backend/migrations/*`, `backend/src/api/router.ts`, `core/rbac/seed-data.ts` | The real shipped surface: 17 modules, 27 migrations, 21 permission codes, 10 roles |
| Market benchmark | Darwinbox, Keka, greytHR, Zoho People, HROne, ZingHR, PeopleStrong, Workday/SAP SF module taxonomies; India-specific: labour-law compliance suites, CLMS (contract-labour) suites, EHS suites, T&E suites |
| Statutory scan | Four **Labour Codes in force 21 Nov 2025** (central rules expected ~1 Apr 2026); **DPDP Rules notified 13 Nov 2025**; POSH Act 2013; Factories Act 1948 / OSH Code registers; CLRA 1970; Maternity Benefit Act 1961 |

**Status legend used throughout docs 15 and 16**

| Code | Meaning |
|---|---|
| **B** | **Built** — code exists in `backend/src/modules` + a route in `api/router.ts` |
| **S** | **Specced, not built** — has a requirement ID in docs and a task in `plans/`; a *delivery* gap, not a feature gap |
| **P** | **Partial** — the headline exists in docs, but named sub-features below are absent |
| **G** | **GAP** — appears in **no** doc and **no** plan. This document is the first place it is written down |
| **X** | **Deliberate non-goal** with a recorded decision (docs 01 §11 / 00 D1–D7) |

---

## 1. Scoreboard — where the platform stands today

### 1.1 By module

| # | Module | Doc'd | Built | Verdict |
|---|---|---|---|---|
| M1 | Core HR (master, org, letters, policies) | ✅ | **B** (employees, letters, policies, RBAC, audit, settings) | Solid; gaps are in documents/e-sign/nominations |
| M2 | Attendance | ✅ | **B** (Kent ingest, quarantine, day-status, roster, shifts, holidays, AR/OD/OT, absence engine, month-lock, muster) | Strongest module. Gaps: rostering intelligence, mobile capture depth |
| M3 | Leave | ✅ | **B** (types, accrual, apply, ledger, cancel, encash, RH, comp-off expiry, year-end) | Good. Gaps: statutory leave types, leave planner |
| M4 | Payroll & Statutory | ✅ (docs 04, 10) | **not started** | Phase 2 — 0/29 tasks |
| M5 | Lifecycle | ✅ | **P** (`lifecycle.router` = daily boarding/exit report only) | Phase 3 — 4/20 tasks |
| M6 | Workflows & Notifications | ✅ | **B** (engine, inbox, act, resubmit, timeline, escalation, delegation, notified_at) | Good |
| M7 | Reports & Dashboards | ✅ (R1–R31) | **P** — built: muster, R2, R3, R4, R5, R6, R24, R27, exec KPIs, BU, HR dash, ESS | ~9 of 31 reports |
| M8 | Assets | ✅ | **B** (register, assign, return, outstanding, maintenance) | Good |
| M9 | Helpdesk | ✅ | **B** (categories, raise, queue, thread, SLA, escalate, performance) | Gaps: knowledge base, confidential intake |
| M10 | Engagement | ✅ | **P** (announcements + polls built; **surveys not built**) | Gaps: R&R, wellness, eNPS |
| M11 | Loans & Advances | ✅ | **not started** | Phase 2 |
| M12 | Claims & Reimbursements | ✅ | **not started** | Phase 2/3.5 |
| M13 | Travel & Expense | ✅ | **not started** | Phase 3.5 — 0/17 tasks |
| M14 | ATS / Recruitment | partial (absorption only) | **not started** | Phase 4 — 3 tasks total |

### 1.2 Delivery position

```
Phase 0 Foundations            29/44  ██████████████░░░░░░
Phase 1 Attendance+Leave+WF    46/51  ██████████████████░░
Phase 2 Payroll & Statutory     0/29  ░░░░░░░░░░░░░░░░░░░░
Phase 3 Lifecycle/Assets/Exec   4/20  ████░░░░░░░░░░░░░░░░
Phase 3.5 Travel & Expense      0/17  ░░░░░░░░░░░░░░░░░░░░
Phase 4 ATS absorption          0/3   ░░░░░░░░░░░░░░░░░░░░
```

### 1.3 Gap counts found by this audit

| Register | Gap IDs | Count | Of which P0 (legal exposure / blocks go-live) |
|---|---|---|---|
| A — India statutory & legal | A01–A30 | 30 | 20 |
| B — Missing HR modules | B01–B18 | 18 | 1 |
| C — Platform & technical | C01–C25 | 25 | 4 |
| D — Plant / manufacturing operations | D01–D13 | 13 | 3 |
| E — Depth gaps inside specced modules | E01–E30 | 30 | — (sequenced with their parent module) |
| **Total** | | **116** | **28** |

Doc 16 counts the same ground at *micro-feature* granularity: **~507 capability rows, of which 180 appear in no
existing document.** The 116 gap IDs here are the management-level roll-up of those 180 rows.

---

## 2. Executive verdict — the ten findings that matter

1. **The spec predates the law it must obey.** The four Labour Codes came into force **21 Nov 2025**; docs 10/13
   still treat them as a *"verify before go-live"* TODO (`P0-T06`). Wage-definition ≥50%, 48-hour F&F, mandatory
   appointment letters, and fixed-term gratuity-at-1-year are **payroll-engine-shaping**, not footnotes. → **GAP-A01..A06**
2. **DPDP is completely absent.** Zero mentions of DPDP, consent, notice, retention, erasure, breach reporting or
   processor agreements across 3,740 lines of specification — while the platform is being built to hold biometrics,
   bank accounts, Aadhaar, PAN, health and salary for ~2,000+ people. This is the single largest unpriced legal risk. → **GAP-A07..A12**
3. **POSH and grievance redressal do not exist anywhere.** An establishment of this size legally must run an
   Internal Committee with confidential intake, a 90-day clock and an annual return by 31 Jan. Routing that through
   the generic helpdesk would itself be a compliance failure. → **GAP-A13..A15**
4. **Statutory registers ≠ MIS reports.** R1–R31 are excellent management reports, but not one of them is a
   Factories-Act/OSH-Code register (Form 12 adult workers, Form 15 leave-with-wages, Form 22 muster-cum-wages,
   accident register, OT register, annual return). An inspector asks for these, not for R24. → **GAP-A16..A18**
5. **Contract labour moved out of scope, and the residual risk moved with it — partly.** *(Updated 3 Sep 2026:
   D8 settled — a separate CLMS owns contractor master, licences, muster, wages and billing.)* What does **not**
   transfer is that CLRA principal-employer liability stays Rashmi's, and that contract workers are physically on
   our sites — so they must still appear in safety incidents, permits and an emergency roll call. HRMS therefore
   integrates rather than ignores: headcount feed, licence expiry into the compliance calendar, and an
   `external_worker_ref` that is deliberately **not** a foreign key. → **GAP-D02..D13** remain ours
6. **No performance, no learning, no compensation-review, no succession.** These are recorded non-goals — a
   *defensible* choice for Phase 1–3, but they are four of the fourteen modules every 2026 benchmark platform ships,
   and three of them (confirmation appraisal, training matrix, increment cycle) have *already surfaced* inside
   requirements we did accept (LC-04, CORE-14, PAY-17). → **GAP-B01..B07**
7. **Identity and integration are thinner than an enterprise expects.** No SAML/OIDC SSO, no SCIM provisioning,
   no MFA, no service accounts/API keys, no outbound webhooks — for a system that must talk to Kent, SAP, ATS,
   email and (later) a booking provider. → **GAP-C01..C07**
8. **The frontline is designed for desktop.** ~Half this workforce is blue-collar, Odisha/West Bengal, Android-first,
   WhatsApp-native. Spec gives them a PWA with GPS check-in and English-only UI. No native app, no offline punch
   queue, no push, no WhatsApp channel, no Hindi/Odia/Bengali. Adoption risk, not feature risk. → **GAP-C08..C12**
9. **No AI position at all.** Not a criticism of scope — a *documentation* gap. Every competitor now leads with a
   copilot; the sponsor will be asked "where is ours?". A recorded build/defer decision is needed. → **GAP-C18..C22**
10. **The good news.** Where the platform *is* built, it is built to a standard most vendors do not reach:
    hash-chained audit, append-only ledgers, immutable month-lock, sync watermarks, `notified_at` receipts,
    permission-per-procedure with DB-driven role grants, config-over-code. **The gaps are of breadth, not of quality.**

---

## 3. Register A — India statutory & legal gaps

> **These are the ones that can generate a notice, a penalty or a court matter.** Owner column = who must decide.

### A.1 Four Labour Codes (in force 21 Nov 2025)

| ID | Gap | Why it matters | Status | Priority | Owner |
|---|---|---|---|---|---|
| **GAP-A01** | **Wage-definition engine (≥50% rule).** Code on Wages requires basic+DA+retaining ≥ 50% of total remuneration, with PF/gratuity/bonus bases recomputed on it | Docs 10 §8 flag it as "verify"; there is no `wage_definition` rule object, no compliance check per structure, no arrears-propagation model if a structure is restated | **P** | **P0** | payroll admin |
| **GAP-A02** | **F&F within 2 working days / 48 hours** of exit | `fnf_tat_working_days` default is 3 in settings; the Code is tighter. Also needs an SLA clock + breach alert, not just a setting | **P** | **P0** | payroll admin |
| **GAP-A03** | **Mandatory appointment letter for every worker** (incl. contract/FTE) with prescribed particulars | Letters module (CORE-09) has templates but no *mandatory-issuance* rule, no coverage report ("who has no appointment letter on file") | **P** | **P0** | hr_head |
| **GAP-A04** | **Fixed-term employment (FTE): gratuity at 1 year**, pro-rata, benefits at par with permanent | Gratuity spec is 5y/240d only (10 §15 decision). `employment_category` has no `fixed_term` member | **G** | **P0** | payroll admin |
| **GAP-A05** | **Single registration / single annual return** under the codes; consolidated filing calendar | No statutory-registration master (which entity holds which registration/licence, expiry, renewal owner) | **G** | P1 | hr_head |
| **GAP-A06** | **Standing orders (300+ workers)** — model standing orders, certification, display, linkage to disciplinary grounds | No IR/standing-orders object anywhere; disciplinary chain is mentioned once (04 §LC-06) with no case file | **G** | P1 | hr_head |
| **GAP-A07** | **OSH Code: annual health check-up** for eligible workers; occupational-health record per employee | Nothing in schema or spec. Manufacturing + hazardous processes make this non-optional | **G** | **P0** | plant heads |
| **GAP-A08** | **OSH Code: women on night shift** — written consent register, transport + security arrangement evidence | Roster can assign a night shift to anyone with no consent artefact | **G** | **P0** | hr_ops |
| **GAP-A09** | **Working-hours / OT statutory caps** (daily & quarterly OT ceilings, spread-over, weekly rest) enforced *at roster time*, not discovered at payroll | OT is modelled (ATT-08, 48h rule) but as an approval SLA, not as a legal ceiling with a hard block + exception report | **P** | **P0** | plant heads |

### A.2 Data protection — DPDP Act 2023 + DPDP Rules 2025

| ID | Gap | Why it matters | Status | Priority |
|---|---|---|---|---|
| **GAP-A10** | **Privacy notice at collection** (employee + candidate + contractor worker), versioned, acknowledged | Legally required *in addition to* the legitimate-use basis for employment processing | **G** | **P0** |
| **GAP-A11** | **Consent registry** for non-employment processing (photos on the wall, wellness/health data, BGV, family data, marketing/alumni) with withdraw | No consent object exists | **G** | **P0** |
| **GAP-A12** | **Data-principal rights workflow** — access / correction / erasure requests, identity verification, statutory response clock, refusal reasons | Helpdesk could host it but there is no rights request type, no clock, no register | **G** | **P0** |
| **GAP-A13** | **Retention & purge schedule per data class** + automated purge job + legal-hold override | Docs say "5 years online history" (NFR-02) but define no deletion obligation, which DPDP requires | **G** | **P0** |
| **GAP-A14** | **Breach detection → notify Data Protection Board + affected principals** runbook and evidence trail | Nothing in doc 14's reliability program covers *personal-data* breach, only availability | **G** | **P0** |
| **GAP-A15** | **Processor register + DPAs** (SeaweedFS/host, SMTP/email vendor, Kent vendor, MakeMyTrip Corporate, any SMS/WhatsApp BSP) | Every transfer without a DPA is a violation | **G** | **P0** |
| **GAP-A16** | **Biometric template protection** — encryption at rest + in transit, retention limit, no raw template export | Kent swipe ingestion is specced; biometric *template* custody is not addressed | **P** | **P0** |
| **GAP-A17** | **Purpose-stamped access logging + employee-visible access log** ("who viewed my record and why") | Audit log is hash-chained and excellent, but records *actor + action*, not *purpose*, and is not exposed to the data principal | **P** | P1 |
| **GAP-A18** | **Consent Manager / grievance officer** publication + response SLA | Named DPO/grievance officer and contact must be published to employees | **G** | P1 |

### A.3 POSH, grievance, and other establishment obligations

| ID | Gap | Why it matters | Status | Priority |
|---|---|---|---|---|
| **GAP-A19** | **POSH module** — IC constitution per location (≥4 members, half women, external member, 3-yr term), **confidential** complaint intake outside the normal helpdesk, 90-day inquiry clock, interim relief, inquiry record, outcome + appeal, **annual report to District Officer by 31 Jan**, annual POSH training coverage | Zero mentions in the entire doc set. Mandatory at >10 employees | **G** | **P0** |
| **GAP-A20** | **Grievance redressal committee & case flow** (IR Code, 20+ workers) — distinct from helpdesk tickets, with confidentiality and escalation to management/labour authority | Absent | **G** | P1 |
| **GAP-A21** | **Whistleblower / ethics hotline** — anonymous channel, protected-disclosure handling, investigation file, retaliation flag | Absent | **G** | P1 |
| **GAP-A22** | **Maternity Benefit Act** — 26-week entitlement engine, medical bonus, work-from-home post-natal option, **crèche facility (50+ employees)**, no-dismissal protection, register | ML exists only as a leave-type name in the catalog (LV-01). None of the statutory mechanics | **P** | P1 |
| **GAP-A23** | **Statutory nominations & joining forms** — EPF Form 2 & Form 11, ESIC Form 1, **Gratuity Form F**, Form 12BB, with e-sign, versioning and "who is missing which form" report | Schema has `is_nominee`/`nominee_share_pct` columns only — no form, no workflow, no coverage report | **P** | **P0** |
| **GAP-A24** | **Statutory registration & licence master** — per entity/plant: PF/ESIC/PT/LWF/Factory licence/CLRA licence/Shops registration numbers, validity, renewal owner, T-30/15/7 alerts | Nothing. Multi-entity (14 companies) makes this unavoidable | **G** | **P0** |
| **GAP-A25** | **Compliance calendar** — every statutory due date (ECR 15th, ESIC, PT, LWF, TDS 24Q, annual returns, POSH 31 Jan, Factories annual return) with owner, evidence upload, and a "missed filing" alarm | Payroll console shows *payroll* due dates only (08 §3) | **P** | P1 |

### A.4 Factories Act / OSH Code registers & returns

| ID | Gap | Status | Priority |
|---|---|---|---|
| **GAP-A26** | **Form 12 Register of Adult Workers** (name, work, group, relay, hours) generated from roster + master | **G** | **P0** |
| **GAP-A27** | **Form 15 Register of Leave with Wages** generated from the leave ledger | **G** | **P0** |
| **GAP-A28** | **Form 22 Muster Roll cum Register of Wages** (attendance + payable days + rate + deductions in one statutory layout) — distinct from R1 muster | **G** | **P0** |
| **GAP-A29** | **Overtime register**, **Register of Accidents & Dangerous Occurrences**, **Form 4 General Register**, **annual return** | **G** | P1 |
| **GAP-A30** | **Register/return generator framework** — state-configurable layouts, since 14 entities may span multiple states' Factories Rules | **G** | P1 |

---

## 4. Register B — HR modules absent from the specification

| ID | Module / capability | Market position | Our status | Recommendation |
|---|---|---|---|---|
| **GAP-B01** | **Performance management** — goals/KRA/OKR cascade, review cycles (annual/mid-year/quarterly/probation/project), self + manager + peer, 360 with reviewer nomination and weighting, competency framework + gap analysis, rating scales, **calibration & bell-curve normalisation with audit trail**, 9-box, PIP, continuous feedback & 1:1s, performance analytics | Universal — in every benchmark platform | **X** (non-goal, docs 01 §11) | **Revisit.** LC-04 already needs a *confirmation appraisal*; PAY-17 already needs *increment processing*. Both are performance artefacts with no instrument behind them |
| **GAP-B02** | **Compensation review cycle** — budget pot, manager proposal worksheet, pay bands/ranges, compa-ratio, guidelines & guardrails, multi-level approval, letter generation, payroll hand-off, pay-equity view | Universal | **P** (PAY-17 = mechanical increment only) | Build after payroll; it is the natural consumer of B01 |
| **GAP-B03** | **Learning & training / training matrix** — role→mandatory-training map, certification & validity tracking, expiry alerts, safety/POSH/ISO-IATF induction records, attendance to training, effectiveness, audit evidence pack | Universal; **and an audit requirement in manufacturing** | **X** (non-goal) | **Revisit — this is a compliance artefact, not an L&D nicety.** Minimum viable: training matrix + certificate expiry, no courseware |
| **GAP-B04** | **Skills & competency inventory** — skill taxonomy, per-employee proficiency, skill gap by role/line, deployment fit | Standard | **G** | Pair with B03 |
| **GAP-B05** | **Career paths, succession planning, IDPs** — critical-role map, successor readiness, bench strength, risk-of-loss | Standard at enterprise tier | **G** | Defer with a recorded decision |
| **GAP-B06** | **Benefits administration** — group mediclaim/GPA/GTLI enrolment + dependants + mid-year additions, insurer file exchange, claim assist, superannuation, NPS, gratuity-fund/LIC trust reconciliation, flexi-benefit plan declaration & lock | Standard in India | **G** (only "flexi-basket" as a payroll component in CLM-01) | Build with Phase 2; PF/ESIC alone is not "benefits" |
| **GAP-B07** | **Recruitment depth** — manpower requisition (MRF) with **headcount-budget check**, approval chain, sourcing, resume parsing, pipeline, interview scheduling + panel scorecards, offer modelling & approval, candidate portal, **BGV**, offer e-sign, pre-boarding | Phase 4 is only "absorb the existing ATS" (3 tasks) | **P** | Decide: absorb-as-is vs. rebuild. MRF + budget check should exist regardless |
| **GAP-B08** | **Workforce planning & position management** — sanctioned posts/establishment, budgeted vs actual headcount per cost centre, vacancy pipeline, manpower cost forecast, scenario modelling | Standard | **G** | High value for a 14-entity group; feeds the CEO dashboard |
| **GAP-B09** | **Employee document vault with expiry** — categorised documents, mandatory-document checklist per category, expiry alerts (contracts, licences, medical fitness, visas, apprentice/ITI certs), bulk request | Universal | **P** (letters + policies only) | **P0-adjacent** — needed by A03, A07, A23 |
| **GAP-B10** | **E-signature (Aadhaar eSign / DSC)** on offers, appointment letters, policy acknowledgements, Form 16, F&F statements | Universal in India | **G** | Needed for A03/A23 to be defensible |
| **GAP-B11** | **Rewards & recognition** — spot awards, peer kudos, nomination + approval, points/budget, catalogue or payroll payout | Standard | **G** | Low cost, high adoption effect |
| **GAP-B12** | **Wellness / EAP** — programme enrolment, health-check campaign (ties to A07), counselling referral (confidential) | Standard | **G** | Pair with A07 |
| **GAP-B13** | **eNPS + engagement analytics** — recurring pulse, benchmark, driver analysis, manager-level heatmap, action plans | Standard | **P** (EN-03 surveys specced; **not built**; no eNPS/driver analytics) | Complete EN-03 first |
| **GAP-B14** | **Exit interview instrument + attrition-reason taxonomy** feeding the CEO dashboard; knowledge-transfer/handover checklist; rehire-eligibility flag; alumni engagement beyond payslip access | LC-07 = alumni *access* only | **P** | Cheap; materially improves RPT-03 |
| **GAP-B15** | **Internal job posting / internal mobility** — post internally first, apply, manager consent, transfer hand-off | Standard | **G** | Defer |
| **GAP-B16** | **Employee referral programme** — refer, track, payout via payroll | Standard | **G** | Defer |
| **GAP-B17** | **Onboarding depth** — buddy assignment, 30/60/90 check-ins, onboarding feedback survey, orientation content, joining-kit tracking | LC-01/02 = task fan-out + pre-join links | **P** | Cheap add-on to Phase 3 |
| **GAP-B18** | **Org design tooling** — drag-drop org chart, span-of-control analytics, vacancy visualisation, what-if restructure | Standard | **G** | Defer; but see C13 (org chart) |

---

## 5. Register C — Platform & technical gaps

| ID | Gap | Why it matters | Status | Priority |
|---|---|---|---|---|
| **GAP-C01** | **SSO — SAML 2.0 / OIDC** against the corporate IdP | Docs mention SSO only as an *ATS handoff*. 2,000+ users with no federation means 2,000+ passwords | **G** | **P0** |
| **GAP-C02** | **SCIM provisioning / de-provisioning** from the IdP or from the employee master to downstream apps | Exit-day access revocation is currently a manual IT onboarding task | **G** | P1 |
| **GAP-C03** | **MFA / step-up auth** for `payroll_admin`, `super_admin`, `hr_head`, and for salary/statutory-ID views | Zero mentions of MFA/2FA anywhere. Two-person payroll finalize exists but the *first* person only needs a password | **G** | **P0** |
| **GAP-C04** | **Session & device management** — active sessions list, remote revoke, idle timeout, concurrent-session policy, device binding for mobile punch | Absent | **G** | P1 |
| **GAP-C05** | **IP / network restriction** for admin and payroll roles; geo-restriction for statutory-ID access | Absent | **G** | P1 |
| **GAP-C06** | **Service accounts + API keys + outbound webhooks + idempotency contract** for machine clients (Kent, SAP, ATS, booking) | Only doc 14 mentions webhooks in passing; oRPC is designed for the browser client | **G** | **P0** |
| **GAP-C07** | **Password/credential policy as a documented, enforced object** (length, rotation, reuse, lockout, breach-list check) | bcrypt + JWT specced (NFR-03) but no policy object | **P** | P1 |
| **GAP-C08** | **Native mobile app (Android-first)** for the frontline; PWA is the only channel specced | Blue-collar Odisha/WB workforce; Android share dominant | **P** | P1 |
| **GAP-C09** | **Offline punch queue + background sync** for low-connectivity plant/field use | Not addressed; a PWA without an offline queue fails at the gate | **G** | P1 |
| **GAP-C10** | **Push notifications** (mobile) — currently email + in-app only | Approval SLAs depend on the approver actually being reached | **G** | P1 |
| **GAP-C11** | **WhatsApp Business API + SMS channel** for payslip/approval/announcement delivery | "WhatsApp" appears once, in 04. This is *the* channel for this workforce | **P** | P1 |
| **GAP-C12** | **Multi-language UI (Hindi / Odia / Bengali)** at least for ESS + policies + payslip labels | Explicit non-goal (01 §11). Directly conflicts with the blue-collar adoption goal and with POSH-training-in-local-language expectations | **X** | P1 — **revisit** |
| **GAP-C13** | **Interactive org chart** (browse, search, span-of-control, dotted-line/functional RM view) | CORE-03 stores both managers; nothing visualises the tree | **G** | P2 |
| **GAP-C14** | **Global search / command palette** across people, requests, tickets, assets, documents | Absent | **G** | P2 |
| **GAP-C15** | **Ad-hoc report builder + saved views + scheduled report subscriptions** ("email me R6 every Monday 07:00") | 31 fixed reports; every new question becomes a dev ticket | **G** | P1 |
| **GAP-C16** | **Bulk operations framework** — bulk upload/edit with dry-run, validation report, partial-commit, rollback, and an audit entry per row (transfers, salary revisions, roster, leave adjustments) | `employees/import.service.ts` exists for the master only | **P** | P1 |
| **GAP-C17** | **Sandbox / UAT tenant with masked production data**, plus config promotion (dev→prod) for settings, workflow definitions, letter templates | Parallel-run is specced (14 §75) but not a safe rehearsal environment | **G** | **P0** (before payroll) |
| **GAP-C18** | **AI: HR copilot** over policies + own data ("how much EL do I have", "why is my net lower this month") | No AI position anywhere. Deflects helpdesk volume; competitors lead with it | **G** | P2 — needs a recorded decision |
| **GAP-C19** | **AI: anomaly detection** on attendance/payroll (outlier net pay, impossible punches, duplicate bank accounts, ghost workers) | Highest-ROI AI use for a money-critical system | **G** | P2 |
| **GAP-C20** | **AI: attrition risk model** feeding the CEO dashboard | RPT-03 tracks new-hire attrition *after* the fact | **G** | P3 |
| **GAP-C21** | **AI: ticket auto-triage + suggested KB answer** | Helpdesk exists with categories; no deflection | **G** | P3 |
| **GAP-C22** | **AI governance position** — what we will/won't do with employee data and models, disclosed to employees (also a DPDP-adjacent expectation) | Absent | **G** | P1 |
| **GAP-C23** | **Product-usage telemetry** — per-role adoption, feature usage, drop-off; proves the CORE-14 training thesis | Helpdesk feedback loop only | **G** | P2 |
| **GAP-C24** | **Accessibility conformance evidence** — WCAG 2.2 AA audit report as a phase-gate artefact | Principles are stated (rule #10) but no audit deliverable | **P** | P1 |
| **GAP-C25** | **Data export / portability & archival** — full employee data pack (also a DPDP right), cold archive for exited employees, restore path | Backup/PITR is specced (NFR-05); *data lifecycle* is not | **P** | P1 |

---

## 6. Register D — Plant & manufacturing operations

> The docs treat RML as an office-shaped employer. It is a multi-plant steel group.

| ID | Gap | Status | Priority |
|---|---|---|---|
| ~~GAP-D01~~ | **Contract-labour management (CLMS)** — contractor master, licences, work orders, ceilings, worker enrolment, muster, wage register, challan verification, billing gate | **OUT — settled 3 Sep 2026 (D8).** A separate product owns this | **Replaced by an integration:** contractor headcount feed, contractor licence expiry raised through the HRMS compliance calendar, and an `external_worker_ref` so EHS and mustering can still see contract workers on our sites. The residual risk — principal-employer liability stays Rashmi's whoever holds the data — is now *visible here, managed there* |
| **GAP-D02** | **Gate pass & access control** — employee/contractor/visitor passes, late-in / early-out gate authorisation, material gate-pass linkage, lost-pass handling | **G** | P1 |
| **GAP-D03** | **Visitor management** — pre-registration, host approval, safety briefing acknowledgement, badge, exit | **G** | P2 |
| **GAP-D04** | **Canteen management** — meal punches by shift slot, entitlement/subsidy rules, contractor vs employee rates, **payroll recovery**, vendor reconciliation | **G** | P1 |
| **GAP-D05** | **Transport / bus roster** — route & stop master, seat allocation, shift-aligned trips, boarding scans, recovery/subsidy in payroll, night-shift women transport evidence (ties to A08) | **G** | P1 |
| **GAP-D06** | **Uniform & PPE issue/return** — entitlement per role, issue cycle, size, return/replacement, non-return recovery | **G** (Assets could extend) | P1 |
| **GAP-D07** | **Safety: incident / near-miss / accident** — report (mobile, with photo), investigation, root cause, CAPA, Form-23-style accident register, TRIR/LTIFR metrics, safety-induction records | **G** | **P0** (ties to A07/A29) |
| **GAP-D08** | **Permit-to-work** — hot work, confined space, height, electrical: issue, approval, gas readings, close-out | **G** | P2 |
| **GAP-D09** | **Fatigue & consecutive-shift rules** in rostering (max consecutive nights, min rest between shifts, double-shift block) | **G** | P1 |
| **GAP-D10** | **Manpower deployment vs plan** by line/section/shift, with shortfall alerts to the plant head | **G** | P2 |
| **GAP-D11** | **Disciplinary / IR case management** — misconduct log, show-cause notice, charge sheet, explanation, domestic enquiry (enquiry officer, witnesses, findings), suspension with subsistence allowance, punishment order, appeal, linkage to standing orders (A06) | **P** — one clause in 04 §LC-06 ("disciplinary chain"), no case object | **P0** |
| **GAP-D12** | **Union & settlement register** — recognised unions, office bearers, charter of demands, settlement/LTS terms and their payroll effect | **G** | P2 |
| **GAP-D13** | **Apprentices & trainees (NAPS/NATS)** — registration, stipend rules, contract period, completion certificates, statutory returns | **P** (PAY-14 apprentice *deduction* rules only) | P1 |

---

## 7. Register E — Depth gaps inside modules we already spec

Only the material ones are listed; the exhaustive line-by-line list is in **doc 16**.

**Attendance (M2)**
- **GAP-E01** No auto-rostering / demand-based schedule generation; roster is manual entry only. `P`
- **GAP-E02** No shift-swap or shift-bid request type between employees. `G`
- **GAP-E03** No selfie/face capture + liveness/anti-spoof on mobile punch (buddy-punching control). `G`
- **GAP-E04** No geofence *definition* object (site polygons/radii, per-site allow-list); ATT-14 stores coordinates but nothing validates them. `P`
- **GAP-E05** No attendance for contract workers / third parties (ties D01). `X`
- **GAP-E06** No short-leave / "permission hours" quota engine (chain exists in 08 §4; no entitlement/quota rules). `P`
- **GAP-E07** No attendance-vs-biometric reconciliation report for auditors (swipe-count vs day-record integrity). `P`

**Leave (M3)**
- **GAP-E08** Statutory leave types missing from the catalog: paternity, adoption, bereavement, marriage, sabbatical, quarantine, national/festival holiday leave per state rules. `P`
- **GAP-E09** No leave planner / team leave calendar with blackout periods and min-coverage rules. `G`
- **GAP-E10** No leave-donation / leave-bank, no negative-balance policy object, no advance-leave sanction. `G`
- **GAP-E11** Multiple holiday calendars per location/entity exist as data, but no *optional/restricted holiday quota per calendar per grade*. `P`

**Payroll (M4) — before it is built, add**
- **GAP-E12** Salary-on-hold / withheld-payment handling with release workflow. `G`
- **GAP-E13** Off-cycle / supplementary run type distinct from the monthly run. `P`
- **GAP-E14** Multi-bank / multi-format bank advice files per entity + payment-status reconciliation (returned/failed credits). `P`
- **GAP-E15** GL/JV posting to SAP with cost-centre mapping, posting status and re-post. `P`
- **GAP-E16** Old vs new tax-regime election capture per employee per FY with lock date and change audit. `P`
- **GAP-E17** Form 16 Part A+B assembly + bulk digital signing + distribution + reissue. `P`
- **GAP-E18** Perquisite valuation beyond loans (car, accommodation, ESOP), Form 12BA. `G`
- **GAP-E19** Payroll variance/exception dashboard vs prior month (the pre-finalize control), beyond parallel-run reconciliation. `P`
- **GAP-E20** Payroll input freeze / cut-off calendar with per-input-source status ("attendance locked ✓, claims closed ✓, loans ✗"). `P`

**Workflow (M6)**
- **GAP-E21** No visual/no-code chain builder for `hr_head` — chains are configurable in principle (WF-01) but there is no builder UI specced. `P`
- **GAP-E22** No conditional routing on data attributes (amount, grade, entity, plant) beyond "if > N days". `P`
- **GAP-E23** No parallel/quorum approval steps (all sequential). `G`
- **GAP-E24** No approve-from-email / approve-from-push deep link. `G`
- **GAP-E25** No bulk approve across request types in one inbox action. `P`

**Reports (M7)**
- **GAP-E26** 22 of 31 specced reports unbuilt; no report scheduling/subscription (see C15). `S`
- **GAP-E27** No data dictionary / metric definitions page so two dashboards can't disagree about "headcount". `G`

**Helpdesk (M9)**
- **GAP-E28** No knowledge base / FAQ with deflection at ticket creation. `G`
- **GAP-E29** No confidential/sensitive ticket class (needed before POSH or grievance can ever touch it). `G`
- **GAP-E30** No CSAT on resolution. `G`

---

## 8. Delivery gaps (specced but not built)

These are **not** feature gaps — they are the remaining plan. Listed so the sponsor sees the whole picture.

| Area | Requirement IDs | Plan | Remaining |
|---|---|---|---|
| Payroll engine + statutory + F&F | PAY-01..17, doc 10 G1–G10 | `phase-2` | 29 tasks |
| Loans & advances | LN-01..04 | `phase-2` | in the 29 |
| Claims & reimbursements | CLM-01..07 | `phase-2/3.5` | — |
| Lifecycle (onboarding→confirmation→transfer→separation) | LC-01..07 | `phase-3` | 16 tasks |
| CEO dashboard + R21–R30 | RPT-03 | `phase-3` | in the 16 |
| Travel & Expense (wallet/settlement/booking) | TE-01..12 | `phase-3.5` | 17 tasks |
| ATS absorption | Phase 4 | `phase-4` | 3 tasks |
| Phase 0 residue | — | `phase-0` | 15 tasks |

---

## 9. Recommended close-out

### 9.1 Pull into Phase 0/1 immediately (legal exposure, cheap now, expensive later)

1. **Labour-Codes conformance pass** — GAP-A01..A04, A09. Turn `P0-T06` from "verify" into a signed
   conformance note + settings + a `wage_definition` check in the salary-structure validator.
2. **DPDP baseline** — GAP-A10..A18. Privacy notice + consent object + rights-request workflow + retention
   schedule + processor register + purpose-stamped access log. This is ~1 module and it protects everything else.
3. **Statutory registration & licence master + compliance calendar** — GAP-A24, A25. Small table, large protection.
4. **Statutory registers generator** — GAP-A26..A28 (Form 12/15/22). They are *derivations* of data we already hold.
5. **MFA + SSO** — GAP-C01, C03. Before payroll data exists in the system, not after.
6. **Document vault with expiry + e-sign** — GAP-B09, B10. Prerequisite for A03, A07, A23.

### 9.2 Decide before Phase 2 (payroll) starts

- **GAP-C17 sandbox/UAT tenant with masked data** — you cannot rehearse payroll safely without it.
- **GAP-E12..E20** — cheaper to spec into the payroll engine than to retrofit.
- **GAP-B06 benefits administration** — decide whether insurance/superannuation/NPS are in or out.

### 9.3 Sponsor decisions required (each is a "build / defer / accept risk")

| Decision | Gaps | Note |
|---|---|---|
| ~~D8 — Contract labour~~ | D01–D02, E05 | **SETTLED 3 Sep 2026: OUT** — separate product (CLMS); HRMS integrates only |
| **D9 — POSH & grievance: build or run off-system?** | A19–A21 | Recommend **build**; off-system means no evidence trail |
| **D10 — Performance & training: still non-goals?** | B01, B03 | Recommend **training matrix in** (audit requirement), **appraisals deferred to Phase 5** |
| **D11 — Frontline channel strategy** | C08–C12 | Recommend native Android + WhatsApp + Hindi/Odia/Bengali ESS |
| **D12 — AI position** | C18–C22 | Recommend a written position now; build C19 (anomaly detection) first, not a chatbot |
| **D13 — Plant operations (canteen/transport/gate/EHS)** | D02–D10 | Recommend a **Phase 6 "Plant Ops"** rather than silent omission |

### 9.4 Proposed phase additions

```
Phase 5 — Compliance & Trust      (A10–A30, B09, B10, C01–C07, C17)   ~6–8 wk   ← should partly precede Phase 2
Phase 6 — Plant Operations        (D01–D13)                            ~8–10 wk
Phase 7 — Talent                  (B01–B05, B11–B18)                   ~8–10 wk
Phase 8 — Intelligence & Frontline(C08–C16, C18–C25)                   ~6–8 wk
```

### 9.5 Doc changes this audit implies

- `01-REQUIREMENTS-PRD` §11 — retract/qualify the non-goals for **training matrix** and **multi-language**; add
  new requirement IDs `CMP-01..` (compliance), `SEC-01..` (identity/security), `PLT-01..` (plant ops).
- `00-EXECUTIVE-SUMMARY` — add locked decisions **D8–D13** once the sponsor rules.
- `07-ROADMAP` / `13-MASTER-BUILD-PLAN` — insert Phases 5–8 and move the Phase-5 compliance items *ahead of* Phase 2.
- `03-DATABASE-SCHEMA` — new schemas `cmp` (compliance/consent/registers), `clm` (contract labour), `ehs` (safety), `fac` (canteen/transport/gate).
- `08-ROLES-AND-PERMISSIONS` — new roles: `compliance_officer`, `posh_ic_member`, `safety_officer`, `contractor_admin`, `contractor_supervisor` (external), `dpo`.

---

## 10. Sources

Market & module benchmarks: [Darwinbox — Top HR modules](https://darwinbox.com/blog/top-hr-modules) ·
[Keka — payroll software features](https://www.keka.com/payroll-software-features) ·
[greytHR — best attendance software](https://www.greythr.com/list/best-attendance-management-software/) ·
[HROne — attendance software India 2026](https://hrone.cloud/blog/attendance-management-software-india-2026/) ·
[Aaxonix — Zoho/Keka/greytHR/Darwinbox compared](https://aaxonix.com/resources/zoho-people-keka-greythr-darwinbox-india-hrms/) ·
[HROne — HRMS evaluation checklist India](https://hrone.cloud/blog/hrms-evaluation-checklist-india) ·
[FlexiEle — performance management](https://flexiele.com/products/performance) ·
[Engagedly — performance management software](https://engagedly.com/blog/best-performance-management-systems/) ·
[HROne — compensation management software](https://hrone.cloud/blog/compensation-management-software/)

India statutory: [EY — new labour codes effective 21 Nov 2025](https://www.ey.com/content/dam/ey-unified-site/ey-com/en-in/alerts-hub/2025/11/new-labour-codes-implemented-across-the-country-effective-21-november-2025.pdf) ·
[TaxGuru — labour codes HR & compliance guide](https://taxguru.in/corporate-law/indias-labour-codes-complete-hr-compliance-guide-employers-employees-industry.html) ·
[PayrollOrg — India's labour codes: payroll teams must act](https://payroll.org/news-resources/news/news-detail/2025/12/17/india-s-new-labour-codes-are-in-force-payroll-teams-must-act) ·
[KPMG — implementation of four labour codes](https://kpmg.com/xx/en/our-insights/gms-flash-alert/flash-alert-2025-267.html) ·
[Rainmaker — employee data privacy under DPDP](https://rainmaker.co.in/employee-data-privacy-dpdp-act-hr-payroll-compliance-india/) ·
[DPDP Rules 2025](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025) ·
[greytHR — POSH guide](https://www.greythr.com/guides/posh-full-form/) ·
[IncorpX — POSH compliance 2026](https://www.incorpx.io/blog/posh-act-compliance-employers-india) ·
[greytHR wiki — Form 22 muster roll cum wages register](https://www.greythr.com/wiki/compliances/karnataka-form-22-muster-roll-cum-register-wages/) ·
[Turbocomply — Factories Act Form 12](https://www.turbocomply.com/factories-act-registers-form-12/) ·
[Mynd — Factories Act compliance](https://www.myndsolution.com/best-practices/handling-factory-act-compliance-in-statutory-compliance-in-india/) ·
[Mynd — CLRA licences & employer duties](https://www.myndsolution.com/understanding-contract-labour-compliance-in-india-the-clra-act-licenses-and-employer-duties/) ·
[HROne — labour law compliance software](https://hrone.cloud/blog/labour-law-compliance-software/) ·
[Quikchex — salary advances & loans tax rules](https://quikchex.in/salary-advances-loans-to-employees/) ·
[EZHRM — India onboarding checklist 2026](https://ezhrm.in/employee-onboarding-checklist-india-2026/)

Platform & frontline: [WorkOS — SCIM vs SAML](https://workos.com/blog/scim-vs-saml) ·
[Darwinbox — HR data security & compliance](https://darwinbox.com/blog/hr-data-security-compliance-enterprise-hrms) ·
[SalaryBox — preventing buddy punching / AI attendance](https://salarybox.in/how-to-prevent-buddy-punching-in-2026-ai-based-attendance-systems-for-indian-businesses/) ·
[SalaryBox — shift scheduling & rostering India](https://salarybox.in/blog/shift-scheduling-roster-management-for-multi-shift-indian-businesses-complete-guide-2026/) ·
[Aadhaar eSign (India)](https://en.wikipedia.org/wiki/ESign_(India)) ·
[Truecopy — eSignature for HR](https://truecopy.in/blog/esignature-for-hr-employee-document-signing/) ·
[Automation Anywhere — agentic AI in HR 2026](https://www.automationanywhere.com/company/blog/ai-in-hr) ·
[EHS Insight — manufacturing safety management](https://www.ehsinsight.com/industries/manufacturing-safety-management-software) ·
[Savvy HRMS — canteen management system guide](https://savvyhrms.com/canteen-management-system-complete-guide/) ·
[Savvy HRMS — contract labour management](https://savvyhrms.com/contract-labor-management/) ·
[Staffbase — intranet features](https://staffbase.com/blog/intranet-features) ·
[Zaggle — travel & expense management India](https://www.zaggle.in/knowledge-hub/blog/travel-and-expense-management-software-what-growing-teams-need) ·
[Rippling — 25 HR metrics with formulas](https://www.rippling.com/en-GB/blog/best-metrics-to-track-for-hr)
