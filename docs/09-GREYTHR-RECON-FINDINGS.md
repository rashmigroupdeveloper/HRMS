# 09 — greytHR Reconnaissance Findings (live system)

**Method:** read-only ESS session against `rashmi-group.greythr.com` (Playwright, headless), 3 Jul 2026, account RML033903. No data modified. Screenshots archived in the build scratchpad. This document records **real RML configuration** that supersedes assumptions in docs 01–08 where they differ. greytHR platform build tag observed: `main-2311`.

> **Security note recorded for the sponsor:** the password was shared in chat and used here once. **Rotate it now.** For deeper admin-side capture (payroll register formats, workflow configs, statutory files), create a dedicated read-only admin user rather than reusing a personal account (see §8).

---

## 1. Confirmed leave types (replaces the assumed CL/SL/EL/ML/CO/LWP list in LV-01)

RML's live leave scheme has **six** types:

| greytHR name | Maps to | Notes from live data |
|---|---|---|
| Compensatory Off | `CO` | Balance shown as fractional (0.5) — half-day comp-off supported |
| Casual Leave | `CL` | Granted 5.19 as of Jul — **accrual-based, pro-rated monthly** (odd fraction confirms monthly accrual, not annual grant) |
| Earned Leave | `EL` | Granted 7.67 — accrual-based; encashable; the "after 1 year service" rule (Latest-Update sheet) applies |
| **Election Leave** | new — `EL_VOTE` | Granted 1, fully consumed. India statutory paid leave to vote. **Not in my original schema — add it.** |
| Sick Leave | `SL` | Granted 3.38 — accrual-based |
| Loss Of Pay | `LWP` | `is_paid=false`; feeds LOP to payroll |

**Action taken:** `lv.leave_types` seed must include Election Leave; all of CL/SL/EL are `accrual_per_month`-driven (fractional monthly credit), confirming the LV-02 monthly-accrual job design. Maternity (ML) was **not** present for this employee but keep it in the type catalog (gender-conditional applicability).

## 2. Confirmed salary structure & payslip template (this is PAY-06 / PAY-01 ground truth)

Live payslip (RML033903, May 2026) — **the exact template to replicate**:

**Earnings:** BASIC · HRA · MEDICAL ALLOWANCE · SPECIAL ALLOWANCE · EDUCATION ALLOWANCE · BONUS
**Deductions:** PF · PROF TAX · GUEST HOUSE DEDUCTION

Observed values (RML033903): BASIC 32,286 · HRA 16,143 · MEDICAL 1,250 · SPECIAL 12,005 · EDUCATION 200 · BONUS 2,689 → Gross 64,573. PF 3,874 · PROF TAX 200 · GUEST HOUSE 2,500 → Deductions 6,574. **Net 57,999.**

Derived configuration rules (now baked into `pay.salary_components` seed):
1. **HRA = 50% of BASIC** (16,143 / 32,286). Component formula `BASIC * 0.5`.
2. **PF is on ACTUAL basic, not capped at ₹15,000** — 12% × 32,286 = 3,874. RML deducts PF on full basic (above-ceiling PF). `PF_EE` formula uses full PF wages, not the ₹15k ceiling. **This is a critical config point** — the statutory ceiling applies only to the EPS split, not RML's PF deduction base. Confirm with payroll before coding (§8).
3. **PROF TAX = ₹200** (WB monthly PT top slab) — confirms `pt_slabs` WB values.
4. **BONUS is paid monthly** (2,689/month), not annually — statutory bonus disbursed each month as an earning line.
5. **MEDICAL ALLOWANCE ₹1,250/mo** (= ₹15,000/yr, legacy medical limit) and **EDUCATION ALLOWANCE ₹200** (2 children × ₹100 CEA) are fixed components.
6. **GUEST HOUSE DEDUCTION** — a company-specific recovery component (₹2,500). Add a general "recovery/other deduction" component class; these are per-employee variable deductions (`pay.inputs`).
7. **No ESI line** — this employee's gross > ₹21,000, so `esic_applicable=false`. Confirms the ESIC applicability gate.

**Payslip employee-detail block (exact fields to reproduce, PAY-06):** Name · Employee No · Joining Date · Bank Name · Designation · Bank Account No · Department · **PAN Number** · Location · **PF No** · Effective Work Days · **PF UAN** · LOP · Leaving Date · EMP EFFECTIVE WORKDAYS FOR DISPLAY · LOP REVERSAL. Net pay printed in figures **and words**. (This directly validates the CORE-07 statutory-IDs-on-payslip requirement — PAN, PF No, UAN all present.)

**Three payslip types confirmed** (tabs): **Payslip · Reimbursement Payslip · Overtime Payslip** — validates the M12 reimbursement-payslip (CLM-04) and the separate OT payslip design. Our system must produce all three.

## 3. Confirmed TDS / IT-statement structure (validates §04-6.5 exactly)

Live IT-Statement is a labelled A→R computation, **new regime** default, which our TDS engine must reproduce line-for-line:

A Income · B Deductions · C Perquisites · D Income Excluded From Tax · **E Gross Salary (A+C−D)** · F Exemption u/s 10 · G Income From Previous Employer · **H Income After Exemption (E−F+G)** · I Less Deduction u/s 16 (₹75,000 standard deduction shown — **new-regime SD is ₹75k**, confirms current-FY value) · **J Income Chargeable under Salaries (H−I)** · K Income From Other Sources / House Property · **L Gross Total Income (J+K)** · M Deduction under Chapter VI-A · **N Taxable Income (L−M)** · O Annual Tax · P Tax Paid Till Date · Q Balance Payable · **R TDS Recovered in Current Month**. Header tiles: regime, Net Tax, Total Tax Due, Tax Deductible/Month, Remaining Months.

**Action:** `pay.it_slabs.standard_deduction = 75,000` for new regime current FY; the A–R structure becomes the IT-statement report (R15) layout and the ESS tax view (05-UIUX §4.5).

## 4. Confirmed attendance / shift configuration (feeds ATT-04/05 seed)

Live attendance (RML033903, July 2026):
- **Shift:** `G5_Custom_2 (G5)` — **09:00 to 18:00**, two sessions: **Session 1 09:00–13:30, Session 2 13:31–18:00** (lunch split at 13:30). So worked-hours logic must handle a two-session day.
- **Saturday scheme:** `GCS` ("GCS scheme with Saturda…") — Saturdays run a different attendance scheme (alternate-Saturday / half-day working). The roster/scheme model (`att.rosters` + scheme) must support **weekday-vs-Saturday different schemes** per employee.
- **Day-status glyphs seen:** `P` (present), `O` (weekly off), `A:P` (dual — likely Absent-then-Present session split or first/second-half), `P:O` (present + off). Our `att.day_status` enum needs a **session-level or half-day dual-status** representation — a single-status-per-day model is too coarse for RML's two-session days. **Schema refinement noted below.**
- **Metrics shown:** Avg Work Hrs, Avg Actual Work Hrs, **Penalty Days**, exception-day count, **My Overtime** (OT tracked per employee), "insights". "Penalty Days" implies an attendance-penalty policy — confirm rules (§8).

## 5. Full ESS menu (defines the ESS surface parity target for 05-UIUX §4.9)

Live left-nav (employee role): **Home · Engage · My Worklife** (Kudos, Feedback) **· To do** (Tasks, Review) **· Salary** (Payslips, YTD Reports, IT Statement, IT Declaration, Loans and Advances, Reimbursement, Proof Of Investment, Salary Revision) **· Leave** (Leave Apply, Leave Balances, Leave Calendar, Holiday Calendar) **· Attendance** (Attendance Info, Regularization & Permission) **· Expense Claims · Document Center · People** (directory) **· Helpdesk · Request Hub · Workflow Delegates.**

Notes:
- "Kudos" + "Feedback" (Engage/My Worklife) → maps to our Engagement module (M10); RML has these enabled — worth parity.
- "Proof Of Investment" is separate from "IT Declaration" (declare vs. upload-proof phases) — matches PAY-13's declaration→proof-window design.
- "Salary Revision" is an ESS-visible history — validates `pay.employee_salaries` effective-dated history exposed to the employee.
- "Regularization & Permission" — "Permission" is a short-duration attendance exception (e.g., 2-hour personal permission) distinct from full-day AR/OD. **Add `kind='PERMISSION'`** to `att.regularizations` with time-bounded hours.

## 6. Notable gaps confirmed in the live system (why RML's pain points are real)

- **Request Hub (generic custom-workflow builder) is empty** — "No request types have been added yet." **Correction (see §10):** this does NOT mean workflows were never configured — the manager Review queue shows many live workflows. It means only the *generic Request Hub custom-workflow builder* is unused; the standard workflows (Leave, OT, Confirmation, Resignation, Loan, etc.) ARE configured.
- ESS-only account (RML033903 is a normal employee) — could not see admin/payroll-admin config screens. Manager/HR/payroll dashboards, workflow configs, salary-structure admin, and statutory-file formats require an admin login (§8).

## 10. Second session — DGM / manager account (RPL002116 "Rajeev", 5 Jul 2026)

A DGM-level (approver) account of a **different group entity** exposed manager surfaces invisible to the employee login. Read-only; nothing modified.

### 10.1 More group entities than documented
- **RPL = Rashmi Paradigm Limited** (logo confirmed) — e-codes `RPL002xxx`.
- **RDL** — another entity (e.g. Bimal Kumar Parhi `#RDL002034`); likely Rashmi/Reach Dredging Ltd. Confirm full name.
- Combined with earlier data, the entity set is now **RML, RGH, EIPL, RPF (Dubai), RPL, RDL** — one greytHR tenant (`rashmi-group.greythr.com`), multi-company, logo switches per employee's company. **`core.companies` seed must include all six** (D3 multi-entity is bigger than first scoped; see also the Dubai/RPF statutory-scope question).

### 10.2 The authoritative workflow catalog (manager Review page — supersedes 08-ROLES §4 guesses)
greytHR's configured approval workflows, grouped exactly as RML has them:
- **Attendance:** Overtime · Regularization & Permission
- **Claims:** (expense claim approval)
- **Custom Workflows:** Request Hub (empty — the only unconfigured one)
- **EmpInfo:** Confirmation · Resignations · Helpdesk
- **Leave:** Leave · **Leave Cancel** · **Leave Encashment** · **Leave Comp Off** · **Restricted Holiday**
- **Letter:** **Letter Signature Approval**
- **Payroll:** Loan

New workflow types I had not documented, now added to the PRD/schema:
1. **Leave Cancel** — cancelling an approved leave is its own approval flow (not a silent delete).
2. **Leave Encashment** — employee-initiated encashment request → approval → payroll (not only F&F-driven).
3. **Restricted Holiday (RH)** — India floating-holiday concept: employees pick N optional holidays from a published list; selection is approved. **Missed entirely before — add leave type + workflow.**
4. **Letter Signature Approval** — generated letters route for signature approval before issue (ties to CORE-09/letters).

### 10.3 Manager home surfaces (feed 05-UIUX manager dashboard + 08-ROLES)
- **Review** dashlet: count of pending approvals (Rajeev had 51), split by type (Leave, Regularization & Permission).
- **Team On Leave** dashlet: Today + This Month, per team member with ecode and dates — direct model for the manager dashboard's team-leave tile.
- **Track**: pending Claims and Permissions counts.
- **Reports Gallery** nav item exists for managers (could not capture the report list this session — needs a live click or admin login; still an open item for §8).
- Confirms manager-of-managers/subtree behaviour: Rajeev sees team members across RPL **and** RDL (`#RDL002034`) — cross-entity reporting relationships exist, so the reporting tree spans companies. `core.reporting_tree` must not assume single-company.

## 7. Schema/spec refinements triggered by this recon

Applied to the docs:
1. **`lv.leave_types` seed** gains **Election Leave**; ML kept as gender-conditional. (LV-01)
2. **`pay.salary_components` seed** = the six earnings/deductions above with real formulas (HRA 50% of BASIC; PF on full basic; monthly BONUS; fixed MEDICAL/EDUCATION; GUEST HOUSE as recovery class). (PAY-01/06)
3. **`pay.it_slabs.standard_deduction=75000`** (new regime, current FY); IT-statement A–R layout is the R15/ESS-tax spec. (PAY-13)
4. **`att.day_records`** must represent **two sessions / dual status per day** (session-level in/out and status), not one status per day — RML runs split-session shifts with Saturday-specific schemes. (ATT-05 refinement)
5. **`att.regularizations.kind`** adds `PERMISSION` (short-duration, time-bounded). (ATT-06)
6. **Three payslip outputs** (regular, reimbursement, overtime) are a hard requirement. (PAY-06, CLM-04)
7. **"Penalty Days"** attendance policy exists — add to `core.settings` and confirm rules. (ATT-05)

## 8. Still needed from an ADMIN/PAYROLL login (the remaining unknowns)

An ESS account cannot reach these; get them via a dedicated read-only admin user (or exports):
1. **Salary structures per grade** (component master + formulas) — confirm PF-on-full-basic policy and all grades.
2. **Payroll admin: one month's Final Pay Register + Bank Transfer File + JV** — exact column formats (R7/R8/R9).
3. **Statutory files:** PF ECR text, ESIC return, PT register, Form 24Q data (R11–R15 formats).
4. **Workflow configs** (leave/resignation/confirmation/OT approval chains) — even though Request Hub is empty, leave/attendance approval chains exist in admin.
5. **Attendance policy:** grace minutes, half-day thresholds, penalty-day rules, GCS Saturday scheme definition, OT rates.
6. **Full employee master export** (all columns, incl. inactive) — for migration mapping + e-code series audit.
7. **Leave policy config:** accrual rates, carry-forward caps, encashment rules per type.
8. **Loan register** with outstanding balances; **holiday calendars** per location.

These remain **Phase 0, week-1 tasks** (07-ROADMAP) — now with a concrete, verified checklist instead of guesses. Full statutory research and golden-test fixtures: **10-INDIA-PAYROLL-STATUTORY-REFERENCE.md §15**.
