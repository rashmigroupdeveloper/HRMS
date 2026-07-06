# 01 — Product Requirements Document (PRD)

Every requirement below is traced to a source document in `Documention/`. Requirement IDs are stable — code, tests, and commits should reference them (e.g., `feat: ATT-07 future-dated OD applications`).

**Source key:**
- `PP-n` = Pain Point of RML's HR (02 Jul 2025 xlsx), row n
- `PI-ESS-n` / `PI-PAY-n` = Pending Implementation (28 Aug xlsx), ESS / Payroll sheet row n
- `SOW-x.y` = Protiviti SOW Tracker section
- `AR-n` = Additional Requirement xlsx row n
- `RT` = "Reports – Templates" docx
- `LOI` = LOI_Approval_Process_Flowchart docx
- `CEO` = HR Dashboard pptx
- `ATS-SOW` = SOW_ATS_FINAL docx
- `KQ` = Kinjal Ma'am queries (Latest Update in Protiviti xlsx)

---

## 1. Users & personas

| Persona | Who (real examples from docs) | Primary needs |
|---|---|---|
| **Employee (ESS)** | Any of ~2,000+ on-roll staff (RML/RGH/EIPL/RPF e-codes) | View attendance/payslips, apply leave/AR/OD/comp-off/loan, resign, acknowledge policies |
| **Reporting Manager** | e.g., Amit Kumar Singh, Debajit Roy | Approve leave/AR/OD/OT within SLA, manage team roster/shifts, download team muster, see team absentees |
| **HR Ops** | Rachna, Sushanta Nayak, Sweta Nayak, Subhasis Panda (payroll) | Employee master upkeep, attendance finalization, leave administration, letters, reports, F&F |
| **HR Head / DGM** | Chaitanya Paila | Approvals (confirmation, resignation, offers), HR dashboard, compliance oversight |
| **Plant Head / Business Head** | Sapikul Ali's stakeholders | Daily boarding/exit email, plant muster with cost center, absentee action queue |
| **CEO Cell / Management** | Sandeep Sharma (AGM-HR CEO Cell), CEO | CEO dashboard KPIs, offer approvals, onboarding/exit notifications |
| **Recruiter (ATS)** | Existing ATS users | Unchanged in Phase 1; SSO + joined-candidate → onboarding handoff in later phases |
| **System Admin / IT** | ERP team (Sharique, Ayush) | User/role management, device health, integration monitoring, audit |

## 2. Module map

```
Platform
├── M1  Core HR (employee master, org structure, letters)
├── M2  Attendance (biometric ingestion, shifts, processing, AR/OD, OT)
├── M3  Leave (types, accrual, applications, comp-off, encashment)
├── M4  Payroll & Statutory (salary structures, runs, PF/ESIC/PT/LWF/TDS, F&F)
├── M5  Lifecycle (onboarding, probation/confirmation, transfers, separation)
├── M6  Workflows & Notifications (approval engine, escalations, alerts)
├── M7  Reports & Dashboards (muster, registers, CEO/HR/BU dashboards)
├── M8  Assets (allocation, returns, exit clearance)
├── M9  Helpdesk (tickets, SLA, escalation matrix)
├── M10 Engagement (announcements, polls, surveys, policy acknowledgment)
├── M11 Loans & Advances (schedulers, perquisites, payroll integration)
├── M12 Claims & Reimbursements (expense claims, approval, payout via payroll)
└── M13 Travel & Expense Management (trips, budgets, travel advances, wallet/settlement, booking) — absorbs & supersedes Yatra Avedan
```

Phasing (detail in 07-ROADMAP): Phase 1 = M1+M2+M3+M6+M7(core reports); Phase 2 = M4+M11; Phase 3 = M5+M8+M9+M10; Phase 4 = ATS absorption + contract workers.

---

## 3. M1 Core HR — requirements

- **CORE-01** Single employee master: personal, employment, statutory, financial details in one record. *(SOW-2.1a)*
- **CORE-02** E-code generation per entity series (RML…, RGH…, EIPL…, RPF…) — system-generated, sequence-enforced, duplicates impossible. *(Agreement tracker 3.2 remark: "Incorrect employee codes generated, not adhering to predefined series"; SOW-5.2: duplicate e-code checks)*
- **CORE-03** Both **Reporting Manager** and **Functional Reporting Manager** on every employee; both appear in master report and muster exports. *(RT: "Functional Reporting Manager… not yet updated"; PP-15)*
- **CORE-04** Cost center (plant code, e.g., 1701) on every employee; manpower cost queryable by cost center. *(PP-8)*
- **CORE-05** Employment category enum: `white_collar | blue_collar | trainee | consultant | contract(reserved)` — drives CEO dashboard splits and payroll rules (apprentices: no statutory deductions per SOW-5.8). *(CEO; SOW-5.8)*
- **CORE-06** Status lifecycle `onboarding → active → on_notice → exited (inactive)`; exited employees **never** appear in active lists, payroll variable-input lists, or reports unless explicitly filtered. Date-of-leaving mandatory at exit. *(PP-17; Agreement 5.2.12: "Inactive employees still appearing in active list")*
- **CORE-07** Statutory identifiers on master: PAN, Aadhaar, UAN, PF number, ESIC IP number, bank account + IFSC — all validated (format + checksum where applicable) and **printed on payslip**. *(PP-3, PP-4; SOW-5.2 validations 1–12)*
- **CORE-08** Field-level validation at entry mirroring SOW-5.2: DOB → minor check, bank account length, IFSC format, PAN format, Aadhaar format, duplicate ESI/UAN/e-code, special characters stripped from designation/department, CTC-vs-breakup match.
- **CORE-09** Letter generation from templates with merge fields + workflow: appointment, confirmation, experience, relieving, salary certificate, show-cause/warning. Issued letters archived on the employee record and visible in ESS. *(SOW-3.6; PP-14)*
- **CORE-10** Role-based access control: module × action permissions; leadership read-only dashboards; managers scoped to their reporting tree (incl. multi-level: "employees working under managers whose RM is Kinjal Ma'am" *(KQ)*); Protiviti-style access-control matrix exportable. *(SOW-2.1b; PI-ESS-2)*
- **CORE-11** Full audit log: who changed which field of which record, when, old → new value. Compensation and statutory fields flagged as sensitive (restricted visibility).
- **CORE-12** Bulk import (Excel) for initial migration from greytHR/Adrenalin exports, with per-row validation report. *(SOW-1.3 data transfer precedent)*
- **CORE-13** Policy repository: publish policy docs, track per-employee acknowledgment in real time, auto-alert non-acknowledgers; HR dashboard tile. *(SOW-2.3; PI-ESS-5)*
- **CORE-14** In-app contextual help: role-based quick guides (ESS, manager, HR admin screens), empty states that teach, and printable/short training material per module — the greytHR rollout needed 11 training sessions and HR still asked for "ESS Admin Access Training"; reduce that dependency by design. *(PP-v2-7; DESIGN_RESEARCH §4 adoption evidence)*

## 4. M2 Attendance — requirements

- **ATT-01** Automated ingestion of swipes from Kent/Astra access-control cloud/DB on a schedule (≤ 5 min lag), storing **raw immutable swipe events** exactly as received (fields per EmployeeSwipeDetails.xlsx: employee no, access card, shift, swipe datetime, door/address, swipe type, received-on). *(SOW-4.2a/b; PP-9 root cause)*
- **ATT-02** Ingestion resilience: per-device watermark, gap detection, retry/backfill, and **device-offline alerting to IT** — the greytHR failure mode ("Kent machines go offline… attendance captured late") must be detected, not discovered at month-end. *(PP-9)*
- **ATT-03** Attendance recomputation: processed day-status derives from raw swipes + shift + approved requests, and can be recomputed idempotently for any date range until the month is locked.
- **ATT-04** Shift management: fixed/rotational/flexible/night shift definitions; roster maintained **by reporting managers** (greytHR blocked this — Agreement 4.1b) with monthly roster deadline (5th) reminders. *(SOW-4.1)*
- **ATT-05** Day statuses: Present, Absent, Half-day, Week-off, Holiday, Leave (by type), OD, Comp-off, UAB (unauthorized absence). Late-coming and early-leaving minutes computed per policy grace. **Two-session days**: RML shifts split into Session 1 / Session 2 (live: G5 09:00–13:30 / 13:31–18:00), so a day can hold a dual status (e.g. Absent-first-half / Present-second-half); day model is session-aware, not one-status-per-day. **Saturday runs a different scheme** (live "GCS" alternate-Saturday) — schemes are weekday-vs-Saturday distinct per employee. A configurable **Penalty Days** policy exists (live metric). *(SOW-4.2c, 4.5a; live recon 09-RECON §4)*
- **ATT-06** Attendance Regularization (AR) with multi-level approval and **Excel-exportable AR report**; plus **Permission** — short-duration time-bounded attendance exception (e.g. 2-hour personal permission), distinct from full-day AR (confirmed as "Regularization & Permission" in live greytHR, 09-RECON §5). *(PP-16; KQ; live recon)*
- **ATT-07** On-Duty (OD): **future-dated applications allowed**, remote/site employees supported (the "on site, can't punch out" case → OD or comp-off path), OD report exportable. *(KQ; Agreement 4.2a remark)*
- **ATT-08** Overtime: pre-approved-policy based. OT auto-detected from swipes beyond shift; daily OT summary to reporting manager; manager approves/rejects **within 48 hours or OT lapses** (configurable); approved OT flows to payroll at configured rates; comp-off offered as alternative where policy says (week-off work → OT **or** comp-off, one only). *(PP-19; PI-ESS-13; Protiviti Status doc; Agreement 5.1.6)*
- **ATT-09** Week-off eligibility rule: an employee absent (UAB) the entire week earns **no paid week-off**; absent the entire month earns no paid week-offs at all. Configurable "must work ≥ 1 day in week" criterion. *(PI-PAY-1, PI-PAY-2; RT)*
- **ATT-10** Absenteeism engine: continuous-absence tracker; at 7 days (configurable) auto-generate show-cause/warning/feedback email through HR with letter template and case record. *(PP-7)*
- **ATT-11** Auto-alerts: absenteeism, late arrival, early departure — to employee, up the hierarchy, and HR as configured. UAB alerts "across the hierarchy & HR". *(PI-ESS-12, PI-ESS-14; SOW-4.2d)*
- **ATT-12** Attendance approval by manager precedes monthly leave-credit and payroll locks (greytHR leave credits failed because attendance approval was missing — make the dependency explicit and visible). *(PP-1)*
- **ATT-13** Holiday calendars by location/plant. *(SOW-4.3b)*
- **ATT-14** Sales/field employee attendance: mobile/geo check-in (PWA) with GPS coordinates — schema supports longitude/latitude/location-type per swipe (columns already exist in Kent export). *(PP-21)*
- **ATT-15** Month-end attendance lock per entity+month; post-lock changes only via HR with audit trail; locked data feeds payroll.
- **ATT-16** Cross-plant swipes are valid attendance: employees may punch at any door (fitting plant, DIP-6, corporate, Seamless) while their cost center stays as mapped; reports always show the *mapped* cost center, and a reconciliation flag highlights employees habitually swiping at a different plant than their mapping. *(PP-v2-15: temp-copy pain point sheet)*
- **ATT-17** Attendance modification lockdown: reporting managers can **never** directly edit day statuses (no "mark present" override) — they only approve employee-initiated AR/OD/OT. Direct manual override is restricted to HR ops with reason + audit trail. *(PP-v2-18: "We do not want anybody to have access to modify the attendance" — Sapikul Ali)*
- **ATT-18** First-In / Last-Out is the attendance basis for multi-swipe days (explicit RML ask on the Kent integration). *(PP-v2-2)*

## 5. M3 Leave — requirements

- **LV-01** Leave types (confirmed from live greytHR — see 09-GREYTHR-RECON §1): **Casual Leave, Sick Leave, Earned Leave** (credited after 1 year; encashable), **Compensatory Off** (fractional/half-day), **Election Leave** (India statutory paid voting leave), **Loss Of Pay** (unpaid → LOP), plus **Maternity** (gender-conditional, not in this employee's scheme but in catalog). CL/SL/EL are monthly-accrual (fractional balances confirm it). Configurable accrual, carry-forward, encashment rules. *(SOW-4.3a/e; live recon)*
- **LV-02** Monthly leave credit runs automatically on the 1st (00:05), *without* human trigger; blocked employees (unapproved attendance) get queued + flagged rather than silently skipped. *(PP-1)*
- **LV-03** Leave applications with multi-level approval, balance check, half-day support, holiday/week-off sandwich rules configurable.
- **LV-04** Comp-off: earn from approved work on week-off/holiday (auto-suggested from swipes), expiry window, apply like leave. Must actually work — greytHR's broken comp-off application (Rishab Sahoo case) is the anti-example. *(PP-18; Agreement 4.3a)*
- **LV-05** Immutable leave ledger (credit/debit/lapse/encash transactions) — balances are always the sum of ledger entries, never a mutable counter.
- **LV-06** Leave encashment in F&F and annual cycles per policy, **plus employee-initiated encashment request** with its own approval workflow (confirmed live as a distinct workflow, 09-RECON §10.2). *(SOW-4.3e, 10.1)*
- **LV-07** Leave dashboard + muster integration (leave columns in muster summary per the shared template).
- **LV-08** Leave cancellation is an **approval workflow** (cancelling an approved leave routes for re-approval and reverses the ledger debit) — not a silent delete. *(live: "Leave Cancel" workflow, 09-RECON §10.2)*
- **LV-09** **Restricted Holiday (RH)**: publish a list of optional/floating holidays; employees select up to N per year; selection routes for approval and, once approved, marks the day as holiday. India-standard concept. *(live: "Restricted Holiday" workflow — new)*

## 6. M4 Payroll & Statutory — requirements

- **PAY-01** Salary structures with formula-based components (earnings/deductions), grade/level/location-wise templates, CTC breakup auto-structuring. *(SOW-2.2, 3.2b)*
- **PAY-02** Probation salary automation: LOI captures probation % (70/80/90); system auto-applies probation breakup and **auto-switches to confirmation breakup on confirmation date** — no manual restructuring. *(PI-ESS-1; LOI)*
- **PAY-03** Monthly run pipeline: inputs (locked attendance, LOP, OT, new joiners, revisions, variable pay, loans, advances, holds) → draft register → review/approval → final register → outputs. Every step logged; run lockable and re-runnable pre-lock. *(SOW-5.1)*
- **PAY-04** Proration: mid-month join/leave; LOP and LOP-reversal (incl. previous-month LOP); calendar-days / fixed-days bases. *(SOW-5.4)*
- **PAY-05** Outputs per run: final pay register, **bank transfer file** (per RML bank format), JV report (SAP-consumable), payslips + tax computation sheet to ESS, variance report vs previous month, CTC/cost-center/department/location reports. *(SOW-5.1.4/5)*
- **PAY-06** Payslip in the RML format: fixed template incl. UAN, PAN, PF no, ESIC no, leave balances — consistent every month (greytHR shipped 3 different templates in 3 months). *(PP-3, PP-4; PI-PAY-10)*
- **PAY-07** New-joiner salary availability: LOI-accepted candidates carry salary breakup into the employee record on DOJ — payroll never misses a new joiner. *(PP-12)*
- **PAY-08** Salary hold & release (payment-hold and process-hold/absconder scenarios exactly as SOW-5.7).
- **PAY-09** PF: 12% EE / 12% ER split (EPS 8.33% capped ₹15k, EPF remainder), EDLI + admin charges, ECR text file for EPFO portal upload, UAN capture/validation. *(SOW-5.10)*
- **PAY-10** ESIC: 0.75% EE / 3.25% ER for gross ≤ ₹21,000, contribution-period rules, return/challan data export, IP number + family details capture. *(SOW-5.10 ESIC)*
- **PAY-11** PT: West Bengal slab (and per-state table for other locations), monthly deduction + register. *(SOW-5.10 PT)*
- **PAY-12** LWF: WB rates + periodicity, register export. *(SOW-5.11)*
- **PAY-13** Income tax: old + new regime, employee regime election, investment declarations on ESS with proof upload + HR verification window, monthly TDS projection, Form 24Q quarterly data export, Form 16 annual generation, challan reconciliation record. *(SOW-5.9, 3.2d; PI-ESS-15)*
- **PAY-14** Trainee/apprentice payroll: stipend processing; apprentices excluded from statutory deductions per Apprenticeship Act. *(SOW-5.8)*
- **PAY-15** F&F: separation-triggered settlement — days payable, leave encashment, notice recovery, gratuity (Payment of Gratuity Act formula), salary-hold release, other dues/deductions; 3-working-day TAT target; 2 cycles/month; relieving + experience letters gated on clearance completion. *(SOW-10; PP-14)*
- **PAY-16** Arrears: salary-revision arrears computed from effective date, component-wise. *(SOW-5.2.1, 5.4)*
- **PAY-17** Annual: bonus (Payment of Bonus Act 8.33%–20% band, ₹21k eligibility), increment processing with effective dates. *(SOW-5.14)*
- **PAY-18** Payroll lock/audit: finalized months immutable; recompute requires unlock with reason + audit trail; parallel-run comparison report vs Protiviti register during transition.

## 7. M5 Lifecycle — requirements

- **LC-01** Onboarding from ATS: LOI-accepted candidate record (all fields per LOI doc §1–4) converts to a pre-boarding employee; personal-email link for candidate to complete data + upload documents (greytHR's broken pre-joining-link flow, done right — with link-delivery tracking). *(SOW-3.2a; ATS-SOW XIV)*
- **LC-02** Onboarding task checklist auto-assigned to stakeholders on DOJ: IT (e-code activation, biometric registration, email), Admin (assets), HR (induction) — with due dates, reminders, and escalation; no manual follow-up emails. *(Agreement 3.2 remark; Latest-Update "Onboarding alerts to stakeholders")*
- **LC-03** Daily boarding & exit report: every day at a configured time, email to Plant Head + HR + Business Head + CEO Cell listing joins and exits of the previous day, per plant. Runs without exception. *(PP-6; PP-26)*
- **LC-04** Probation: end-date tracking, auto-reminders to manager ahead of due date, review form, multi-level confirmation workflow, confirmation letter + salary switch (PAY-02). *(SOW-3.3; PI-ESS-8/10)*
- **LC-05** Transfers: department/location/cost-center/entity transfer workflows with approvals, documentation updates, payroll continuity (entity transfer per SOW-5.3). *(SOW-3.4)*
- **LC-06** Separation: resignation initiation in ESS → multi-level approval chain where **every configured approver (e.g., HR Head) is actually notified and must act** → notice-period computation → department clearances (IT/Admin/Finance/HR, incl. asset return) → F&F → relieving/experience letters issued **through the system**. Resignation status visible to employee, RM, HR at all levels. *(PP-14; RT F&F workflow; SOW-3.5)*
- **LC-07** Exit sets status/DOL exactly once, cascading: removed from active lists, ESS restricted to alumni view (payslips/Form 16 download), assets flagged if unreturned. *(PP-17; AR-4)*

## 8. M6–M11 — requirements

**M6 Workflows & Notifications**
- **WF-01** Generic approval engine: named chains (sequence of role/person steps) attachable to any request type; per-step SLA; escalation on breach; delegation for absence. Actions per step: **approve / reject / send_back** (return-for-edit, from the live Yatra Avedan model — richer than a binary approve/reject). Covers: leave, leave-cancel, leave-encashment, AR/permission, OD, OT, comp-off, restricted-holiday, resignation, confirmation, transfer, loan, claim, travel/advance, letter-signature, offer/LOI. *(multiple sources; LOI flowchart + live greytHR Review + Yatra Avedan approvals[] are the references)*
- **WF-02** Notification service: in-app + email (SMTP), templated, queued with retry; per-event recipient matrix configurable (e.g., onboarding/exit → HR + Business Head + CEO Cell). *(PP-26)*
- **WF-03** Escalation matrix with time-based auto-escalation (helpdesk + approvals). *(SOW-9.2)*
- **WF-04** Every workflow state change timestamped and visible as a timeline on the request (the ATS already does this for offers — same pattern).

**M7 Reports & Dashboards** — full catalog in 06-REPORTS-AND-DASHBOARDS. Headliners:
- **RPT-01** Attendance Muster Summary (the June 2025 template) **plus** Reporting Manager, Emp ID, and Cost Center/Plant columns. *(PP-5, PP-8, PP-9, PP-25)*
- **RPT-02** Offer report: candidate, org unit, designation, DOJ, offer date, offered salary, probation %, LOI status (Accepted/Rejected/Yet to Accept). *(PP-24)*
- **RPT-03** CEO Dashboard: all KPIs from HR Dashboard pptx incl. new-hire attrition at 3/6/12 months. *(CEO; PP-2)*
- **RPT-04** HR / Business-Unit dashboards (formats already shared with Protiviti). *(RT)*
- **RPT-05** Recruitment & hiring, promotion & internal movement reports. *(Latest-Update sheet)*
- **RPT-06** Every tabular report exportable to Excel with the on-screen filters applied.

**M8 Assets**
- **AST-01** Asset registry with search (by asset number, type, holder). *(AR-1; Task-Matrix "asset number filter")*
- **AST-02** Warranty date accepts past dates. *(AR-2)*
- **AST-03** Allocation to employees **and third-party/contract persons** (dropdown). *(AR-3)*
- **AST-04** Resigned-employee asset view + return workflow in exit clearance. *(AR-4)*
- **AST-05** Non-returned assets dashboard tile. *(AR-5)*
- **AST-06** Maintenance scheduling, incident/damage reporting, lost-asset handling. *(SOW-8)*

**M9 Helpdesk**
- **HD-01** Categorized tickets, auto-acknowledgment + assignment, SLA-based escalation matrix, open/pending/resolved tracking, monthly performance report, query logs for audit. *(SOW-9)*

**M10 Engagement**
- **EN-01** Announcements/news broadcast; **EN-02** opinion polls; **EN-03** structured pulse surveys with response analytics; **EN-04** policy acknowledgment tracking (see CORE-13). *(SOW-7)*

**M11 Loans & Advances**
- **LN-01** Loan types with schedulers: diminishing, flat, EMI-without-interest; eligibility rules (e.g., multiple of Basic); perquisite valuation per SBI lending rate for tax. *(SOW-5.5)*
- **LN-02** ESS application + approval workflow, **restricted by eligibility policy — not open to all employees**. *(PI-ESS-7)*
- **LN-03** EMI auto-deduction in payroll; salary-advance monthly deduction inputs; balance visible in ESS; legacy SAP loan balances importable. *(SOW-5.5; PP-11)*
- **LN-04** Travel advance requests with configurable approval flow (domestic; global adds final approver e.g., CHRO). *(PP-1 Travel Advance; Latest-Update)*

**M12 Claims & Reimbursements** *(SOW-6 "Salary related reimbursement processing"; SOW-3.2c flexi-basket reimbursements; SOW-5.13 ESS reimbursement claims)*
- **CLM-01** Claim types configurable (medical, conveyance/fuel, telephone, LTA, relocation, misc.) with per-type: annual/monthly entitlement (per grade), bill-required flag, taxability rule.
- **CLM-02** ESS claim submission: amount, period, bill uploads (multiple), running entitlement balance shown before submit.
- **CLM-03** Approval chain: RM → HR verify (bill check) → payroll pay-batch; rejection reasons mandatory; partial approval (approved amount ≤ claimed) supported.
- **CLM-04** Payout via payroll run as non-taxable/taxable component per type rule **or** off-cycle reimbursement batch with its own bank file + reimbursement payslip (SOW-6: reimbursement bank transfer, register, payslip via platform).
- **CLM-05** Year-end: TDS on unclaimed/unsubstantiated entitlement per policy (SOW-6: "TDS on the unclaimed entitlement at the year end"); entitlement lapse/carry per type.
- **CLM-06** Reimbursement register report (R31) and per-employee claim history in ESS.
- **CLM-07** Travel advance settlement links to claims: advance adjusted against approved claim; unspent advance recovered via payroll deduction. *(closes the loop on LN-04)*

## 8b. M13 Travel & Expense Management — requirements *(supersedes the live "Yatra Avedan" system, doc 11)*

The permanent, better version of RML's approved T&E system. Full corporate travel-to-settlement lifecycle, built into the HRMS on its employee master and workflow engine.

**Travel request (Trip)**
- **TE-01** Trip request: trip name, travel type (Domestic/International), purpose, itineraries (flight/train/bus/hotel/car segments), destination country, visa-required flag, expected journey date, attachments (MinIO). Reference-number generated.
- **TE-02** International travel: visa request sub-flow, multi-currency, region/country policy; passport/visa document capture.
- **TE-03** Corporate booking integration: pluggable travel-booking connector (Yatra Avedan uses **MakeMyTrip Corporate** — port it) — push requisition, receive booking id/url, capture total cost; support "own arrangement" with reason + budget. Booking stays behind an interface so the provider is swappable.
- **TE-04** Trip status machine with cancellation (reason + cancellation cost) and closure.

**Budget & policy**
- **TE-05** Per-trip budget engine: travel modes (Air class + lowest-logical-airfare + flying-hours × cost/hour; Train coach + budget; Bus budget), hotel budget/night × nights, local conveyance/daily allowance, visa cost, own-arrangement budget. Grade/level-driven entitlements (level A/B/C in the live model). *(port `budgetAllowances`, `internationalTravelPolicy`)*
- **TE-06** Policy enforcement: claim/spend validated against approved budget; over-budget flagged for higher approval, not silently blocked.

**Advances & wallet (the settlement engine — port faithfully, it's the clever part)**
- **TE-07** Travel advance request linked to a trip/budget; approval chain RM → HOD → Admin/Finance (Chandan Modi / CEO stages for high value — matches PP-1); status incl. **Sent Back**.
- **TE-08** **Employee wallet**: an approved advance **credits** the employee's wallet (`walletBalance`); every movement is an immutable `WalletTransaction` (credit/debit, source ADVANCE|CLAIM_SETTLEMENT, links to advance/claim, remarks). Balance = sum of ledger (same immutable-ledger discipline as leave/payroll).
- **TE-09** **Settlement**: on claim approval, reconcile claimed vs advance held in the wallet → compute **net payable to employee** or **recoverable from employee**; settlement mode AUTO or MANUAL, settledBy/settledAt recorded; recoverable amounts flow to **payroll deduction** (ties to PAY/LN-03) or wallet carry-forward.

**Expense claims (this is M12, expanded by the live model)**
- **TE-10** Claim with line items: expense types (travel, daily_allowance, hotel, visa, local_travel, miscellaneous), per-item receipt no/date/amount/currency, travel mode + from/to + dates, hotel name/location + check-in/out, purpose, remarks, receipt attachment (MinIO). Multi-currency with exchange-rate capture. *(this is the concrete CLM-01..07 schema, sourced from the live `Claim` model)*
- **TE-11** Claim approval chain (RM → Travel Admin/CM → CEO stages per amount), **send_back** for correction; settlement per TE-09; reimbursement payout via payroll or off-cycle batch (validates CLM-04 / the live "Reimbursement Payslip").

**Migration & retirement**
- **TE-12** Migrate Yatra Avedan MongoDB data (users, trips, claims, advances, budgets, wallets, transactions) into the HRMS; run parallel until parity; **decommission Yatra Avedan** once payroll settlement integration is proven.

## 9. Traceability matrix (pain point → requirement)

| Source | Requirement(s) |
|---|---|
| PP-1 leave credit failures / travel advance | LV-02, ATT-12, LN-04 |
| PP-2 CEO dashboard | RPT-03 |
| PP-3/PP-4 payslip format, UAN/PAN missing | PAY-06, CORE-07 |
| PP-5 muster needs RM + Emp ID columns | RPT-01, CORE-03 |
| PP-6 daily boarding/exit email | LC-03 |
| PP-7 7–10 day absentee show-cause | ATT-10 |
| PP-8 cost centre / plant column | CORE-04, RPT-01 |
| PP-9 Kent attendance mismatch (200+ employees) | ATT-01, ATT-02, ATT-03 |
| PP-11 loans not completed | LN-01..03 |
| PP-12 new joiner salary missing | PAY-07, LC-01 |
| PP-14 separation workflow, letters not issued | LC-06, CORE-09 |
| PP-15 RM name in attendance/leave downloads | CORE-03, RPT-01 |
| PP-16 AR & OD Excel download | ATT-06, ATT-07, RPT-06 |
| PP-17 exited employees in active lists | CORE-06, LC-07 |
| PP-18 comp-off application broken | LV-04 |
| PP-19 OT module | ATT-08 |
| PP-20 offer approval procedure | WF-01 (LOI chain), ATS Phase 4 |
| PP-21 sales-employee attendance | ATT-14 |
| PP-24 offer report | RPT-02 |
| PP-25 attendance report with dept/RM/contact/OU | RPT-01 |
| PP-26 onboarding/exit notifications to HR/BH/CEO | LC-03, WF-02 |
| PI-ESS-1 probation % automation | PAY-02 |
| PI-ESS-5 policy acknowledgment alerts | CORE-13 |
| PI-ESS-7 loan restrictions + workflow | LN-02 |
| PI-ESS-8/10 probation reminders + confirmation workflow | LC-04 |
| PI-ESS-11 resignation workflow visibility | LC-06 |
| PI-ESS-12/14 UAB & violation alerts | ATT-11 |
| PI-ESS-13 OT pre-approval system | ATT-08 |
| PI-ESS-15 investment declarations | PAY-13 |
| PI-ESS-16 feedback surveys | EN-03 |
| PI-PAY-1/2 week-off eligibility rules | ATT-09 |
| PI-PAY-3 PF/ESIC/PT calculation fixes | PAY-09..12 (owned engine) |
| PI-PAY-5 F&F configuration | PAY-15 |
| PI-PAY-8 functional RM in master report | CORE-03 |
| KQ future-dated OD | ATT-07 |
| KQ manager-tree data access | CORE-10 |
| SOW-6 reimbursement processing | CLM-01..07, R31, TE-10/11 |
| Yatra Avedan T&E system (doc 11) | M13 / TE-01..12 |
| PP-1 Travel Advance ("Chandan Modi") | TE-07, LN-04 (already built in Yatra Avedan) |
| PP-v2-2 Kent FILO mechanism | ATT-18, §04-1.1 |
| PP-v2-7 ESS admin access training | CORE-14, roadmap training workstream |
| PP-v2-15 cross-plant punching vs cost center | ATT-16, R2 |
| PP-v2-18 manager attendance-override lockdown | ATT-17, 08-ROLES permission grid |
| PP-v2-20 travel claim approval broke after 15th | WF-01 test case: chains must have no hidden date cutoffs |
| AR-1..5 asset gaps | AST-01..05 |

## 10. Non-functional requirements

- **NFR-01 Performance:** muster export for 2,500 employees × 31 days < 10 s; dashboard first paint < 2 s; filter interactions never freeze the UI (async, debounced — per DESIGN_RESEARCH §3.4).
- **NFR-02 Scale assumptions:** ~2,000–3,000 on-roll employees; ~10,000–20,000 swipe events/day (467 rows in a partial-day sample export ⇒ thousands/day full-plant); 5 years online history. Verify headcount before capacity sign-off.
- **NFR-03 Security:** RBAC everywhere; bcrypt password hashing; JWT with short expiry + refresh; sensitive columns (salary, Aadhaar, PAN, bank) restricted by permission and masked in logs; TLS end-to-end; rate limiting on auth + all endpoints; parameterized queries only.
- **NFR-04 Auditability:** append-only audit log for master-data, payroll, and workflow actions; payroll months immutable after lock.
- **NFR-05 Backup/recovery:** nightly full pg_dump off-box + WAL archiving (PITR); restore drill documented and rehearsed before payroll go-live; RPO ≤ 24h (≤ 15 min for payroll months via WAL), RTO ≤ 4h.
- **NFR-06 Availability:** business-hours critical; payroll week is the hard window — no deploys during run days; PM2 auto-restart; disk/CPU alerts.
- **NFR-07 Compatibility:** responsive desktop-first (managers use large monitors — don't repeat Workday's scaling failure), functional on tablets/phones for ESS; PWA for geo check-in.
- **NFR-08 Data migration:** greytHR/Adrenalin exports (employee master, leave balances, salary structures, YTD payroll for mid-year TDS continuity) imported with validation reports before go-live.
- **NFR-09 Localization:** INR formatting (lakh/crore grouping), IST timezone everywhere, DD MMM YYYY dates (matches Kent exports).

## 11. Explicit non-goals (Phase 1–3)

- Contract-worker management (schema-reserved, deferred by D3)
- Performance management/appraisals (not in any source document — do not build; note greytHR has "Kudos/Feedback" enabled, so a light engagement-feedback surface may be revisited, but formal appraisals are out)
- LMS/training module (not requested)
- ~~Travel & expense~~ — **now IN scope** as M13 (absorbs the approved Yatra Avedan system); this former non-goal is retracted (doc 11 direction)
- Statutory e-filing automation (we generate portal-ready files — ECR, 24Q data, challan registers; filing stays a human action on govt portals)
- Multi-language UI
