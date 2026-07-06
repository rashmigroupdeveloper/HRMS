# 06 — Reports & Dashboards Catalog

Every report RML has requested from Protiviti (and never fully received), with exact columns and formulas. All tabular reports: on-screen table + ExcelJS export with identical columns and applied filters (RPT-06); access permission-gated per report; exports logged in audit.

## 1. Attendance reports

### R1. Attendance Muster Summary (RPT-01 — the flagship; PP-5/8/9/15/25)
Base: `att.day_records` × month. One row per employee:
| Column | Source / note |
|---|---|
| Emp ID (ecode) | added per PP-5 |
| Employee Name | |
| **Reporting Manager** | PP-5/15 — the twice-refused column |
| **Functional Manager** | PI-PAY-8 |
| Department, Designation, Org Unit | PP-25 |
| **Cost Center / Plant** | PP-8 ("1 column showing the plant… in which the employee is working") |
| Contact No | PP-25 |
| Category | white/blue/trainee/consultant |
| Day 1 … Day 31 | status glyph per day (P/A/HD/WO/H/L-type/OD/CO/UAB) |
| Totals: Present, Absent, Half-days, Week-offs (paid/unpaid), Holidays, Leaves by type, OD, CO, UAB, LOP days, OT hours | computed |
Filters: month, entity, plant/location, cost center, department, RM (with subtree — CORE-10), category, status. Performance target: 2,500 × 31 < 10 s (NFR-01).

### R2. Daily Attendance / Swipe Detail
Per employee-day: first-in, last-out, worked hours, late/early minutes, door of first/last swipe; drill to raw swipes (all 17 Kent columns preserved). Kent reconciliation view: HRMS status vs raw swipe presence — the report that would have caught the 200-employee mismatch (PP-9) on day one. Includes the **cross-plant flag** (ATT-16): employees whose majority swipe location differs from their mapped cost center/plant, so mappings get corrected instead of attendance being disputed.

### R3. AR & OD Report (PP-16, KQ)
Requests with employee, kind, dates/times, reason, status, approver chain + acted timestamps, applied-to-attendance flag. Excel export — the exact ask greytHR buried in a query builder.

### R4. Late / Early / UAB Exception Report
Day-level exceptions with minutes; summarized per employee per month (count + total minutes); feeds deduction policy (SOW-4.5b).

### R5. OT Register (ATT-08)
Detected vs claimed vs approved minutes, status (incl. lapsed), manager, decision time vs 48h deadline, payout run or comp-off credit. Manager league table of decision latency (accountability, not shaming — HR-only view).

### R6. Absence Cases (ATT-10)
Open/closed cases: employee, start date, days, stage, letter issued (link), owner, resolution. Weekly auto-email to HR Head.

## 2. Payroll & statutory reports (per run unless noted)

| # | Report | Contents |
|---|---|---|
| R7 | Final Pay Register | employee × all component lines + days + net (SOW-5.1.4); Excel |
| R8 | Bank Transfer File | bank's bulk format; excludes holds; totals row (PAY-05) |
| R9 | JV / Journal Report | GL code × cost center aggregation from `pay.gl_accounts` — SAP-consumable |
| R10 | Variance Report | per employee Δ vs previous month per component, threshold-highlighted with drill-down reason (SOW-5.1.5) |
| R11 | PF Register + ECR file | UAN, PF wages, EE/EPS/EPF/EDLI/admin, NCP days; ECR text per EPFO spec (PAY-09) |
| R12 | ESIC Register + return file | IP no, days, wages, EE/ER contributions (PAY-10) |
| R13 | PT Register | WB slab-wise deduction summary + employee detail (PAY-11) |
| R14 | LWF Register | periodicity-aware (PAY-12) |
| R15 | TDS Register / 24Q data / Form 16 | monthly TDS, quarterly 24Q export, annual Form 16 Part B per employee (PAY-13) |
| R16 | CTC Report | cost-center / department / location-wise employer cost incl. ER contributions (SOW-5.1.5; feeds CEO cost KPIs) |
| R17 | Loan & Advance Register | outstanding, EMIs posted, perquisite values (M11) |
| R18 | F&F Statement | per settlement: all heads, TAT compliance (PAY-15) |
| R19 | Salary Hold Register | active holds by type with reason and age (PAY-08) |
| R20 | Parallel-Run Comparison | HRMS vs Protiviti register, per component Δ (transition only, §04-6.8) |
| R31 | Reimbursement Register | claims by type/status/employee: claimed vs approved vs paid, bill verification status, entitlement utilization %, unsubstantiated taxable amounts (SOW-6; CLM-06) |

## 3. HR / lifecycle reports

### R21. Offer Report (RPT-02 / PP-24 — exact requested columns)
Candidate name · Organizational unit · Designation offered · Date of joining · Offer date · Offered salary · **Probation percentage** · LOI status (**Accepted / Rejected / Yet to Accept**). Source: ATS LOI data (integration read) + `onboarding_candidates`. Filter: date range, unit, status.

### R22. Recruitment & Hiring Report (RPT-05)
Vacancies opened/filled, time-to-fill, source mix, joins by month/dept/plant — from ATS data (template "already shared" with Protiviti; recover the template file from HR and match columns 1:1 before build).

### R23. Promotion & Internal Movement Report (RPT-05)
From `core.employee_history`: promotions, transfers (dept/location/entity), manager changes — employee, from → to, effective date, approver.

### R24. Onboarding & Exit Report (LC-03/PP-26)
Daily email + on-demand range query: joins (name, ecode, designation, dept, RM, cost center, DOJ) and exits (+ reason, DOL, F&F status).

### R25. Probation Due / Confirmation Report
Due in next N days, overdue, outcomes history (LC-04).

### R26. Exit / Attrition Report
Leavers by month, dept, plant, category, reason, tenure band; voluntary vs involuntary; feeds CEO KPIs.

### R27. Headcount & Demographics Report
Point-in-time and trend: by entity, plant, dept, category, grade, gender, age band, tenure band.

### R28. Asset Reports
Register by status/holder; non-returned assets (AR-5); assets of resigned employees (AR-4); maintenance log.

### R29. Helpdesk Monthly Performance
Tickets by category/status/assignee, SLA hit rate, escalations, aging (SOW-9.3).

### R30. Policy Acknowledgment Report
Policy × population: acknowledged %, laggards list (CORE-13).

## 4. CEO Dashboard KPI formulas (RPT-03 — every metric from the pptx, defined)

Columns everywhere: Total · White Collar · Trainee · Blue Collar · Contract (Phase 4) · Consultants.

| KPI | Formula (as implemented) |
|---|---|
| Manpower Count | active employees at date, by category |
| Average Age | AVG(age(dob)) by category |
| Tenure | AVG(age(doj)) of active, by category |
| Leadership % | active with grade.rank ≥ leadership cutoff ÷ active |
| Contract Manpower Dependency Ratio | contract count ÷ total manpower (Phase 4; until then shows on-roll basis note) |
| Avg CTC per level | AVG(annual_ctc) by category and by grade band (from current `employee_salaries`) |
| Labour Productivity | production output (manual monthly input or ERP feed) ÷ total manpower — output source: `core.settings` monthly figures until ERP integration |
| Output per Man-Hour | output ÷ Σ worked_minutes/60 (att.day_records) |
| Cost per Man-Hour | (gross payroll + ER contributions) ÷ Σ worked hours |
| Cost per Unit | payroll cost ÷ output units |
| Overtime (hrs) & Cost of OT | Σ approved OT minutes/60; Σ OT payroll lines |
| Absenteeism % | UAB+A days ÷ scheduled working days, monthly trend |
| Attrition Rate | leavers in period ÷ average headcount, annualized |
| No. of Leavers | count by month |
| **New-hire attrition 3/6/12 mo** | of joiners in cohort, % exited within 90/180/365 days of DOJ (pptx slide 2) |
| Employee Burnout Index | composite proxy, displayed with definition tooltip: weighted z-score of (OT hours/head, consecutive-workdays streaks, leave-unused %, late-night swipe frequency). Definition lives in settings; label clearly "index", never presented as a survey result |

Implementation: nightly materialized snapshots (`reporting.kpi_daily`) so the dashboard reads precomputed rows — no live heavy aggregation at CEO open time; refresh timestamp shown on the page.

## 5. Dashboard inventory

| Dashboard | Audience | Content |
|---|---|---|
| HR Ops (landing) | HR team | §05-4.1 spec |
| Business Unit | BU/Plant heads | headcount, absenteeism, OT, joiners/exits, absence cases — scoped to their OU (RPT-04; formats "already shared" — recover template and match) |
| CEO / Executive | CEO, CEO Cell, CHRO | §4 above (PP-2) |
| Payroll console | payroll role | run states, exceptions, statutory calendar (ECR/ESIC/PT/TDS due dates) |
| Device health | IT + HR ops | Kent doors last-seen, gap alerts, unmatched swipes (ATT-02) |
| Manager home | all managers | team today, pending approvals with SLA countdown, roster deadline nag |
