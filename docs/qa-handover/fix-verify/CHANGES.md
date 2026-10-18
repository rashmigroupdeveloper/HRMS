# CHANGES — Rashmi HRMS fix branch (/workspace/hrms-fix)

(Running log; the full P-xx / C-A-B listing is assembled at final report time.)

## Round: bulk import framework + co-sign + group-only statutory (2026-10-18 IST)
- Bulk Excel/CSV import framework (core/bulk) and 10 importers: payroll inputs (+Report 4 layout), statutory rates, PT slabs, holidays, leave balances, loans, assets, salary assignments, punches (Kent layout), employees (create/update). There's a template with dropdowns and an Instructions sheet, preview with an xlsx validation report, all-or-nothing commit, idempotent re-upload (sha256), background mode above 1000 rows, audit, formula-injection guard, and .xls is refused. UI: Admin → Data imports, plus a drawer on the payroll Inputs panel.
- Parallel run: the register upload is now parsed server-side (xlsx/csv/Report 4). RML033625 nets 59,124.
- Company locale columns (country, currency, timezone, locale); punch import converts using the company timezone.
- Country-pluggable identity validators (PAN, Aadhaar Verhoeff, UAN, ESIC, IFSC, bank account, mobile, PIN; minors).
- C-04: approving a payroll run now needs the new permission `payroll.run.cosign` (hr_head; super_admin holds it only so it can delegate it). The service refuses a super_admin-only co-sign unless PAYROLL_SUPER_ADMIN_COSIGN=true, and ceo_cell can no longer approve. Migration 1752500000200.
- Statutory rates and PT slabs are group-wide. Entity-bound payroll admins now get 403 (API and importer).

## Round: HOD (2026-10-19 IST, commit 515b743)
- New `hod` role, derived like manager. An active employee becomes an HOD when they are designated in the new `core.department_heads` table, either for one company or group-wide, or when they are named as someone's `hod_employee_id`.
- New grant scope `department`. HOD grants are department-scoped: employee.read, team attendance, muster export, AR/OD/OT/leave/claims approval and HR reports. HODs get no attendance edits, no compensation and no employee.write.
- New `department_head` workflow approver: the employee's own HOD field first, then the company head, then the group head. It never resolves to the subject, and a vacancy goes to the routing hold. Domestic travel advance is now RM → HOD (docs/01 TE-07); the migration changes it only where the chain was still the seeded default.
- API: GET/POST /core/department-heads and POST /core/department-heads/{id}/remove. These are audited. Entity HR can only designate within its own company; a group-wide designation needs group scope.
- New admin screen: Admin → Heads of department. "Head of department" is added to the approver presets on Approval chains.
- Seeded HOD on the fix instance: RML033904 is head of RML Production (fix-verify/env/hod-seed.sql), login rml033904@qa-payroll.rashmi.test. The directory shows 28 RML Production employees only.

## UI/UX pass (job/uiux, frontend presentation only)
- Crextio-referenced Warm Editorial polish: new `StatTile`/`StatGrid` KPI tiles (lifecycle, loans, travel, transfers), `HeadlineStats` big light numerals with count-up, `CardLink` round ↗ card actions.
- Removed uppercase tracked "kicker" labels, raw palette colours, `transition-all`, requirement ids (LC-06 etc.) and build-phase copy from the UI; PendingModule says "Coming soon".
- Data Imports and Department Heads restyled; ESS hero punch tiles no longer overflow; Profile tab empty states give a next step.
- Fonts self-hosted (Manrope, Fraunces; latin + latin-ext for ₹) with preload — no Google Fonts request.

## Client decisions needed
| # | Topic | Default chosen | Source | How to change |
|---|---|---|---|---|
| CD-1 | super_admin break-glass co-sign of a payroll run (C-04) | Not allowed; only hr_head co-signs | docs/08 §2 | env PAYROLL_SUPER_ADMIN_COSIGN=true |
| CD-2 | ceo_cell co-sign | Not allowed (it was allowed before) | docs/08 §2 line 41 | grant payroll.run.cosign to ceo_cell |
| CD-3 | Report 4 columns GRATUITY, LEAVE ENCASHMENT, EX-GRATIA, HOLD SALARY, Performance-Linked, LOAN2 in the inputs import | Ignored with a warning (they come from F&F / loans modules) | sample register | importer mapping |
| CD-4 | What HOD means (C-02) | Both: the per-employee hod_employee_id override, else the designated head of the department (per entity or group-wide) | user brief; EMS hod_id; docs/01 TE-07 | data in Admin → Heads of department |
| CD-5 | Which chains include an HOD step | Only domestic travel advance (RM → HOD). Claims, long leave, OT pre-approval, requisition and offer can add a "Head of department" step in Approval chains | docs/01 TE-07 | Admin → Approval chains |
| CD-6 | PF wage base (C-13) | ACTUAL basic (matches the client register; RML033625 nets 59,124) | sample register, greytHR | setting `pay.pf_wage_base` (ACTUAL / CEILING_15000) |
| CD-7 | Gratuity eligibility (C-14) | As in the statutory params table (effective-dated) | docs/10 | Payroll settings → Statutory rates (scheme GRATUITY) |
| CD-8 | OT rate base (C-15) | Factories Act base, (Basic+DA+allowances)/208 × 2 | docs/10, OT payslip template | Payroll settings → Statutory rates (scheme OT) |
| CD-9 | LOP divisor / proration (C-16) | Calendar days of the month (register parity) | sample register | Statutory params (proration mode); worked LOP example still needed from RML |
| CD-10 | Attendance cycle 26→25 (C-17) | Calendar month (no cycle setting yet) | docs + code | **Open — needs engine change (payroll job) once RML confirms** |
| CD-11 | ESIC on OT (C-18), LWF frequency (C-19) | OT excluded from ESIC wages; WB LWF half-yearly | docs/10 | Statutory rates; `pay.lwf_deduct_in_payroll` |
| CD-12 | TDS scope (C-20) | All employees with taxable income | PRD | **Open — no white-collar-only switch yet** |
| CD-13 | Investment declaration / proof windows (new, item 3) | Declarations 1 Apr–15 Jan, proofs 1 Jan–28 Feb of the FY | common practice | settings `tax.declaration_open/close`, `tax.proof_open/close` |
| CD-14 | F&F turnaround (C-22) | Not tracked (one F&F run key per month) | D11 | **Open — item 5 F&F cycle/TAT** |
| CD-15 | Register parity vs statutory law (C-23) | Parity with the client register; deviations listed for sign-off | user brief | signed exception list from RML |
| CD-16 | Probation salary % (C-25) | 70/80/90 allowed, single source `pay.employee_salaries.probation_percent` | LOI | **Open — item 6 consolidation** |
| CD-17 | Who may override attendance (C-27) | hr_ops with mandatory reason + audit; managers blocked | docs/08 | permission `attendance.manual_override` in Users & Roles |
| CD-18 | Week-off eligibility (C-28) | Must work ≥ 1 day in the week | Reports-Templates email | setting `att.weekoff_min_worked_days` |
| CD-19 | Absentee threshold (C-29) | Watch at `att.absence_watch_days`, show-cause at `att.absence_show_cause_days` | docs/01 ATT-10 | those settings |
| CD-20 | Two-session rules (C-30) | Present fraction `att.session_present_fraction` | assumption | setting; RML to confirm hours/grace |
| CD-21 | OT approval model (C-31) | Post-detection manager approval within `att.ot_decision_hours` | PRD | **Open — pre-approval is item 5** |
| CD-22 | Leave approval chain (C-33) | RM only | docs/08 §4 seed | Admin → Approval chains |
| CD-23 | Notice period (E2E-002) | 90 days white collar, 30 days otherwise | docs | settings `lifecycle.notice_days_white_collar/default` |
| CD-24 | Probation decision rights (E2E-008) | hr_ops/managers view; managers evaluate own reports; only hr_head decides | docs/08, O17 | permissions `lifecycle.probation.view/decide` |
| CD-25 | Entity-scoped role grants (E2E-010) | hr_ops / payroll_admin / plant_head must be granted with an org unit | owner rule | API refuses unscoped grants; existing unscoped grants (base seed payroll@) need review |

