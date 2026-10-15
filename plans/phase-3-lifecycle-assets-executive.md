# Phase 3 — Lifecycle · Assets · Helpdesk · Engagement · Executive

> **14 Oct repair audit:** lifecycle, transfer and dashboard completion claims are reopened against source/database findings. Preserve credited asset capabilities, but require the linked exit criteria and acceptance receipts. [Current SOW issues and remaining work](../outputs/remediation-2026-10-14/SOW-ISSUES-AND-REMAINING.md) is the repair crosswalk. G3 remains open.

**Target:** 5–6 weeks · **Gate:** G3 · **Spec:** docs/13 §6, docs/04 §4/§6, docs/01 §7–8, docs/06 §3–4, docs/03 §7/§9
**Purpose:** the full employee journey (join → confirm → transfer → exit with F&F), supporting workplace modules, and the executive analytics layer.
**Hard preconditions:** Gate G2 (salary switch, loans, claims, and F&F settlement depend on live payroll engine).

---

## SOW Traceability & Scope Map — original spreadsheet rows

Regenerated on 14 Oct from all 176 original scored rows. IDs below are physical spreadsheet row IDs, including shared dependencies; they do not assert completion. Requirement/card crosswalk remains authoritative. Earlier contiguous block ranges were unverified.

| Exact SOW row IDs | Capability | Card | Requirement IDs |
|---|---|---|---|
| SOW-004, SOW-022, SOW-023, SOW-025, SOW-026, SOW-030, SOW-031, SOW-127, SOW-129, SOW-130, SOW-132, SOW-133, SOW-134 | Prejoin, onboarding and employee conversion | L01 | LC-01, LC-02 |
| SOW-033, SOW-034, SOW-038, SOW-082 | Probation and confirmation | L02 | LC-04, PAY-02 |
| SOW-036, SOW-037, SOW-038, SOW-082 | Transfers and promotions | L03 | LC-05 |
| SOW-040, SOW-041, SOW-042, SOW-104, SOW-153, SOW-204, SOW-205, SOW-218, SOW-221, SOW-223, SOW-224 | Separation and clearances | L04 | LC-06, AST-04 |
| SOW-042, SOW-044, SOW-060, SOW-104, SOW-136, SOW-137, SOW-181, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-229, SOW-230 | F&F, exit letters and alumni | L05 | PAY-15, LC-07 |
| SOW-197, SOW-198, SOW-200, SOW-201, SOW-203, SOW-204, SOW-205 | Asset lifecycle and custody | W01 | AST-01..06 |
| SOW-078, SOW-181, SOW-182, SOW-208, SOW-209, SOW-211, SOW-213, SOW-214, SOW-216, SOW-217, SOW-218 | Helpdesk and SLA/escalation | W02 | HD-01 |
| SOW-003, SOW-016, SOW-017, SOW-018, SOW-023, SOW-044, SOW-054, SOW-190, SOW-191, SOW-193, SOW-194 | Engagement and policy acknowledgment | W03 | EN-01..03, CORE-13 |
| SOW-019, SOW-053, SOW-069, SOW-075, SOW-076, SOW-097, SOW-101, SOW-139, SOW-143, SOW-181, SOW-182, SOW-187, SOW-194, SOW-198, SOW-204, SOW-205, SOW-213, SOW-214, SOW-216, SOW-225 | Executive and BU analytics | W04 | RPT-03, RPT-04 |

---

## Stage 3.1 — Onboarding bridge + probation/confirmation (Cards L01, L02) — reopened; verified delivery pending
**Goal:** candidate intake from ATS to employee conversion without manual email handling; automated probation evaluation and confirmed salary switch.
**Depends on:** Gate G2 (confirmed salary switch relies on live payroll structures); Stage 0.5 (master data).
**Tasks:**
- [ ] LC-01 — ATS Integration & Pre-join Onboarding Intake (Card L01):
  - Ingestion of accepted candidates from ATS / LOI into `core.onboarding_candidates` with complete compensation details (CTC, probation duration, probation percentage, offered designation/department/entity).
  - Secure personal email pre-boarding invitation: tokenized URL with cryptographic hash at rest, strict expiration (72h), and delivery tracking (sent, delivered, opened, submitted).
  - Self-service pre-join portal: candidate enters personal profile, emergency contacts, statutory IDs (PAN, Aadhaar, UAN), bank account with proof attachment.
  - HR Conversion Wizard: duplicate check against existing employee master, e-code auto-generation per canonical series (`generate_next_ecode`), atomic creation of `core.employees`, `core.users`, and initial `pay.employee_salaries` record. *(LC-01, SOW-022..026)*
- [ ] LC-02 — Onboarding Task Fan-out & Stakeholder Orchestration:
  - Automated task generation upon conversion: IT (laptop provisioning, email account, access cards), Admin (seating, workstation), HR Ops (induction, file creation, biometric enrolment).
  - SLA tracking per task with auto-escalation to department head at +48h.
  - Biometric registration gate: automated verification of employee e-code registration on Kent biometric device. *(LC-02, SOW-032)*
- [ ] LC-04 — Probation Board & Confirmation Engine (Card L02):
  - Automated reminder schedule to Reporting Manager: triggered at due −30 days, −14 days, −7 days.
  - Multi-tier evaluation workflow: Manager evaluation form → Functional Head → HR Head.
  - Evaluation outcomes:
    1. **Confirm:** records `confirmation_date`, atomically generates confirmed-phase salary assignment in `pay.employee_salaries` (100% CTC), and enqueues automated confirmation letter generation.
    2. **Extend:** captures extension period (1 to 3 months) with mandatory justification; creates new review cycle.
    3. **Separate:** initiates non-confirmation exit process under Stage 3.2. *(LC-04, PAY-02, SOW-027..028)*
**Modules/files:**
- `backend/src/modules/lifecycle/onboarding/{onboarding.service,onboarding.router,prejoin.service}`
- `backend/src/modules/lifecycle/probation/{probation.service,probation.router,probation-reminder.job}`
- `frontend/src/pages/lifecycle/{OnboardingBoardPage.tsx,CandidateConvertModal.tsx,ProbationBoardPage.tsx}`
- `frontend/src/pages/public/PreJoinPortalPage.tsx`
**Tests required:**
- Pre-join token generation, single-use invalidation, and expiration rejection;
- End-to-end conversion: candidate payload → `core.employees` + `core.users` + salary row in single transaction;
- Probation confirmation atomically creates confirmed salary row with effective date and issues letter;
- Task escalation job fires when SLA breached on test clock.
**Exit criteria:**
- Test candidate completes pre-join form, converts to employee, and fan-out tasks trigger with zero manual steps;
- Confirmation approval advances salary phase and issues signed confirmation letter automatically.

---

## Stage 3.2 — Separation, clearances & Final Settlement (F&F) (Cards L04, L05) — reopened; verified delivery pending
**Goal:** the complete resignation and separation pipeline with verifiable notifications, multi-department clearance evidence, and exact F&F calculation.
**Depends on:** Gate G2 (F&F runs directly on the payroll engine).
**Tasks:**
- [ ] LC-06 — Resignation Workflow & Clearance Orchestration (Card L04):
  - ESS resignation application: employee inputs proposed Last Working Day (LWD) and reason.
  - Approval chain: Reporting Manager → Department Head → HR Head, with mandatory `notified_at` receipts at every step.
  - Notice period calculator: compares contract notice requirement vs proposed LWD, calculates shortfall days.
  - HR-initiated termination / absconding path: triggered directly from absenteeism case (Stage 1.6 / ATT-10).
  - Clearances Fan-out Matrix across 4 departments:
    1. **IT Clearance:** hardware returned, email account suspended, software licenses revoked.
    2. **Admin Clearance:** company ID card returned, vehicle pass surrendered, locker/drawer keys handed over, company accommodation cleared.
    3. **Finance Clearance:** outstanding loans reconciled (`pay.loans`), travel advances cleared (`te.wallets`), pending expense claims settled.
    4. **HR Clearance:** statutory exit interview completed, documents signed off.
  - Clearance item blocking rule (fixing C18): unreturned or damaged assets create an unresolved clearance flag with approved recovery amount; cannot be bypassed without Finance approval. *(LC-06, AST-04, SOW-221..225)*
- [ ] PAY-15 — Final Settlement (F&F) Engine (Card L05):
  - Calculation sequence executed directly on payroll engine:
    1. **Days Payable:** earnings computed through approved LWD from locked attendance.
    2. **Leave Encashment:** earned leave balance from `lv.ledger` encashed: `(Basic + DA) / 30 × EL_balance` (subject to encashment policy caps).
    3. **Notice Shortfall Recovery:** `(Basic / 30) × shortfall_days` deducted from payable dues.
    4. **Gratuity Calculation:** for service tenure ≥ 4 years 240 days (or 5 years per policy): `(15 × (Basic + DA) × Completed_Years) / 26` (tenure fraction ≥ 6 months rounded up to full year; capped at statutory maximum ₹20,00,000). *(Golden Fixture G8: 8y 7m → ₹1,67,639)*
    5. **Deductions & Recoveries:** outstanding loan balances, unreturned asset recovery values, pending travel advance debit balances.
    6. **Salary Holds Release:** release of previously held net salary liabilities.
    7. **Final Tax Assessment:** comprehensive TDS calculation with final annual taxable projection.
  - Compliance timing mandate: Code on Wages §17(2) 2-working-day payment mandate for discharge/dismissal/resignation tracked against SOW 3-working-day internal turnaround SLA.
  - Relief & Experience Documentation: relieving letter and service certificate generation gated strictly on settlement status `paid`. *(PAY-15, Golden G8, SOW-226..229)*
- [ ] LC-07 — Exit Day Cascade & Alumni Portal:
  - Exit Day Automated Trigger: employee status set to `exited`, Date of Leaving (`dol`) committed, removed from active rosters, removed from active approval chains.
  - Alumni Portal Access: credentials switch to restricted alumni mode allowing read-only access to historic payslips, annual Form 16, and issued relieving/experience letters; all operational endpoints blocked. *(LC-07)*
**Modules/files:**
- `backend/src/modules/lifecycle/separation/{separation.service,separation.router,clearance.service}`
- `backend/src/modules/payroll-core/fnf/{fnf-engine.ts,gratuity-calculator.ts,fnf.router}`
- `frontend/src/pages/lifecycle/{ResignationPage.tsx,ClearanceQueuePage.tsx,FnfConsolePage.tsx}`
- `frontend/src/pages/ess/{AlumniPortalPage.tsx,MyResignationPage.tsx}`
**Tests required:**
- Golden G8 fixture test: exact gratuity computation (Basic ₹32,286, 8y 7m tenure → ₹1,67,639);
- Clearance blocking test: unreturned asset prevents Admin clearance sign-off;
- Notice period shortfall recovery arithmetic test;
- Security isolation test: exited employee in alumni mode receives 403 on all active HRMS endpoints.
**Exit criteria:**
- Synthetic resignation walks application → approvals → clearances → F&F computation → payment with 100% delivery receipts;
- F&F statement matches hand-computed Golden G8 values to the exact rupee;
- Exited employee immediately excluded from active headcounts and rosters.

---

## Stage 3.3 — Transfers, promotions & assets management (Cards L03, W01) — reopened; verified delivery pending
**Goal:** employee internal mobility with complete historical continuity, and asset lifecycle tracking with exit-clearance integration.
**Depends on:** Stage 3.2.
**Tasks:**
- [x] LC-05 — Employee Movement & Transfers (Card L03):
  - Transfer workflow supporting 4 distinct types:
    1. **Department / Unit Transfer:** changes department/reporting hierarchy within same entity.
    2. **Location / Plant Transfer:** changes plant location, shift scheme, and holiday calendar.
    3. **Inter-Entity Transfer (Company Movement):** moves employee between legal entities (e.g., RML → RPL). Automatically handles:
       - Allocation of new entity-specific e-code from target series;
       - Transfer of leave balances or terminal encashment per policy;
       - Closing of previous entity payroll record and initiation of target entity payroll assignment with YTD continuity.
    4. **Promotion / Designation Change:** updates grade rank, designation, and triggers salary revision.
  - History tracking: effective-dated entries in `core.employee_history`; historical queries reconstruct organization state as-of any past date. *(LC-05, SOW-029..031, SOW-033..035)*
- [x] W01 — Complete Asset Custody & Maintenance (Card W01):
  - Schema `ast`: assets register, asset assignments, maintenance & incident log.
  - Search engine: instant lookup across asset number, serial number, model, category, holder name, holder e-code.
  - Allocation rules: strictly enforces one active custodian per asset; supports past warranty dates (AST-02).
  - Return inspection workflow: condition recorded as `ok`, `damaged`, or `not_returned`.
  - Damaged / Not-Returned Routing (fixing C18):
    - `damaged`: routes asset to maintenance pool with repair cost tracking; prevents re-allocation until repaired.
    - `not_returned` / `lost`: flags employee custody record, blocks exit clearance, and triggers recovery cost assessment.
  - Integration with separation: `GET /assets/held-by/{employeeId}` auto-populates Admin exit clearance; non-returned asset tile (AST-05) lists unrecovered hardware with leaver DOL. *(AST-01..06, SOW-198..204)*
**Modules/files:**
- `backend/src/modules/lifecycle/transfers/{transfer.service,transfer.router,entity-transfer.service}`
- `backend/src/modules/assets/{assets.service,assets.router,maintenance.service}`
- `frontend/src/pages/lifecycle/TransfersPage.tsx`
- `frontend/src/pages/workplace/AssetsPage.tsx`
**Tests required:**
- Inter-entity transfer generates new e-code from target company series and preserves employment continuity;
- Asset allocation concurrency test: asset cannot be assigned to two employees simultaneously;
- Lost asset transitions to unallocatable and creates clearance blocking flag;
- Historical employee assignment query returns accurate past department/manager on historical date.
**Exit criteria:**
- Inter-entity transfer successfully transitions employee to new legal entity without breaking YTD payroll continuity;
- Unreturned asset physically blocks separation clearance until approved financial disposition.

---

## Stage 3.4 — Helpdesk & workplace engagement (Cards W02, W03) — reopened; verified delivery pending
**Goal:** employee service request ticketing with strict SLA auto-escalation, and company-wide communication with targeted audience delivery.
**Depends on:** Phase 1 workflow engine; Stage 0.4 notifications.
**Tasks:**
- [ ] HD-01 — Employee Helpdesk System (Card W02):
  - Schema `hd`: ticket master, append-only messages (`hd.ticket_messages`), SLA events, category configuration.
  - Category routing & SLA configuration: tickets automatically route to designated functional role (IT Support, HR Ops, Payroll, Admin, Plant Facilities).
  - SLA clock: calculates target resolution time based on working calendar and priority (P1 Critical, P2 High, P3 Medium, P4 Low).
  - Auto-Escalation Engine (fixing C27): hourly escalation sweep detects approaching/breached SLAs and escalates ticket to configured higher management hierarchy rather than alerting existing assignee.
  - Security Scoping (fixing C26): strict RBAC and subject isolation—employees can only access tickets they created; support agents only access tickets within assigned category.
  - Append-only message log: internal notes visible only to support agents; employee communication visible on ticket timeline.
  - Monthly SLA Performance Report (R29): metrics covering total tickets, resolution rate, first-response time, SLA breach count. *(HD-01, SOW-191..194)*
- [ ] EN-01/02/03 — Workplace Engagement & Communication (Card W03):
  - Company Announcements (EN-01): published with targeted audience filtering by legal entity, plant location, department, or grade; attachments stored via StorageAdapter; announcement retraction flag.
  - Pulse Polls & Surveys (EN-02): single-question pulse checks and multi-question surveys (C34).
  - Anonymity Firewall: anonymous poll responses use salted HMAC respondent hashing (`respondent_hash = HMAC(userId, salt, pollId)`) to prevent duplicate ballot stuffing while rendering respondent identity mathematically unreconstructable.
  - Policy Library & Mandatory Acknowledgment (EN-04, CORE-13): versioned policy documents with targeted employee audience; automated delivery of mandatory acknowledgment tasks; compliance tracking report (R30) with automated reminders to laggards. *(EN-01..04, SOW-208..217)*
**Modules/files:**
- `backend/src/modules/helpdesk/{helpdesk.service,helpdesk.router,escalation.job}`
- `backend/src/modules/engagement/{announcements.service,polls.service,surveys.service,engagement.router}`
- `backend/src/modules/policies/{policy.service,policy.router}`
- `frontend/src/pages/workplace/{HelpdeskPage.tsx,EngagementPage.tsx}`
**Tests required:**
- Ticket authorization isolation: Employee A attempting to view Employee B's ticket returns 403;
- Escalation sweep detects overdue ticket and reassigns/notifies department head;
- Anonymous poll ballot-stuffing test: same employee cannot vote twice, but vote payload contains zero identifying references;
- Policy acknowledgment tracking: non-compliant employees accurately listed in laggard report.
**Exit criteria:**
- Helpdesk ticket breaches SLA on test clock and escalates per matrix with full audit trail;
- Anonymous survey accepts responses with proven identity redaction in database.

---

## Stage 3.5 — Executive analytics & business unit dashboards (Card W04) — reopened; verified delivery pending
**Goal:** real-time operational and strategic KPI dashboards for the CEO and Plant Heads, backed by precomputed snapshots and strict permission scoping.
**Depends on:** Stages 3.1–3.4 (headcount, tenure, attrition, and cost data).
**Tasks:**
- [ ] RPT-03 — CEO Strategic KPI Dashboard (Card W04):
  - Dedicated precomputation worker: nightly snapshot generator (`reporting.kpi_daily`) computes heavy aggregations off peak hours.
  - Real-time read optimization: `/api/reports/executive` reads exclusively from precomputed snapshot tables; zero live full-table scans.
  - Core CEO Metrics (matching executive PPT specifications):
    1. Total Manpower Count (by category: On-roll, Staff, Works, Contract/Apprentice);
    2. Workforce Demographics: average age, average tenure, gender diversity ratio;
    3. Leadership Density: percentage of headcount in leadership grades;
    4. Operational Attendance: plant-wise absenteeism rate, aggregate overtime hours;
    5. Attrition Dynamics: annualized voluntary/involuntary attrition rate, new-hire attrition cohorts (at 30, 90, 180, 365 days);
    6. Productivity & Cost Indicators: total monthly gross salary cost, overtime spend per metric ton of production.
  - Data integrity: uncomputable metrics render as `unavailable` with explicit explanatory tooltip, never defaulted to 0. *(RPT-03, docs 06 §4, SOW-036..046)*
- [ ] RPT-04 — Business Unit & Plant-Head Dashboards:
  - Scoped operational view for Plant General Managers and Department Heads.
  - Scope Security Fix (fixing C01): enforce caller's authorized plant location and OU boundaries in `dashboard.service.ts`; reject arbitrary client-supplied organization filters.
  - Local operational metrics: daily plant presence %, active overtime hours, shift schedule compliance, pending approval queue depth. *(RPT-04)*
- [ ] Comprehensive Reports Catalog Completion (Reports R21–R31):
  - Delivery of remaining master reports: R21 (Offers & Candidates), R23 (Internal Movements & Transfers), R24 (Daily Joining & Exits), R25 (Probation Due & Confirmation), R26 (Attrition Analysis), R28 (Asset Custody Register), R29 (Helpdesk SLA Analytics), R30 (Policy Compliance Matrix), R31 (Claims & Reimbursement Utilization). *(docs 06)*
**Modules/files:**
- `backend/src/modules/reports/{dashboard.service,kpi-snapshot.service,executive-kpi.job,reports.router}`
- `frontend/src/pages/executive/{ExecutiveDashboardPage.tsx,BusinessUnitDashboardPage.tsx}`
- `frontend/src/pages/reports/{ReportsCatalogPage.tsx,ReportViewerPage.tsx}`
**Tests required:**
- Executive KPI snapshot generation idempotence;
- Plant Head access test: Plant Head for Kharagpur cannot view Durgapur plant data;
- Metric drill-down test: clicking attrition KPI tile loads exact underlying employee leaver list;
- Performance benchmark: executive dashboard first paint < 1.5 seconds under 10k synthetic employees.
**Exit criteria:**
- CEO dashboard displays all required executive KPIs computed from frozen snapshots;
- BU dashboard securely confines metrics to user's assigned plant scope;
- All catalog reports (R21–R31) export to Excel with exact column parity vs docs/06.

---

## Deep Code Audit & Integrity Repairs (Mapped to Phase 3)

- **C01 — RBAC Data Scope Enforcement:** ensure all lifecycle, asset, helpdesk, and dashboard queries filter strictly by caller's entity/location/OU grants.
- **C16 — Outbox Delivery Assurance:** guarantee transactional enqueue and delivery receipts for all onboarding, resignation, and clearance notifications.
- **C18 — Asset Return Disposition Integrity:** ensure damaged/lost/unreturned assets remain tracked in active custody with financial recovery links, rather than reverting to available stock.
- **C20 — Document Generation Security:** letter generation must use authoritative, sanitized merge fields with storage adapter integration; direct edits to issued letters blocked.
- **C26 — Helpdesk Authorization Scoping:** ticket endpoints must enforce subject and category assignment scoping to prevent unauthorized ticket inspection.
- **C27 — Helpdesk Escalation Routing:** correct escalation sweep to alert designated management hierarchy upon SLA breach.
- **C30 — Business Router Registrations:** register all lifecycle, separation, F&F, and report procedures in `api/router.ts`.
- **C31 — Master Governance & Facets:** align employee status filters so exited employees remain accessible in historical audit reports while excluded from active operational queues.
- **C34 — Multi-Question Survey Capability:** expand engagement schema to support structured multi-question surveys with anonymous response isolation.

---

## Gate G3 — Phase 3 Sign-off Criteria

Reopened on 14 Oct 2026 after source and database review. Earlier checked labels lacked linked acceptance receipts and contradicted open operational defects. See [the current SOW issue map](../outputs/remediation-2026-10-14/SOW-ISSUES-AND-REMAINING.md); code presence does not prove payment, notification delivery, legal verification or human acceptance.

- [ ] Real employee resignation processed end-to-end: approvals recorded with `notified_at` receipts, clearances completed across IT/Admin/Finance/HR, and F&F settlement disbursed;
- [ ] Relieving letter and service certificate issued automatically via system upon settlement payment;
- [ ] Asset clearance integration proven: unreturned hardware successfully blocked clearance until resolved;
- [ ] Executive CEO Dashboard reviewed and formally accepted by CEO Cell;
- [ ] Labour Codes compliance verified: F&F settlement turnaround and wage ratios verified;
- [ ] Full UAT sign-offs secured from HR Operations, Admin Department, and CEO Cell.
