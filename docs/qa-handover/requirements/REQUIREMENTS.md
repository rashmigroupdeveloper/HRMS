# Rashmi HRMS: requirements baseline

Prepared Sun 18 Oct 2026 (IST); JF and BP rows added Mon 19 Oct 2026 02:50 IST from the owner's joining forms and Enterprise Blueprint (statuses for those rows read at main a67c6b3) from every document under `docs/`, `docs/recon/`, `plans/`, `Documention_ProtiVity/` and the QA reports in `/workspace/hrms-test/`. Status was set by reading code in `/workspace/hrms-fix` at HEAD `ba6e81d` (23:16 IST) plus the fix worker's uncommitted changes. Treat it as a code-presence verdict, not UAT.

**Status meanings.**
- **Done:** implemented end to end (API and UI where a UI is required), with no known open defect.
- **Partial:** code exists, but a known defect, a missing sub-feature, an unproven integration or an open policy decision remains.
- **Missing:** no implementation found.
- **Not software:** a vendor or human service duty, or a scope exclusion.

**Priority.**
- **P0:** go-live blocker (payroll parity, statutory, data scope and security, attendance basis).
- **P1:** SOW-committed.
- **P2:** secondary.
- **P3:** future or Phase 4.

The same rows are in `REQUIREMENTS.xlsx`, which adds filters and a summary sheet. Acceptance steps are numbered for UI test authors.

## Counts by module and status

| Module | Done | Partial | Missing | Not software | Total |
|---|---|---|---|---|---|
| CORE Employee master & org | 3 | 12 | 13 | 0 | 28 |
| RBAC Roles, scope & audit | 2 | 10 | 1 | 0 | 13 |
| NFR Security, reliability & UX | 3 | 9 | 1 | 0 | 13 |
| ATT Attendance & time | 12 | 19 | 3 | 0 | 34 |
| LV Leave | 5 | 8 | 0 | 0 | 13 |
| WF Workflow & notifications | 4 | 6 | 2 | 0 | 12 |
| PAY Payroll engine & register parity | 2 | 21 | 2 | 0 | 25 |
| STAT Statutory compliance | 0 | 10 | 3 | 0 | 13 |
| OUT Payroll outputs | 0 | 8 | 0 | 0 | 8 |
| LN Loans & advances | 0 | 7 | 0 | 0 | 7 |
| CLM Claims & reimbursements | 0 | 6 | 0 | 0 | 6 |
| LC Onboarding, probation & transfers | 2 | 9 | 0 | 0 | 11 |
| SEP Separation, F&F & exit | 0 | 8 | 2 | 0 | 10 |
| LTR Letters | 0 | 2 | 0 | 0 | 2 |
| RPT Reports & dashboards | 6 | 17 | 3 | 0 | 26 |
| AST Assets | 4 | 3 | 0 | 0 | 7 |
| HD Helpdesk | 0 | 3 | 0 | 0 | 3 |
| EN Engagement & policies | 0 | 4 | 0 | 0 | 4 |
| TE Travel & expense | 0 | 9 | 2 | 0 | 11 |
| ATS Recruitment, offer & LOI | 0 | 0 | 8 | 0 | 8 |
| SVC Vendor service duties (non-software) | 0 | 0 | 0 | 4 | 4 |
| JF Joining form RML/HR/02/01 | 0 | 10 | 12 | 0 | 22 |
| BP Enterprise blueprint additions | 0 | 15 | 18 | 0 | 33 |
| **TOTAL** | **43** | **196** | **70** | **4** | **313** |

## CORE Employee master & org

### RQ-CORE-001: Single employee master record holds personal, employment, statutory and financial details for every employee (one record per person).

- **Source:** docs/01 CORE-01; SOW row 8 (2.1a); SOW row 4
- **PRD:** CORE-01
- **Roles:** hr_ops, hr_head, employee (own)
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** Read-only: backend/src/modules/employees/employees.router.ts (GET /employees, /employees/{ecode}, /employees/me only); frontend/src/pages/people/ProfilePage.tsx. No create/update API.
- **SOW rows:** 4, 8
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Open People > search an e-code > open profile
  3. Expect tabs/sections for Personal, Employment, Statutory (PAN/Aadhaar/UAN/PF/ESIC), Bank, Compensation (restricted)
  4. Log in as the same employee > Me: expect own record, read-only for sensitive fields

### RQ-CORE-002: HR can create and edit an employee master record through the UI, with every change written to the field-level audit log (old -> new, who, when).

- **Source:** docs/01 CORE-01, CORE-11; SOW row 4; Agreement tracker 2.1a (compensation not entered for new joiners)
- **PRD:** CORE-01/11
- **Roles:** hr_ops (own entity), hr_head (group)
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No PUT/PATCH on backend/src/modules/employees/employees.router.ts; employees only created by CLI import or onboarding conversion (backend/src/modules/lifecycle/onboarding).
- **SOW rows:** 4, 8
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. People > open employee > Edit > change designation and bank IFSC > Save
  3. Expect success toast and new values on profile
  4. Admin > Audit log: filter entity=employee, expect 2 rows with old/new values, actor and IST timestamp
  5. Log in as employee: Edit control is absent on master fields

### RQ-CORE-003: E-code is system-generated per legal-entity series (RML…, RGH…, RDL…, KIOL…), sequence-enforced; duplicates impossible.

- **Source:** docs/01 CORE-02; SOW row 83; Agreement 3.2 remark (incorrect codes)
- **PRD:** CORE-02
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** core.next_ecode() + allocator (backend/src/modules/lifecycle/onboarding, pack19); unique constraint core.employees.ecode
- **SOW rows:** 83
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Onboarding: convert a confirmed-joining candidate for entity RML
  3. Expect e-code = configured RML prefix + next number
  4. Convert a second candidate in RGH: expect RGH series, independent counter
  5. Try to import a row with an existing e-code: expect row rejected "duplicate e-code"

### RQ-CORE-004: Permanent e-code is issued only when HR confirms actual joining (candidate stays in pre-joining population until then).

- **Source:** plans/launch-readiness/02-CANDIDATE-TO-EMPLOYEE.md (sponsor 17 Oct 2026)
- **PRD:** LC-01
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** backend/src/modules/lifecycle/onboarding/onboarding.service.ts (pack33)
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Onboarding board: candidate with accepted application but no joining confirmation
  3. Expect no e-code, not in People directory or headcount
  4. Click Confirm actual joining
  5. Expect e-code allocated, employee appears in People, login optional/inactive until activated

### RQ-CORE-005: Every employee carries both a Reporting Manager and a Functional Reporting Manager; both appear in the master report and muster exports.

- **Source:** docs/01 CORE-03; Pending Implementation 28 Aug (Functional RM in master report); Reports-Templates email; PainPoint PP-15
- **PRD:** CORE-03
- **Roles:** hr_ops, manager
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** functional_manager_id used in backend/src/modules/workflows/workflow-approvers.ts and frontend/src/pages/reports/MusterPage.tsx; no master report export; no UI to edit.
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Open employee profile: expect RM and Functional RM fields
  3. Reports > Muster > Export Excel: expect columns Reporting Manager and Functional Manager
  4. Employee master export: same two columns

### RQ-CORE-006: Cost centre (plant code e.g. 1701) is mandatory on every employee; manpower cost is queryable by cost centre.

- **Source:** docs/01 CORE-04; PainPoint PP-8 (cost centre/plant column)
- **PRD:** CORE-04
- **Roles:** hr_ops, payroll_admin, plant_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** core.employees.cost_center_id is nullable (schema/SCHEMA_AUDIT.md S-04); R27 backend/src/modules/reports/reports.service.ts
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Try to save/import an employee without cost centre: expect validation error
  3. Reports > Headcount (R27) filter by cost centre: expect counts
  4. Payroll register export: cost centre column present and totals per cost centre

### RQ-CORE-007: Employment category (white_collar, blue_collar, trainee, consultant, contract, apprentice) is set on every employee and drives dashboards and payroll rules.

- **Source:** docs/01 CORE-05; CEO DASHBOARD/HR Dashboard.pptx columns
- **PRD:** CORE-05
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** enum employment_category (migrations); backend/src/modules/reports/kpi-snapshot.service.ts
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Open employee: category shown
  3. Executive dashboard: totals split White Collar / Trainee / Blue Collar / Contract / Consultants
  4. Set category=apprentice and run payroll: no PF/ESI/PT deducted

### RQ-CORE-008: Status lifecycle onboarding -> active -> on_notice -> exited; exited employees never appear in active lists, variable-input lists, payroll or reports unless explicitly filtered.

- **Source:** docs/01 CORE-06, LC-07; Agreement 5.2.12 (inactive employees in variable input list); PainPoint PP-17
- **PRD:** CORE-06
- **Roles:** hr_ops, payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** status enum exists; QA REPORT.md flags exited/inactive handling; inputs upload backend/src/modules/payroll-core/runs/run.router.ts (CSV)
- **SOW rows:** 93
- **Acceptance (UI):**
  1. Exit an employee (LWD = yesterday) via separation flow
  2. People directory default filter: employee absent; filter Status=Exited: present
  3. Payroll > next run inputs: employee not offered for variable inputs
  4. Upload a variable input for that e-code: row rejected "inactive employee"

### RQ-CORE-009: Date of leaving is mandatory at exit and set exactly once.

- **Source:** docs/01 CORE-06, LC-07
- **PRD:** CORE-06
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** backend/src/modules/lifecycle/separation/separation.service.ts; no CHECK doj<=dol (SCHEMA_AUDIT S-22)
- **Acceptance (UI):**
  1. Open a separation at final stage
  2. Try to complete without LWD: blocked
  3. Complete with LWD: employee status exited, DOL shown; attempt to change DOL again: blocked/audited correction only

### RQ-CORE-010: PAN format validation (AAAAA9999A) at entry and import.

- **Source:** docs/01 CORE-07/08; SOW row 87
- **PRD:** CORE-08
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No format checks: backend/src/modules/employees/import.schemas.ts bare z.string(); live row RML000011 pan=INVALIDPAN (SCHEMA_AUDIT S-03)
- **SOW rows:** 87
- **Acceptance (UI):**
  1. Edit/import employee with PAN "INVALIDPAN"
  2. Expect inline error "PAN must be 5 letters, 4 digits, 1 letter"; record not saved
  3. Valid PAN saves

### RQ-CORE-011: Aadhaar format validation (12 digits, first digit 2-9, Verhoeff checksum); stored masked/encrypted.

- **Source:** docs/01 CORE-07/08; SOW row 88; PAYROLL_TEST_REPORT P-33 (plain Aadhaar)
- **PRD:** CORE-08
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No validation (SCHEMA_AUDIT S-03); plaintext storage per payroll P-33
- **SOW rows:** 88
- **Acceptance (UI):**
  1. Enter Aadhaar 123456789012 (bad checksum): error
  2. Enter valid Aadhaar: saves; profile shows XXXX-XXXX-1234 to non-privileged roles

### RQ-CORE-012: IFSC format validation (4 letters + 0 + 6 alphanumerics).

- **Source:** docs/01 CORE-08; SOW row 86
- **PRD:** CORE-08
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** Prejoin checks IFSC length 11 only (backend/src/modules/lifecycle/onboarding/prejoin-schema.ts:15); no format regex elsewhere (SCHEMA_AUDIT S-03)
- **SOW rows:** 86
- **Acceptance (UI):**
  1. Enter IFSC "HDFC1234567": error
  2. Enter HDFC0009686: saves

### RQ-CORE-013: Bank account length validation (9-18 digits, configurable per bank).

- **Source:** docs/01 CORE-08; SOW row 85
- **PRD:** CORE-08
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No account-length rule (SCHEMA_AUDIT S-03); prejoin only requires non-empty account
- **SOW rows:** 85
- **Acceptance (UI):**
  1. Enter account "1234": error
  2. Enter 14-digit account: saves

### RQ-CORE-014: Minor check from date of birth (age < 18 at DOJ blocked or flagged).

- **Source:** docs/01 CORE-08; SOW row 84
- **PRD:** CORE-08
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No DOB validation found (grep minor)
- **SOW rows:** 84
- **Acceptance (UI):**
  1. Create/import employee with DOB making them 17 at DOJ
  2. Expect blocking error "employee is a minor"

### RQ-CORE-015: Duplicate ESIC IP number and duplicate UAN detection across all employees.

- **Source:** docs/01 CORE-08; SOW row 89
- **PRD:** CORE-08
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No unique index on uan/esic_ip_number (SCHEMA_AUDIT S-03)
- **SOW rows:** 89
- **Acceptance (UI):**
  1. Enter a UAN already used by another employee
  2. Expect error naming the conflicting e-code
  3. Same for ESIC IP number

### RQ-CORE-016: Special characters (& , ' ") are stripped or rejected in designation/department names per SOW 5.2.

- **Source:** docs/01 CORE-08; SOW row 92
- **PRD:** CORE-08
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** No normalisation catalog (plans 08 D09)
- **SOW rows:** 92
- **Acceptance (UI):**
  1. Admin > Masters: create department "R&D, Plant's"
  2. Expect either sanitised value shown before save or validation error, per signed rule (decision D09)

### RQ-CORE-017: CTC entered must equal the sum of the salary breakup; mismatch blocks save.

- **Source:** docs/01 CORE-08; SOW row 90
- **PRD:** CORE-08
- **Roles:** payroll_admin, hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/structures/structure.router.ts (/payroll/structures/preview)
- **SOW rows:** 90
- **Acceptance (UI):**
  1. Payroll > Salary revisions: assign CTC 7,74,876 with structure
  2. Edit a component so total != CTC
  3. Expect error "breakup does not match CTC"

### RQ-CORE-018: E-code to employee-name match check on every bulk input (payroll inputs, loans, attendance uploads).

- **Source:** Agreement Tracker extra row (e-code and name match); SOW row 91 duplicate inputs
- **PRD:** CORE-08
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** inputs upload has no name check (backend/src/modules/payroll-core/runs/run.router.ts)
- **SOW rows:** 91
- **Acceptance (UI):**
  1. Upload variable inputs file where row has e-code RML000008 but name "Wrong Name"
  2. Expect row flagged "e-code/name mismatch", not applied

### RQ-CORE-019: Component-value input validation on payroll inputs (non-negative, within configured min/max, numeric).

- **Source:** Agreement Tracker extra row (input validation of component values)
- **PRD:** PAY-03
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** inputs upload exists (CSV); range validation not evidenced
- **Acceptance (UI):**
  1. Upload variable input with amount -500 or "abc"
  2. Expect row rejected with reason; valid rows applied; summary shows counts

### RQ-CORE-020: Bulk employee import from Excel (.xlsx) exports of greytHR/Adrenalin/EMS with a per-row validation report; nothing partially applied on error rows.

- **Source:** docs/01 CORE-12; SOW rows 4,5,128; user context (bulk uploads must accept Excel)
- **PRD:** CORE-12
- **Roles:** hr_ops, it_admin
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** Only CLI importers importEmsSeed/importGreythrEnrich (backend/src/modules/employees/import.service.ts); no API/UI route; no xlsx reader (core/excel/workbook.ts writes only)
- **SOW rows:** 4, 5, 10, 128
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Admin > Import employees > upload .xlsx (10 rows, 2 invalid)
  3. Expect preview with 8 valid / 2 errors and per-row reasons
  4. Confirm: 8 created, error file downloadable as .xlsx
  5. Re-upload same file: duplicates rejected

### RQ-CORE-021: Every bulk upload in the product (employees, payroll variable inputs, legacy loans, attendance/roster, parallel-run register, assets, leave balances) accepts Excel .xlsx (CSV optional).

- **Source:** User context; Latest Update sheet (ATS: "if Excel is possible to upload we can proceed"); SOW row 128, 221
- **PRD:** CORE-12
- **Roles:** hr_ops, payroll_admin
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** File inputs accept ".csv,text/csv" only: frontend/src/pages/payroll/PayrollPage.tsx:408, frontend/src/pages/payroll/ParallelRunPage.tsx:99
- **SOW rows:** 128
- **Acceptance (UI):**
  1. For each upload screen: choose a .xlsx file
  2. Expect file accepted and parsed (not "unsupported type")
  3. Download template link gives .xlsx with required headers

### RQ-CORE-022: Organisation masters (legal entities, plants, locations, departments, designations, grades, cost centres) are maintainable in the UI by authorised HR with audit; 14 legal entities seeded with India/foreign payroll flag.

- **Source:** docs/11 §0.2; docs/recon/ems-master-taxonomy.md; QA REPORT (no org-master API)
- **PRD:** CORE-01
- **Roles:** hr_head, super_admin, it_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** Read-only GET /core/companies|departments|locations|designations|grades (backend/src/modules/core/core.router.ts); frontend/src/pages/admin/AttendanceMastersPage.tsx covers shifts/holidays only
- **Acceptance (UI):**
  1. Admin > Masters: add designation "Junior Graduate Engineer" to RML
  2. Expect it in employee edit dropdown
  3. Deactivate a location: hidden from new assignments, history kept
  4. Entities list shows 14 entities; foreign ones marked non-India payroll

### RQ-CORE-023: Company statutory identifiers (PAN, TAN, GSTIN, PF establishment code, ESIC code, PT registration) are stored per entity and printed on statutory files and payslip footers.

- **Source:** SCHEMA_AUDIT S-24; docs/10
- **PRD:** PAY-09..13
- **Roles:** payroll_admin, hr_head
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** All 13 companies NULL statutory ids (SCHEMA_AUDIT S-24); no UI
- **SOW rows:** 168
- **Acceptance (UI):**
  1. Admin > Entities > RML: enter TAN/PF code/ESIC code
  2. Generate ECR: header carries PF establishment code
  3. Generate payslip: footer shows company PAN/TAN

### RQ-CORE-024: Previous employment details (employer, dates, last CTC, PF/UAN transfer) captured during onboarding.

- **Source:** SOW row 31 (3.2)
- **PRD:** CORE-01
- **Roles:** hr_ops, candidate
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** No previous-employment fields found (grep)
- **SOW rows:** 31
- **Acceptance (UI):**
  1. Open prejoin link as candidate
  2. Fill Previous employment section (2 employers)
  3. Submit; HR review shows the entries; converted employee profile shows them

### RQ-CORE-025: Employees can update their own family/nominee details through ESS, routed to HR for approval before the master changes.

- **Source:** Agreement Tracker ESS row ("employees unable to update family details"); SOW row 165
- **PRD:** CORE-01
- **Roles:** employee, hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** core.employee_family and core.profile_change_requests unreferenced in code (SCHEMA_AUDIT S-23)
- **SOW rows:** 165
- **Acceptance (UI):**
  1. Log in as employee
  2. Me > Family > Add spouse with DOB > Submit
  3. Expect "Pending HR approval"
  4. Log in as hr_ops > Approvals: approve
  5. Employee profile shows new family member; audit row written

### RQ-CORE-026: Role-based in-app help: quick guides per role, teaching empty states, printable short training material per module.

- **Source:** docs/01 CORE-14; Temp Copy PainPoint (ESS admin training)
- **PRD:** CORE-14
- **Roles:** all
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** Empty states in frontend/src/pages/_shared/ModuleState.tsx; no guides
- **Acceptance (UI):**
  1. Log in as manager
  2. Open Approvals with no items: empty state explains what will appear and how
  3. Help link on page opens manager quick guide

### RQ-CORE-027: Employee directory search/filter by name, e-code, department, location, entity, status, with Excel export of the filtered list.

- **Source:** docs/05 §4.2; docs/01 RPT-06
- **PRD:** CORE-01
- **Roles:** hr_ops, manager (own tree)
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** frontend/src/pages/people/DirectoryPage.tsx, /employees/facets; export not evidenced
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. People: filter Department=ERP-CELL, Status=Active
  3. Export: .xlsx with same rows
  4. Log in as manager: directory scope limited to permitted population for sensitive columns

### RQ-CORE-028: Statutory identifiers UAN, PF number, ESIC IP number, PAN, Aadhaar, bank account + IFSC are captured on the master for every India-payroll employee.

- **Source:** docs/01 CORE-07; PainPoint PP-3/PP-4
- **PRD:** CORE-07
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** columns exist on core.employees; no edit UI (see RQ-CORE-002)
- **SOW rows:** 8
- **Acceptance (UI):**
  1. Open employee profile > Statutory: all 7 fields present and editable by HR (when edit exists)
  2. Missing UAN for PF member flagged in a data-quality report

## RBAC Roles, scope & audit

### RQ-RBAC-001: Role catalogue seeded: employee, manager (derived), senior_manager (derived), hr_ops, hr_head, payroll_admin, plant_head, ceo_cell, it_admin, super_admin.

- **Source:** docs/08 §1
- **PRD:** CORE-10
- **Roles:** super_admin
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** backend/src/core/rbac/seed-data.ts
- **SOW rows:** 9
- **Acceptance (UI):**
  1. Admin > Users & roles: role list shows the 10 roles with descriptions

### RQ-RBAC-002: HOD (Head of Department) role exists; an HOD can view and approve requests for employees of their own department only (across that department's teams).

- **Source:** User context (HODs approve within their department); EMS hod_id field (docs/recon/ems-master-taxonomy.md); TE-07 chain RM -> HOD
- **PRD:** CORE-10
- **Roles:** HOD
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No hod role in backend/src/core/rbac/seed-data.ts; no department-head approver type in backend/src/modules/workflows/workflow-approvers.ts (only reporting_manager, functional_manager, role:, user:). Column core.employees.hod_employee_id exists (migrations/1752160000000_employee-hod.ts) but no code reads it
- **SOW rows:** 9
- **Acceptance (UI):**
  1. Assign HOD role to user X for department ERP-CELL
  2. Employee in ERP-CELL applies for leave/travel advance routed to HOD step
  3. Log in as X: request visible in Approvals; approve works
  4. Employee in another department: X cannot see or act (403/404)

### RQ-RBAC-003: GROUP-level roles: hr_head, super_admin and ceo_cell see and act across all legal entities (RML, RGH, RDL, future entities) without per-entity reassignment.

- **Source:** User context; docs/08 §1 (ceo_cell employee.read global, hr_head full-company scope)
- **PRD:** CORE-10
- **Roles:** hr_head, super_admin, ceo_cell
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** Group = role with no scope_org_unit_id: backend/src/core/rbac/permissions.service.ts:63, company-scope.ts (uncommitted), backend/tests/group-entity-scope.integration.test.ts (untracked)
- **SOW rows:** 9
- **Acceptance (UI):**
  1. Log in as hr_head (role assigned with no org unit)
  2. People: filter Entity=RGH and Entity=RML: both visible
  3. Payroll runs list: runs of all entities visible
  4. Create a new entity "Rashmi Rare Earth": immediately visible to hr_head without config change

### RQ-RBAC-004: ENTITY-scoped roles (hr_ops, payroll_admin, plant_head, it_admin) are confined to their assigned entity/plant/org unit; cross-entity records are invisible (404) and un-actionable (403).

- **Source:** User context; QA BETA B-16 (RML hr_ops acted on RGH lifecycle)
- **PRD:** CORE-10
- **Roles:** hr_ops, payroll_admin, plant_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** company-scope.ts requireRunInScope; B-16 open in QA REPORT; fix in progress (uncommitted separation.router.ts)
- **SOW rows:** 9
- **Acceptance (UI):**
  1. Log in as RML-scoped hr_ops
  2. People: RGH employees not listed; open /people/RGH000001 -> not found
  3. Lifecycle: RGH separation not listed; direct API act -> 403
  4. Payroll: RGH run not listed

### RQ-RBAC-005: Managers see and act only on their reporting tree (direct + indirect), including multi-level subtree reads (e.g. everyone under managers reporting to Kinjal).

- **Source:** docs/01 CORE-10; Latest Update in Protiviti (Kinjal queries)
- **PRD:** CORE-10
- **Roles:** manager, senior_manager
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** core.reporting_tree; backend/src/modules/workflows/workflow-access.ts; backend/src/modules/reports/muster.service.ts
- **SOW rows:** 9
- **Acceptance (UI):**
  1. Log in as senior_manager
  2. Team/Muster: shows direct reports and their reports
  3. Open an employee outside the tree: 404
  4. Approve a leave of a grand-report only if chain step is theirs

### RQ-RBAC-006: ceo_cell sees aggregate compensation only (dashboards/KPIs), never individual salaries, payslips or bank details.

- **Source:** docs/08 §2 (aggregate-only compensation); QA BETA B-13 (CEO sees individual salaries)
- **PRD:** CORE-10
- **Roles:** ceo_cell
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** B-13 in QA REPORT; seed-data.ts compensation grants; verify after fix commit 2ddd422
- **SOW rows:** 9
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: average CTC by level visible
  3. Open an employee profile: compensation/bank sections hidden
  4. Call payslip/register screens: 403

### RQ-RBAC-007: it_admin manages users, devices, settings but has no access to compensation, payslips or bank data.

- **Source:** docs/08 §2
- **PRD:** CORE-10
- **Roles:** it_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** seed-data.ts; QA beta it_admin 13 pass/2 fail
- **Acceptance (UI):**
  1. Log in as it_admin
  2. Admin > Users: can reset password/unlock
  3. Open /payroll or an employee compensation tab: 403/hidden

### RQ-RBAC-008: Access-control matrix (role x module x action x scope) is viewable and exportable to Excel for audit (Protiviti-style).

- **Source:** docs/01 CORE-10; Pending Implementation (access matrix not received)
- **PRD:** CORE-10
- **Roles:** super_admin, hr_head, it_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** GET /rbac/matrix (backend/src/modules/rbac/rbac.router.ts); frontend/src/pages/admin/AccessControlPage.tsx; export not evidenced
- **Acceptance (UI):**
  1. Admin > Access control: matrix grid renders
  2. Click Export: .xlsx with one row per role-permission-scope

### RQ-RBAC-009: Segregation of duties: nobody approves their own request; delegation to a subordinate or to the requester is blocked.

- **Source:** QA BETA B-03; docs/08 §4
- **PRD:** WF-01
- **Roles:** manager, employee
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** Fix commit 2ddd422 (SoD); backend/src/modules/workflows/workflow-approvers.ts excludes subject; needs re-test
- **Acceptance (UI):**
  1. Log in as manager > Approvals > Delegations: delegate to own report
  2. Expect error "cannot delegate to someone in your reporting line" (or report cannot approve own leave)
  3. Employee never sees own request as approvable

### RQ-RBAC-010: Field-level audit log for every create/update/delete of master, compensation, attendance overrides, leave, loans, separations (who, when IST, old->new, reason); tamper-evident and exportable.

- **Source:** docs/01 CORE-11; SCHEMA_AUDIT S-08/S-40 (no audit rows for loans, separations, leave)
- **PRD:** CORE-11
- **Roles:** hr_head, super_admin, it_admin (no comp values)
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /audit, /audit/verify, /audit/export (backend/src/modules/audit/audit.router.ts); missing audit writes for loans/separations/leave per SCHEMA_AUDIT S-40
- **SOW rows:** 139
- **Acceptance (UI):**
  1. Perform: attendance override, loan approval, separation approval, salary revision
  2. Admin > Audit: filter each entity, expect a row each with old/new
  3. Click Verify chain: "intact"
  4. Export .xlsx

### RQ-RBAC-011: Payroll finalisation requires payroll_admin to compute and an hr_head co-sign; ceo_cell is read-only and cannot approve/finalise.

- **Source:** docs/08 §2 & §4 (finalize = payroll_admin + hr_head co-sign); docs/14 §3
- **PRD:** PAY-18
- **Roles:** payroll_admin, hr_head, ceo_cell
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** Hard-coded role check allows ceo_cell to co-sign: backend/src/modules/payroll-core/runs/run.service.ts:200-206 (violates AGENTS rule "no role strings in handlers")
- **Acceptance (UI):**
  1. Log in as payroll_admin: compute and submit run for approval
  2. Try Finalize as payroll_admin alone: blocked "co-sign required"
  3. Log in as hr_head: approve -> finalize enabled
  4. Log in as ceo_cell: Approve/Finalize buttons absent; API 403

### RQ-RBAC-012: Permission-gated navigation: each role sees only the nav items in docs/08 §3; direct URL to a gated page shows 403 page, not data.

- **Source:** docs/08 §3; QA BETA crawl
- **PRD:** CORE-10
- **Roles:** all roles
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** frontend/src/app/nav-config.ts; QA beta crawl 57 routes
- **Acceptance (UI):**
  1. Log in as each role
  2. Compare visible nav pills with docs/08 nav table
  3. Type a gated URL (e.g. /payroll as employee): 403 screen, no data requests succeed

### RQ-RBAC-013: Leadership dashboards are read-only (no mutation controls) for plant_head and ceo_cell.

- **Source:** docs/01 CORE-10
- **PRD:** CORE-10
- **Roles:** plant_head, ceo_cell
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** pack24 readonly authority repair
- **Acceptance (UI):**
  1. Log in as plant_head
  2. Open dashboards/reports: no edit/approve controls except approvals routed to them

## NFR Security, reliability & UX

### RQ-NFR-001: Login with e-code (or email) + password; lockout with capped backoff after repeated failures; same error for unknown user and bad password.

- **Source:** docs/01 NFR-03; docs/02 §8; pack25
- **PRD:** NFR-03
- **Roles:** all
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** backend/src/modules/auth/auth.service.ts, auth.policy.ts (pack25)
- **SOW rows:** 9
- **Acceptance (UI):**
  1. Login page: wrong password 5x -> "Invalid…" then lockout message
  2. Unknown user gives identical message
  3. Correct password after backoff succeeds

### RQ-NFR-002: Single-use refresh tokens; logout revokes only the current session; protected URL after logout shows sign-in.

- **Source:** docs/02 §8 NFR-03 amendment (sponsor 16 Oct 2026)
- **PRD:** NFR-03
- **Roles:** all
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** backend/src/modules/auth/auth.sessions.ts
- **Acceptance (UI):**
  1. Log in on two browsers
  2. Log out in one
  3. Other browser still works; first browser back button -> sign-in form

### RQ-NFR-003: Forgot/reset password by email link (time-limited, single-use); admin can reset/unlock a user.

- **Source:** docs/01 NFR-03
- **PRD:** NFR-03
- **Roles:** employee, it_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /auth/forgot-password, /auth/reset-password; delivery depends on SMTP (unproven)
- **Acceptance (UI):**
  1. Login > Forgot password > enter e-code
  2. Email arrives with link (SMTP configured)
  3. Set new password; old link reuse fails
  4. it_admin: Admin > Users > Reset password works

### RQ-NFR-004: Sensitive identifiers (Aadhaar, bank account, PAN) masked in UI/exports for roles without sensitive permission; encrypted at rest.

- **Source:** docs/01 CORE-11, NFR; PAYROLL_TEST_REPORT P-33
- **PRD:** NFR-03
- **Roles:** hr_ops, manager, employee
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** Payslip masks PAN/UAN/bank (payslip/template.service.ts); Aadhaar plain (P-33)
- **Acceptance (UI):**
  1. Log in as manager: team member profile shows masked Aadhaar/bank
  2. Log in as payroll_admin: full bank for bank file only
  3. DB/export review: Aadhaar not plain

### RQ-NFR-005: Every tabular report and list exports to Excel (.xlsx) with on-screen filters applied.

- **Source:** docs/01 RPT-06; PainPoint (AR/OD Excel)
- **PRD:** RPT-06
- **Roles:** hr_ops, managers
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** /reports/*/export endpoints (backend/src/modules/reports/reports-export.service.ts)
- **SOW rows:** 139, 143
- **Acceptance (UI):**
  1. Open each report R2-R31 and Muster
  2. Apply a filter
  3. Export: .xlsx rows equal on-screen rows

### RQ-NFR-006: Daily-loop actions take ≤ 2 clicks: approve a request (inline from list), regularize a day, download muster, open an employee, open payslip.

- **Source:** docs/05 §3, §6, §8
- **PRD:** NFR
- **Roles:** manager, employee
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** frontend/src/pages/approvals/ApprovalsPage.tsx
- **Acceptance (UI):**
  1. Manager: from any page click Approvals badge (1) then Approve on row (2) -> done
  2. Employee: My Attendance > day > Regularize opens drawer prefilled

### RQ-NFR-007: Warm Editorial design language only (cream canvas, charcoal hero card, gold accent, pill nav), WCAG AA contrast, touch targets ≥44px on ESS, light/dark themes.

- **Source:** docs/05, docs/12; AGENTS.md
- **PRD:** NFR
- **Roles:** all
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** frontend/src/ui; pack32 both-theme axe
- **Acceptance (UI):**
  1. Visual review of each page against docs/12 patterns
  2. axe check: no AA violations
  3. Mobile width 390px: ESS actions reachable, targets ≥44px

### RQ-NFR-008: Scale: provision for ~3,000 on-roll, architected for 10,000 without rewrite; p95 page/API latency targets per docs/14.

- **Source:** docs/02; docs/14; sponsor 6 Jul 2026
- **PRD:** NFR-01/02
- **Roles:** it_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** docs/recon/scale-spike; not proven in production-like env (launch-readiness HANDOFF)
- **Acceptance (UI):**
  1. Load test with 10k employees x 1 month swipes
  2. Muster build and payroll compute complete within docs/14 targets

### RQ-NFR-009: Backups: off-box base backup + WAL/PITR with a rehearsed restore drill before payroll go-live.

- **Source:** docs/14 §10; plans/phase-2 hard preconditions
- **PRD:** NFR-08
- **Roles:** it_admin
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No evidence (plans/launch-readiness/03-PHASE-STATUS.md Phase 0 open)
- **Acceptance (UI):**
  1. IT shows last backup timestamp and a restore-drill record with checksum/audit verification

### RQ-NFR-010: Attendance swipe ingestion lag ≤ 5 minutes; device offline alerting to IT and HR ops.

- **Source:** docs/01 ATT-01/02, NFR
- **PRD:** ATT-01/02
- **Roles:** it_admin, hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** kent-sync job every 5 min; no real adapter (pack31); frontend/src/pages/attendance/DeviceHealthPage.tsx
- **SOW rows:** 51
- **Acceptance (UI):**
  1. Stop a device feed for > configured window during shift
  2. Device Health shows device red; IT + HR ops notified

### RQ-NFR-011: All times displayed and stored with IST attribution; business dates never shift by timezone.

- **Source:** SCHEMA_AUDIT S-25/S-28; docs/14
- **PRD:** NFR
- **Roles:** all
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** core/dates.ts; 34 toISOString().slice(0,10) occurrences (SCHEMA_AUDIT S-25)
- **Acceptance (UI):**
  1. Create a request at 23:50 IST
  2. Expect the same calendar date in UI, exports and DB work_date

### RQ-NFR-012: Money computed in integer paise; no float; every payroll diff gets human review; deterministic re-compute of an unchanged run yields identical register.

- **Source:** docs/14 §7; AGENTS.md
- **PRD:** NFR
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/core/money; backend/src/modules/payroll-core/engine
- **Acceptance (UI):**
  1. Compute a run twice without input change
  2. Expect identical register checksum

### RQ-NFR-013: Mobile/PWA surface for ESS home, apply leave/AR/OD, payslip, and geo check-in.

- **Source:** docs/05 §4.9; docs/01 ATT-14
- **PRD:** NFR
- **Roles:** employee
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** frontend/src/app/BottomBar.tsx; no geo check-in route
- **Acceptance (UI):**
  1. Open site on phone
  2. Install prompt / responsive bottom bar
  3. Apply leave and view payslip without horizontal scroll

## ATT Attendance & time

### RQ-ATT-001: Automated scheduled ingestion of Kent/Astra swipes (≤5 min) via a verified adapter; never fabricate punches.

- **Source:** docs/01 ATT-01; docs/02 §4; pack31; SOW rows 49,51,52
- **PRD:** ATT-01
- **Roles:** it_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** kent-connector.ts/kent-sync.job.ts: fail-closed guard (pack31); real Kent adapter/protocol not available (sponsor to supply)
- **SOW rows:** 10, 49, 51, 52
- **Acceptance (UI):**
  1. Admin triggers Sync with adapter configured
  2. New swipes appear in Swipe report (R2) within 5 min
  3. With adapter unconfigured: sync returns "not configured" and writes nothing

### RQ-ATT-002: Raw swipe events are stored immutably exactly as received with the 17 EmployeeSwipeDetails fields (employee no, name, access card, shift, swipe date, door/address, longitude, latitude, location type, mobile device name/id, swipe type, status, remarks, permission reason, signed in/out by, received on).

- **Source:** PainPoint/EmployeeSwipeDetails.xlsx; docs/01 ATT-01
- **PRD:** ATT-01
- **Roles:** hr_ops, it_admin
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** att.swipe_events append-only trigger (SCHEMA_AUDIT §1); /reports/r2-swipes/raw
- **SOW rows:** 49, 52
- **Acceptance (UI):**
  1. Reports > Swipes (R2) > Raw: columns include door, swipe type, received-on, lat/long
  2. Attempt to edit a raw swipe via any UI: no control; DB trigger rejects UPDATE

### RQ-ATT-003: Unmatched swipes (unknown card/employee) are quarantined, listed and re-ingestable after mapping; nothing silently dropped.

- **Source:** docs/02 §4; plans 02
- **PRD:** ATT-02
- **Roles:** hr_ops, it_admin
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** /attendance/exceptions/unmatched, /quarantined/reingest; frontend/src/pages/attendance/ExceptionsPage.tsx
- **Acceptance (UI):**
  1. Attendance > Exceptions > Unmatched: list shows card no, door, time
  2. Map card to employee > Re-ingest
  3. Day recomputed for that employee

### RQ-ATT-004: Per-device watermark, gap detection and backfill; whole-day Absent held until device sync is complete for that date.

- **Source:** docs/01 ATT-02; docs/14 §8; recon greythr-attendance
- **PRD:** ATT-02
- **Roles:** hr_ops, it_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /attendance/finalization-holds; recon notes HD not gated like A
- **SOW rows:** 51
- **Acceptance (UI):**
  1. Simulate device offline for a day
  2. Employees mapped to that door show "held", not Absent
  3. After backfill, statuses resolve

### RQ-ATT-005: First-In / Last-Out is the attendance basis for multi-swipe days.

- **Source:** docs/01 ATT-18; PainPoint PP-v2-2
- **PRD:** ATT-18
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** backend/src/modules/attendance/day-status.service.ts
- **SOW rows:** 67
- **Acceptance (UI):**
  1. Employee has swipes 08:55, 13:10, 14:00, 18:05
  2. Day detail shows In 08:55, Out 18:05, worked hours from FILO

### RQ-ATT-006: Cross-plant swipes are valid attendance; reports show the mapped cost centre; reconciliation flag for habitual off-plant swiping.

- **Source:** docs/01 ATT-16; Temp Copy PainPoint (cross-plant punching vs cost centre)
- **PRD:** ATT-16
- **Roles:** hr_ops, plant_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** attendance counts any door; reconciliation flag not evidenced
- **Acceptance (UI):**
  1. Employee mapped to Seamless swipes at DIP-6
  2. Day counted Present; muster shows mapped cost centre
  3. Exception report flags employees swiping elsewhere > N days

### RQ-ATT-007: Shift definitions: fixed, rotational, flexible, night (cross-midnight), two-session split (G5 09:00-13:30 / 13:31-18:00) and GCS Saturday half-day; every time/grace/threshold editable and audited.

- **Source:** docs/01 ATT-04/05; docs/09 §4; SOW row 47
- **PRD:** ATT-04
- **Roles:** hr_head, hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /attendance/config/shifts; att.shift_patterns/rotation tables unused (SCHEMA_AUDIT S-23)
- **SOW rows:** 3, 47
- **Acceptance (UI):**
  1. Admin > Attendance masters > Shifts: create NIGHT 22:00-06:00
  2. Swipes 21:55 and next-day 06:10 attribute to shift start date
  3. Edit G5 grace minutes: audit row written

### RQ-ATT-008: Per-employee weekday/Saturday attendance scheme assignment (e.g. GCS Saturday scheme).

- **Source:** docs/09 §4; docs/13 shift catalog
- **PRD:** ATT-04
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** /attendance/config/schemes/{employeeId}; backend/src/modules/attendance/scheme.service.ts
- **SOW rows:** 47
- **Acceptance (UI):**
  1. Attendance masters > Schemes: assign GCS Saturday to employee
  2. Saturday computed as half-day scheme

### RQ-ATT-009: Roster maintained by reporting managers (not only HR) with a monthly deadline (by the 5th) and reminders before the deadline.

- **Source:** docs/01 ATT-04; Agreement 4.1b (managers cannot update shifts; roster by 5th)
- **PRD:** ATT-04
- **Roles:** manager, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /attendance/roster; roster reminder job runs 09:00 on the 5th (backend/src/jobs/worker.ts:179), i.e. on deadline day not before
- **SOW rows:** 48
- **Acceptance (UI):**
  1. Log in as manager
  2. My team > Roster: assign shifts for next month, save
  3. Before 5th: reminder email/in-app to managers with incomplete rosters
  4. After lock: change requires HR

### RQ-ATT-010: Day statuses: Present, Absent, Half-day, Week-off, Holiday, Leave (by type), OD, Comp-off, UAB; two-session days show A:P / P:A / P:O glyphs and count A:P/P:A as half-day present.

- **Source:** docs/01 ATT-05; recon greythr-attendance; pack26 (sponsor 16 Oct)
- **PRD:** ATT-05
- **Roles:** employee, hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/attendance/session-status.ts, day-status.service.ts; thresholds unconfirmed (plans 08 D05)
- **Acceptance (UI):**
  1. Employee present only afternoon on G5 shift
  2. My Attendance day shows "A:P", half-day present
  3. Muster shows A:P glyph and 0.5 in P total

### RQ-ATT-011: Late-coming and early-leaving minutes computed per policy grace; automated late/early reports.

- **Source:** docs/01 ATT-05; SOW row 53
- **PRD:** ATT-05
- **Roles:** hr_ops, manager
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** R4 exceptions; grace/penalty rules not recovered from tenant (recon)
- **SOW rows:** 53
- **Acceptance (UI):**
  1. Employee in at 09:20 on 09:00 shift with 10-min grace
  2. Day shows late 20 (or 10 per rule) min
  3. Exceptions report (R4) lists the day; export works

### RQ-ATT-012: Attendance policy enforcement: minimum working hours, grace period, break-time tracking, penalty days for violations (configurable).

- **Source:** SOW rows 67,68; docs/04 §1
- **PRD:** ATT-05/09
- **Roles:** hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** thresholds in shifts; penalty rule engine not evidenced (D05)
- **SOW rows:** 3, 67, 68
- **Acceptance (UI):**
  1. Configure min full-day 8h, half-day 4h
  2. Employee works 5h: half-day
  3. N late marks in month -> configured penalty (e.g. half-day LOP) applied and visible

### RQ-ATT-013: Attendance Regularization (AR) for whole day or first/second half, with reason, routed to approver; Excel-exportable AR report.

- **Source:** docs/01 ATT-06; pack26; PainPoint (AR/OD Excel)
- **PRD:** ATT-06
- **Roles:** employee, manager, hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /attendance/requests; frontend/src/pages/attendance/AttendanceRequestDrawer.tsx; /reports/r3-regularizations/export
- **Acceptance (UI):**
  1. Employee: My Attendance > absent day > Regularize > Second half > reason > Submit
  2. Manager: Approvals > approve
  3. Day becomes P for second half
  4. Reports > R3 regularizations > Export .xlsx shows the row with half

### RQ-ATT-014: Permission: short time-bounded exception (e.g. 2-hour personal permission) distinct from AR, with monthly limit.

- **Source:** docs/01 ATT-06; docs/09 §5
- **PRD:** ATT-06
- **Roles:** employee, manager
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** request kinds in backend/src/modules/attendance/regularization.service.ts
- **Acceptance (UI):**
  1. Employee applies Permission 2h on a date
  2. Manager approves
  3. Late minutes for that window waived; monthly count increments; exceeding limit blocked

### RQ-ATT-015: On-Duty (OD): future-dated applications allowed; remote/site staff supported; OD report exportable.

- **Source:** docs/01 ATT-07; Latest Update (Kinjal: future-date OD; remote staff can't apply OD)
- **PRD:** ATT-07
- **Roles:** employee, manager
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** backend/src/modules/attendance/regularization.service.ts (OD future allowed)
- **Acceptance (UI):**
  1. Employee applies OD for next Tuesday
  2. Submit succeeds
  3. Manager approves; that date shows OD on the day
  4. OD report export lists it

### RQ-ATT-016: Overtime auto-detected from swipes beyond shift end; daily OT summary to reporting manager.

- **Source:** docs/01 ATT-08; Protiviti Status 26 July (OT informed daily to RM)
- **PRD:** ATT-08
- **Roles:** manager
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** OT summary job 12:30 daily (jobs/worker.ts:154); frontend/src/pages/team/OtDecisionsPage.tsx; email delivery unproven
- **SOW rows:** 62, 63
- **Acceptance (UI):**
  1. Employee leaves 2h after shift end
  2. Next day: manager receives OT summary (in-app/email) listing employee, date, OT minutes
  3. My team > Overtime lists pending item

### RQ-ATT-017: Manager approves/rejects OT within 48 hours or it lapses automatically (configurable); lapsed OT not paid.

- **Source:** docs/01 ATT-08; Protiviti Status 26 July; Latest Update (OT 48h rule)
- **PRD:** ATT-08
- **Roles:** manager, hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /attendance/ot/decide, /attendance/ot/lapse-sweep; workflow overtime onBreach lapse (backend/src/modules/workflows/definitions.seed.ts:46-48)
- **SOW rows:** 64
- **Acceptance (UI):**
  1. OT item created at T
  2. Manager does nothing for 48h
  3. After lapse sweep: item status "Lapsed", not in payroll inputs
  4. Approve before 48h: status Approved, flows to payroll

### RQ-ATT-018: OT pre-approval: OT is payable only against a pre-approved OT plan/eligibility per employee (pre-approved policies); OT assignment for new employees.

- **Source:** SOW row 62 (0.5: automated application not possible); Pending Implementation (OT pre-approval); Latest Update (OT assignment to new employees)
- **PRD:** ATT-08
- **Roles:** manager, hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No pre-approval model; decision D06 open (plans/sow-completion/08)
- **SOW rows:** 62
- **Acceptance (UI):**
  1. HR marks employee OT-eligible / manager pre-approves OT for date range
  2. Detected OT within plan is approvable; OT outside plan flagged "not pre-approved"
  3. New joiner without OT assignment: OT not generated

### RQ-ATT-019: Approved OT flows to payroll at configured rate (OT payslip), or comp-off is offered where policy says (week-off/holiday work).

- **Source:** docs/01 ATT-08; SOW row 65; PAYROLL_TEST_REPORT (OT blocks run)
- **PRD:** ATT-08
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/engine/compute-engine.ts; OT rate conflict (docs/04 vs docs/10)
- **SOW rows:** 65, 77
- **Acceptance (UI):**
  1. Approve 4h OT in month
  2. Compute payroll: OT earning line = hours x configured rate
  3. OT payslip generated
  4. Week-off work: employee offered comp-off instead per policy

### RQ-ATT-020: Week-off eligibility: no paid week-off when UAB for all working days of the week; no paid week-offs if absent the whole month; configurable "must work ≥1 day in the week".

- **Source:** docs/01 ATT-09; Pending Implementation payroll sheet; Reports-Templates email
- **PRD:** ATT-09
- **Roles:** hr_head, payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** setting att.weekoff_min_worked_days (settings/seed.ts:96); backend/src/modules/attendance/day-status.service.ts; D05/D06 interpretation open
- **SOW rows:** 68
- **Acceptance (UI):**
  1. Employee UAB Mon-Sat
  2. Sunday shows unpaid WO (or A), not paid WO
  3. Employee works Wednesday only: Sunday paid WO
  4. Employee absent entire month: zero paid WO; payroll payable days reflect it

### RQ-ATT-021: Absenteeism engine: continuous-absence tracker; at 7 days (configurable) create a case and generate show-cause/warning letter through HR with template.

- **Source:** docs/01 ATT-10; PainPoint PP-7 (7-10 day absentee show-cause)
- **PRD:** ATT-10
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /attendance/absence-cases (+scan, letter, stage); absence scan job 00:30; QA: absence/letter scope failures (pack23)
- **SOW rows:** 54, 218
- **Acceptance (UI):**
  1. Employee absent 7 consecutive working days
  2. Attendance > Absence cases: case at stage Watch -> Show-cause
  3. Generate letter from template; letter archived on employee and visible in ESS

### RQ-ATT-022: Auto-alerts for absenteeism, late arrival, early departure and UAB to employee, up the hierarchy and HR as configured.

- **Source:** docs/01 ATT-11; Pending Implementation (UAB alerts across hierarchy & HR; regularization alerts)
- **PRD:** ATT-11
- **Roles:** employee, manager, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** notification queue exists; recipient matrix wf.event_subscriptions; delivery unproven
- **SOW rows:** 54
- **Acceptance (UI):**
  1. Configure UAB alert recipients = employee, RM, RM's manager, HR
  2. Employee UAB today
  3. All configured recipients receive notification with date and link

### RQ-ATT-023: Monthly manager attendance approval (attestation) precedes leave credit and payroll lock; missing approvals are visible and block lock.

- **Source:** docs/01 ATT-12; PainPoint PP-1 (leave credit failing)
- **PRD:** ATT-12
- **Roles:** manager, hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /attendance/manager-approvals; /attendance/month-lock/checklist; pack30
- **SOW rows:** 79
- **Acceptance (UI):**
  1. Manager: My team > Attendance approval for month > Approve
  2. HR: Month lock checklist shows managers pending
  3. Lock blocked until all approved or HR overrides with reason

### RQ-ATT-024: Holiday calendars by location/plant (and department where policy requires).

- **Source:** docs/01 ATT-13; SOW row 57
- **PRD:** ATT-13
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /attendance/config/holidays by location; department calendar not supported (D07)
- **SOW rows:** 57
- **Acceptance (UI):**
  1. Attendance masters > Holidays: add Durga Puja for Kharagpur plant only
  2. Kharagpur employees show H; Kolkata HO shows working day

### RQ-ATT-025: Sales/field staff mobile geo check-in (PWA) capturing GPS lat/long and location type into the same swipe store.

- **Source:** docs/01 ATT-14; PainPoint PP-21; ERP update (geo tracking in use)
- **PRD:** ATT-14
- **Roles:** employee (mobile mode)
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** No check-in route in attendance routers; schema columns exist
- **Acceptance (UI):**
  1. Employee with attendance_mode=mobile opens app on phone
  2. Tap Check in: location permission prompt, success with coordinates
  3. Swipe report shows source=mobile with lat/long

### RQ-ATT-026: Month-end attendance lock per entity+month; post-lock changes only via HR with reason + audit; locked data feeds payroll.

- **Source:** docs/01 ATT-15
- **PRD:** ATT-15
- **Roles:** hr_ops, hr_head, payroll_admin
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /attendance/month-lock; backend/src/modules/attendance/month-lock.service.ts; pack30
- **Acceptance (UI):**
  1. HR: Attendance > Month lock > RML Jun > Lock
  2. Employee tries AR for a locked date: blocked
  3. HR correction on locked day requires reason; audit row; payroll uses locked snapshot

### RQ-ATT-027: Managers can never directly edit day statuses (no "mark present"); they only approve employee-initiated AR/OD/OT.

- **Source:** docs/01 ATT-17; Temp Copy PainPoint ("We do not want anybody to have access to modify the attendance…")
- **PRD:** ATT-17
- **Roles:** manager
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** Manager direct edits 403 (pack23/29)
- **Acceptance (UI):**
  1. Log in as manager
  2. My team > day: no edit/override control
  3. Direct API override call returns 403

### RQ-ATT-028: Direct manual attendance override restricted to authorised HR (hr_ops in own entity) with mandatory reason and audit; locked days protected.

- **Source:** docs/01 ATT-17; pack29
- **PRD:** ATT-17
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /attendance/days/override; backend/src/modules/attendance/manual-status.service.ts (pack29)
- **Acceptance (UI):**
  1. HR: Attendance ops > employee day > Override to P with blank reason: blocked
  2. With reason: saved; audit has before/after
  3. Override on locked day: 409 conflict

### RQ-ATT-029: Attendance Muster in the June 2025 template: EmployeeNo, Name, Location, Designation, Manager No/Name, P/L/H/A/Off/Rest/OD/Unknown/Total, day columns, plus Reporting Manager, Emp ID and Cost Centre/Plant columns; Excel export.

- **Source:** docs/01 RPT-01; PainPoint/Attendance Muster June 2025; PP-5/8/9/25
- **PRD:** RPT-01
- **Roles:** hr_ops, manager, plant_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /reports/muster(+export) backend/src/modules/reports/muster.service.ts; frontend/src/pages/reports/MusterPage.tsx
- **SOW rows:** 69
- **Acceptance (UI):**
  1. Reports > Muster > month > Build
  2. Columns match template incl. RM, functional RM, cost centre
  3. Export .xlsx opens with same columns and glyphs (A:P etc.)

### RQ-ATT-030: Attendance/payroll cycle supports the client period 26th of previous month to 25th of current month (configurable cycle start day) for muster, lock and payroll.

- **Source:** PainPoint/Attendance Muster June 2025 (days 26 Mon … 25 Wed)
- **PRD:** ATT-15
- **Roles:** hr_head, payroll_admin
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** Muster uses calendar month: backend/src/modules/reports/muster.service.ts:72-73 (monthStart/nextMonthStart); no cycle setting
- **Acceptance (UI):**
  1. Settings: attendance cycle start = 26
  2. Muster for "June" shows 26 May - 25 Jun
  3. Lock and payroll inputs use the same window

### RQ-ATT-031: Attendance report with department, RM, contact and org-unit columns; long-absentee pivot by manager.

- **Source:** PainPoint row (attendance report with dept/RM/contact/OU); Attendance Muster pivot sheet
- **PRD:** RPT-01
- **Roles:** hr_ops, manager
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** R6 absence report exists
- **Acceptance (UI):**
  1. Reports > Absence (R6): columns dept, RM, contact, OU
  2. Group by manager: counts of long absentees

### RQ-ATT-032: Daily data recompute is idempotent for any date range until month lock; manual/regularised/locked days are protected from auto recompute.

- **Source:** docs/01 ATT-03
- **PRD:** ATT-03
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /attendance/recompute; recompute job each minute
- **Acceptance (UI):**
  1. Recompute last 7 days twice
  2. Day records unchanged on second run
  3. Regularised day keeps P after recompute

### RQ-ATT-033: Sync/attendance mismatch reconciliation (e.g. 200+ mismatches when Kent offline): list employees whose processed status disagrees with device data, with fix workflow.

- **Source:** PainPoint (200+ attendance mismatch due to Kent offline)
- **PRD:** ATT-02
- **Roles:** hr_ops, it_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** finalization holds + quarantine; real Kent replay not tested
- **SOW rows:** 79
- **Acceptance (UI):**
  1. After a device outage: Exceptions shows affected employees/dates
  2. Backfill clears them; remaining listed for AR

### RQ-ATT-034: Remote/on-site employees who cannot punch get OD or comp-off path (no punch on-site comp-off).

- **Source:** Latest Update (Kinjal: on-site no-punch comp-off); docs/01 ATT-07
- **PRD:** ATT-07
- **Roles:** employee, manager
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** OD + comp-off flows exist separately
- **Acceptance (UI):**
  1. Employee on site Saturday (week-off) applies OD + comp-off claim
  2. Manager approves; comp-off credited

## LV Leave

### RQ-LV-001: Leave types configurable: CL, SL, EL (credited after 1 year of service; encashable), Comp-off (fractional), Election leave, LOP, Maternity (gender-restricted), Paternity, RH; per-type rules (accrual, max per request, carry-forward, encashment, sandwich).

- **Source:** docs/01 LV-01; docs/09 §1; Latest Update (EL after 1 year); SOW row 56
- **PRD:** LV-01
- **Roles:** hr_head, hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /leave/types; accrual_requires_service_months (backend/src/modules/leave/leave-core.service.ts:84-86)
- **SOW rows:** 56
- **Acceptance (UI):**
  1. Leave admin > Types: edit EL accrual-requires-service = 12 months
  2. Employee with 8 months service: EL balance 0 and not accrued
  3. Employee with 13 months: EL accrues monthly

### RQ-LV-002: Maternity leave available to female employees (gender vocabulary consistent between employee and leave type).

- **Source:** docs/01 LV-01; SCHEMA_AUDIT S-09 (0 of 3 females eligible); PAYROLL_TEST_REPORT (maternity gender bug)
- **PRD:** LV-01
- **Roles:** employee (female), hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** Gender mismatch F vs Female (SCHEMA_AUDIT S-09); fix commit b92b6d2 claims maternity fix - verify
- **SOW rows:** 56
- **Acceptance (UI):**
  1. Log in as female employee
  2. Apply leave: Maternity appears in type list; submit succeeds
  3. Male employee: Maternity not offered

### RQ-LV-003: Monthly leave credit runs automatically (1st, 00:05 IST) without human trigger; employees with unapproved attendance are queued and flagged, not silently skipped.

- **Source:** docs/01 LV-02; PainPoint PP-1 (leave credit failing)
- **PRD:** LV-02
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** leave accrual job (jobs/worker.ts:134 runs 18:35 UTC = 00:05 IST); D02 gating rule open
- **SOW rows:** 59
- **Acceptance (UI):**
  1. Wait for accrual job (or Leave admin > Run accrual for month)
  2. Balances increase by monthly rate
  3. Employee with pending attendance approval appears in "accrual blocked" list

### RQ-LV-004: Leave application with balance check, half-day support, holiday/week-off sandwich rules (configurable) and preview of days and remaining balance before submit.

- **Source:** docs/01 LV-03; QA BETA (leave apply PASS)
- **PRD:** LV-03
- **Roles:** employee
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** frontend/src/pages/leave/LeaveApplyDrawer.tsx; backend/src/modules/leave/leave-apply.service.ts
- **SOW rows:** 58
- **Acceptance (UI):**
  1. My Leave > Apply > CL 21-22 Oct
  2. Drawer shows 2 days and remaining balance
  3. Apply 1.5 days with half-day end: accepted
  4. Apply more than balance: blocked with message

### RQ-LV-005: Leave approval is multi-level as configured (default RM -> HR per docs/08 chain); approver sees balance and team calendar.

- **Source:** docs/01 LV-03; docs/08 §4 (Leave RM->HR); SOW row 58
- **PRD:** LV-03
- **Roles:** manager, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** Seed leave chain is RM only (backend/src/modules/workflows/definitions.seed.ts:26) - HR step not configured
- **SOW rows:** 58
- **Acceptance (UI):**
  1. Employee applies leave
  2. Manager approves step 1
  3. HR ops sees step 2 and approves
  4. Ledger debit posted only after final approval

### RQ-LV-006: Comp-off: earned from approved week-off/holiday work (auto-suggested from swipes), with expiry window, applied like leave; application actually works.

- **Source:** docs/01 LV-04; PainPoint (comp-off application broken)
- **PRD:** LV-04
- **Roles:** employee, manager
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** workflow comp_off; /leave/comp-off/expire job
- **SOW rows:** 63
- **Acceptance (UI):**
  1. Employee works on Sunday
  2. Comp-off suggestion appears; employee claims; manager approves
  3. Comp-off balance +1, expires after configured days (expiry job)
  4. Apply comp-off leave: succeeds

### RQ-LV-007: Immutable leave ledger (credit, debit, lapse, encash, adjustment); balance = sum of ledger; HR adjustments require reason.

- **Source:** docs/01 LV-05
- **PRD:** LV-05
- **Roles:** hr_ops, employee
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /leave/ledger, /leave/adjustments; lv.ledger append-only
- **SOW rows:** 59
- **Acceptance (UI):**
  1. Leave admin > Adjust balance +2 with reason
  2. Employee ledger shows adjustment line with actor
  3. No edit/delete on ledger rows

### RQ-LV-008: Employee-initiated leave encashment request with its own approval workflow (RM -> HR ops -> payroll); encashed amount flows to payroll.

- **Source:** docs/01 LV-06; docs/09 §10.2; SOW row 60
- **PRD:** LV-06
- **Roles:** employee, manager, hr_ops, payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /leave/encashments; workflow leave_encashment; payroll consumption not proven (D06 clamp)
- **SOW rows:** 60
- **Acceptance (UI):**
  1. Employee: My Leave > Encash 5 EL > submit
  2. Approvals through 3 steps
  3. Next payroll shows encashment earning; EL balance -5

### RQ-LV-009: Leave encashment computed in F&F per policy.

- **Source:** docs/01 LV-06, PAY-15
- **PRD:** LV-06
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/fnf/fnf-engine.ts
- **SOW rows:** 60
- **Acceptance (UI):**
  1. Separation with 12 EL balance > Compute F&F
  2. F&F shows EL encashment = 12 x per-day rate per policy

### RQ-LV-010: Leave cancellation of an approved leave routes for re-approval and reverses ledger debit; cancelled future days revert to their computed status (not Absent).

- **Source:** docs/01 LV-08; QA BETA B-12; SCHEMA_AUDIT S-10
- **PRD:** LV-08
- **Roles:** employee, manager
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /leave/applications/{id}/cancel; B-12/S-10 future A rows
- **SOW rows:** 58
- **Acceptance (UI):**
  1. Employee cancels approved leave for next week
  2. Manager approves cancellation
  3. Ledger shows reversal; future dates show no status / scheduled (not A)

### RQ-LV-011: Restricted Holidays: publish optional holiday list; employee selects up to N per year with approval; approved RH marks the day as holiday.

- **Source:** docs/01 LV-09
- **PRD:** LV-09
- **Roles:** hr_ops, employee, manager
- **Priority:** P2
- **Status:** **Done**
- **Evidence:** /leave/restricted-holidays(+select); workflow restricted_holiday
- **Acceptance (UI):**
  1. HR publishes RH list (5 dates, max 2)
  2. Employee selects 1 -> manager approves -> day shows H
  3. Selecting a 3rd: blocked

### RQ-LV-012: Year-end leave processing: carry-forward caps, lapse and encashment per type.

- **Source:** SOW row 60; docs/04
- **PRD:** LV-05
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** /leave/year-end/run
- **SOW rows:** 60
- **Acceptance (UI):**
  1. Leave admin > Year-end run for 2026
  2. EL carried up to cap; excess lapsed with ledger lines
  3. CL lapsed fully

### RQ-LV-013: Leave dashboard and muster integration (leave columns in muster summary).

- **Source:** docs/01 LV-07
- **PRD:** LV-07
- **Roles:** hr_ops, manager
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** muster L column; dashboard tiles partial
- **Acceptance (UI):**
  1. Muster shows L count and leave-type glyphs per day
  2. Leave admin dashboard: on-leave today, pending approvals

## WF Workflow & notifications

### RQ-WF-001: Generic approval engine: named chains of steps (reporting manager, functional manager, department head, role, specific person) attachable to any request type, editable as configuration (no code change).

- **Source:** docs/01 WF-01; docs/14 §9; AGENTS.md (config over code)
- **PRD:** WF-01
- **Roles:** hr_head, super_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /workflows/definitions; approver types lack department head (HOD) and plant head-by-plant
- **Acceptance (UI):**
  1. Admin > Workflows > Leave: add step 2 = role hr_ops > Save
  2. New leave requests route RM -> HR ops
  3. Existing in-flight requests keep their frozen chain

### RQ-WF-002: Per-step actions approve / reject (reason mandatory) / send back for edit; employee can resubmit after send-back.

- **Source:** docs/01 WF-01; docs/11 (Yatra Avedan model)
- **PRD:** WF-01
- **Roles:** approvers, employee
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /workflows/requests/{id}/act, /resubmit
- **Acceptance (UI):**
  1. Manager sends back a leave with comment
  2. Employee edits and resubmits
  3. Manager approves; timeline shows all actions

### RQ-WF-003: Per-step SLA with time-based auto-escalation (to next level/role) on breach, per escalation matrix.

- **Source:** docs/01 WF-01/03; SOW row 211
- **PRD:** WF-03
- **Roles:** hr_ops, managers
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** WF escalation job hourly; /workflows/escalate
- **Acceptance (UI):**
  1. Configure 72h SLA escalate
  2. Leave pending 73h
  3. Request escalates to manager's manager (or configured role); both notified; timeline shows escalation

### RQ-WF-004: Delegation for absence (date-bounded), audited, with SoD checks.

- **Source:** docs/01 WF-01; QA B-03
- **PRD:** WF-01
- **Roles:** manager
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /workflows/delegations; B-03 fix in 2ddd422
- **Acceptance (UI):**
  1. Approvals > Delegations: delegate to peer manager 20-25 Oct
  2. Requests during window appear for delegate with "on behalf of"
  3. Delegation to own report blocked

### RQ-WF-005: Every workflow state change timestamped and visible as a timeline on the request.

- **Source:** docs/01 WF-04
- **PRD:** WF-04
- **Roles:** requester, approvers
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** frontend/src/pages/approvals/ApprovalRequestStatus.tsx
- **Acceptance (UI):**
  1. Open any request detail
  2. Timeline lists submit, each approval/send-back/escalation with actor and IST time

### RQ-WF-006: Notification service: in-app + email (SMTP), templated, queued with retry and dead-letter; delivery state recorded (not just "queued").

- **Source:** docs/01 WF-02; plans 08 D04; QA REPORT (no SMTP)
- **PRD:** WF-02
- **Roles:** it_admin, all
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/notifications/notifications.service.ts (SMTP transport + DevLog default); drain job each minute; no delivery receipts
- **SOW rows:** 16, 18
- **Acceptance (UI):**
  1. Configure SMTP
  2. Submit a leave
  3. Approver receives email + in-app item
  4. Break SMTP: notification retried, then dead-lettered and visible to IT

### RQ-WF-007: Per-event recipient matrix configurable (e.g. onboarding/exit -> HR + Business Head + CEO Cell; resignation -> every configured approver incl. HR Head).

- **Source:** docs/01 WF-02, LC-06; PainPoint PP-26; Reports-Templates email (Chaitanya never notified)
- **PRD:** WF-02
- **Roles:** hr_head, super_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** wf.event_subscriptions; backend/src/modules/workflows/seed.ts
- **Acceptance (UI):**
  1. Admin > Workflows/Notifications: event "separation.submitted" recipients = RM, HR Head
  2. Employee resigns
  3. HR Head (e.g. Chaitanya) receives notification and sees it in Approvals

### RQ-WF-008: Approvals inbox one click from anywhere with badge count; approve inline from the list.

- **Source:** docs/05 §3
- **PRD:** WF-01
- **Roles:** manager, hr roles
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** frontend/src/app/useInboxCount.ts; frontend/src/pages/approvals/ApprovalsPage.tsx
- **Acceptance (UI):**
  1. Masthead badge shows pending count
  2. Click: inbox lists items with key facts
  3. Approve inline; badge decrements

### RQ-WF-009: All-vacant approver round holds the request for HR routing repair (no implicit approval); HR can retry routing with a note.

- **Source:** Sponsor decision 16 Oct 2026 (plans 21, 32)
- **PRD:** WF-01
- **Roles:** hr_ops, hr_head
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** /workflows/routing-holds, retry-routing; frontend/src/pages/admin/RoutingHoldsPanel.tsx
- **Acceptance (UI):**
  1. Make an employee's RM inactive
  2. Employee applies leave
  3. Request shows "Waiting for HR"; HR routing holds queue lists it
  4. HR fixes RM, retries with note: request routes to new RM

### RQ-WF-010: HOD / department-head approver step type: resolves the HOD of the requester's department (from master) for travel advance, leave beyond N days, OT, offers as configured.

- **Source:** User context; docs/01 TE-07 (RM -> HOD -> Admin/Finance); EMS hod_id
- **PRD:** WF-01
- **Roles:** HOD
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No department-head resolver in backend/src/modules/workflows/workflow-approvers.ts; core.employees.hod_employee_id column exists (migration 1752160000000) but unused
- **Acceptance (UI):**
  1. Configure travel advance chain RM -> Department head
  2. Employee raises advance
  3. HOD of that department receives step 2; other HODs do not

### RQ-WF-011: Plant-head-by-plant approver step type (resolves the plant head for the employee's plant/entity), used in offer/LOI and transfer chains.

- **Source:** LOI_Approval_Process_Flowchart (RML1 Plant Head / RML6 GM)
- **PRD:** WF-01
- **Roles:** plant_head
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** plant_head appears in no chain (backend/src/modules/workflows/definitions.seed.ts)
- **Acceptance (UI):**
  1. Configure offer chain step 1 = Plant head of position's plant
  2. Offer for RML1 routes to RML1 plant head only

### RQ-WF-012: Exit/separation hierarchy cannot be bypassed and submitted dates are frozen after submission (except via approved change).

- **Source:** ERP QUICK UPDATE 8 Aug (exit module: date-submission freeze, hierarchy bypass); Latest Update
- **PRD:** LC-06
- **Roles:** employee, manager, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** QA B-10 (single RM approval finalises; HR head step 500); fix in progress separation.router.ts
- **SOW rows:** 40
- **Acceptance (UI):**
  1. Employee submits resignation with LWD
  2. Try editing LWD after submit: blocked
  3. Try HR ops approving before RM/HR head steps: blocked (QA B-10)

## PAY Payroll engine & register parity

### RQ-PAY-001: Salary components with formulas (earnings/deductions), dependency graph evaluation, effective-dated versions; structures by grade/level/location.

- **Source:** docs/01 PAY-01; SOW rows 12,13
- **PRD:** PAY-01
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /payroll/components, /payroll/structures(+preview) (backend/src/modules/payroll-core/structures/dag-evaluator.ts)
- **SOW rows:** 12, 13
- **Acceptance (UI):**
  1. Payroll > Structures: create "G1 Staff Baseline" with BASIC, HRA=50% BASIC, EDU 200, MED 1250, BONUS=8.33% BASIC, SPECIAL balancing
  2. Preview with gross 64,573: BASIC 32,286, HRA 16,143, BONUS 2,689, SPECIAL 12,005

### RQ-PAY-002: CTC auto-structuring from templates when assigning salary (onboarding and revision).

- **Source:** docs/01 PAY-01; SOW row 26; Pending Implementation (pay structure auto-config)
- **PRD:** PAY-01
- **Roles:** payroll_admin, hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /payroll/salaries/assign; frontend/src/pages/payroll/SalaryRevisionsPage.tsx; canonical initial salary open (pack33)
- **SOW rows:** 4, 14, 26
- **Acceptance (UI):**
  1. Salary revisions > Assign: enter annual CTC + structure
  2. Breakup auto-filled and sums to CTC
  3. Save -> effective salary history row

### RQ-PAY-003: Flexi-benefit basket and perquisites configurable where in policy (RML says flexi not in salary structure - scope decision).

- **Source:** SOW row 14, 27; Pending Implementation (flexi not in RML salary structure)
- **PRD:** PAY-01
- **Roles:** payroll_admin
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** No flexi code (grep); D10 decision
- **SOW rows:** 14, 27
- **Acceptance (UI):**
  1. If enabled: employee declares flexi split within limits; payroll pays components accordingly
  2. If out of scope: documented exclusion signed

### RQ-PAY-004: Probation salary automation: offer/LOI captures probation % (70/80/90); system applies probation breakup and auto-switches to full breakup on confirmation date.

- **Source:** docs/01 PAY-02; LOI flowchart; Pending Implementation (70/80/90 not reflecting in offer)
- **PRD:** PAY-02
- **Roles:** hr_ops, payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** probation_salary_pct in onboarding; /payroll/salaries/auto-switch-confirmation; duplicated probation % sources (SCHEMA_AUDIT S-26)
- **SOW rows:** 22, 34
- **Acceptance (UI):**
  1. Onboard candidate with probation 80%
  2. First payroll pays 80% of each component
  3. Confirm employee effective 1 Dec
  4. Dec payroll pays 100% without manual restructuring; salary history shows switch

### RQ-PAY-005: Monthly run pipeline: draft -> inputs locked -> computed -> reviewed -> approved -> finalized -> paid, each state audited, finalize immutable; back-to-draft before approval; reopen only with reason.

- **Source:** docs/01 PAY-03, PAY-18; SOW rows 72,74,81
- **PRD:** PAY-03
- **Roles:** payroll_admin, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/runs/run.router.ts (list/create/lockInputs/compute/review/approve/finalize/markPaid/returnToDraft/reopen); real console frontend/src/pages/payroll/PayrollPage.tsx (commit ba6e81d); QA B-07 (500s) pre-fix
- **SOW rows:** 74, 81
- **Acceptance (UI):**
  1. Payroll > New run RML Jun 2026
  2. Lock inputs (requires attendance lock)
  3. Compute; register preview
  4. Submit review -> hr_head approve -> Finalize
  5. After finalize: inputs/compute disabled; Reopen asks for reason; audit trail lists all transitions

### RQ-PAY-006: Register parity: for the June 2026 client register, every employee/component matches the register exactly (to the rupee); sample RML033625 BASIC 32,286, HRA 16,143, EDU 200, MED 1,250, BONUS 2,689, SPECIAL 12,005 (gross 64,573), PF 3,874, PT 200, canteen 1,375 -> net 59,124.

- **Source:** User context (payroll must exactly reproduce client register); hrms-test/payroll/PAYROLL_TEST_REPORT.md (11 MATCH / 33 MISMATCH); docs/09 G1
- **PRD:** PAY-18
- **Roles:** payroll_admin, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** QA run 11/44 match; fixes P-01..P-21 in commit b92b6d2 not yet re-verified; parallel-run backend/src/modules/payroll-core/parallel-run/
- **SOW rows:** 74, 81
- **Acceptance (UI):**
  1. Import June register (Parallel run > upload)
  2. Compute June run for same cohort
  3. Parallel run > Compare: 0 mismatches; RML033625 net 59,124
  4. Any variance shows component-level explanation

### RQ-PAY-007: Payroll inputs collection: new joiners, revisions, variable pay, deductions (canteen etc.), loans, advances, holds; Excel bulk upload with validation; only active employees accepted.

- **Source:** docs/01 PAY-03; SOW rows 72,93,128; Agreement extra rows
- **PRD:** PAY-03
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /payroll/runs/{runId}/inputs/upload accepts CSV only (commit ba6e81d)
- **SOW rows:** 72, 81, 128
- **Acceptance (UI):**
  1. Run > Inputs > Upload .xlsx with CANTEEN 1,375 for RML033625
  2. Preview validates e-code, active status, amount
  3. Apply: item shows deduction; re-upload same row flagged duplicate

### RQ-PAY-008: Duplicate input detection (same employee, component, period) on manual and bulk input.

- **Source:** SOW row 91
- **PRD:** PAY-03
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** inputs API; duplicate rule not evidenced
- **SOW rows:** 91
- **Acceptance (UI):**
  1. Add CANTEEN 1,375 twice for same employee/month
  2. Second add flagged as duplicate requiring confirmation or rejected

### RQ-PAY-009: Proration modes per entity policy: actual calendar days, calendar days less weekends, fixed 30/31 days; (calendar less alternate weekends / less holidays / varying fixed days marked not possible by vendor - scope decision); working-day logic per RML.

- **Source:** SOW rows 109-115; SOW payroll remark (working day logic corrected as per RML from Aug payroll); docs/10 §LOP
- **PRD:** PAY-04
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** proration.ts; LOP divisor decision D10 open
- **SOW rows:** 3, 109, 110, 111, 113, 114, 115
- **Acceptance (UI):**
  1. Settings: proration = calendar days
  2. Employee with 2 LOP days in 30-day month: deduction = 2/30 of monthly gross components
  3. Switch to fixed 30: Feb LOP uses /30

### RQ-PAY-010: Mid-month joiner and mid-month leaver prorated correctly; leaver not paid twice (regular + F&F).

- **Source:** SOW rows 103,104; PAYROLL_TEST_REPORT (leaver double pay)
- **PRD:** PAY-04
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** compute-engine.ts; fix b92b6d2 claims leaver guard
- **SOW rows:** 103, 104
- **Acceptance (UI):**
  1. Joiner DOJ 16 Jun gross 40,000: pay 15/30 (or per divisor)
  2. Leaver LWD 20 Jun: paid 20 days once (either regular or F&F, never both)

### RQ-PAY-011: LOP calculation, LOP reversal and previous-month LOP adjustment (arrear/recovery in current run).

- **Source:** SOW rows 105-107
- **PRD:** PAY-04/16
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** arrears.ts
- **SOW rows:** 105, 106, 107
- **Acceptance (UI):**
  1. May LOP 2 days later regularised
  2. June run shows LOP reversal earning for 2 days of May rate

### RQ-PAY-012: Salary revision arrears from effective date, component-wise; pre-go-live arrears via client-provided breakup.

- **Source:** docs/01 PAY-16; SOW rows 82,116
- **PRD:** PAY-16
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** arrears.ts; /payroll/salaries/history
- **SOW rows:** 82, 116
- **Acceptance (UI):**
  1. Revise salary effective 1 Apr, processed in Jun
  2. Jun run shows Apr+May arrears per component
  3. Pre-go-live period: arrear input accepted as upload

### RQ-PAY-013: Salary holds: payment hold (processed, payment withheld) and process hold (absconding - not processed); release in a later run.

- **Source:** docs/01 PAY-08; SOW rows 136,137
- **PRD:** PAY-08
- **Roles:** payroll_admin, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /payroll holds router (backend/src/modules/payroll-core/holds/)
- **SOW rows:** 136, 137
- **Acceptance (UI):**
  1. Place payment hold on employee for Jun
  2. Register includes employee, bank file excludes
  3. Release in Jul: Jul bank file includes held amount
  4. Process hold: employee excluded from compute

### RQ-PAY-014: Entity transfer mid-month: payroll split across entities with inputs, draft paysheet, register, bank file, payslip/tax planner, JV per entity; YTD carried.

- **Source:** SOW rows 95-101; docs/01 LC-05
- **PRD:** LC-05
- **Roles:** payroll_admin, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /lifecycle/transfers; QA: future transfer took effect immediately (B-18); payroll split not proven
- **SOW rows:** 95, 96, 97, 98, 99, 100, 101
- **Acceptance (UI):**
  1. Transfer employee RML -> RGH effective 16 Jun
  2. Jun RML run pays 1-15, RGH run pays 16-30
  3. Payslips from both entities; Form 16 combined YTD

### RQ-PAY-015: Intern/trainee payroll with statutory contributions as applicable; apprentices on stipend excluded from PF/ESI/PT/Bonus per Apprenticeship Act.

- **Source:** docs/01 PAY-14; SOW rows 141,142
- **PRD:** PAY-14
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/statutory/apprentice.ts
- **SOW rows:** 141, 142
- **Acceptance (UI):**
  1. Apprentice stipend 15,000: payslip shows no PF/ESI/PT/bonus
  2. Trainee: statutory applied per configuration

### RQ-PAY-016: Off-cycle payroll run (supplementary/correction/F&F/reimbursement) outside the monthly run.

- **Source:** Agreement Tracker extra row (off-cycle payroll); SOW row 187
- **PRD:** PAY-03
- **Roles:** payroll_admin, hr_head
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** run type off-cycle not exposed (only claims mention offcycle); unique (company,month,run_type) limits versions (D11)
- **Acceptance (UI):**
  1. Payroll > New run type Off-cycle for 3 employees
  2. Compute, approve, finalize; separate bank file and payslips

### RQ-PAY-017: Payroll lock: finalized months immutable; recompute requires unlock with reason; config changes never retro-apply into finalized months.

- **Source:** docs/01 PAY-18; commit ba6e81d (no retro into finalized months)
- **PRD:** PAY-18
- **Roles:** payroll_admin, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** run-state-machine.ts; payroll.run.reopen
- **Acceptance (UI):**
  1. Finalize Jun
  2. Change PT slab effective 1 Jun: finalized Jun unchanged; warning shown
  3. Reopen requires reason + hr_head; audit

### RQ-PAY-018: Parallel-run comparison against Protiviti/greytHR register during transition, component-level variance report, YTD import.

- **Source:** docs/01 PAY-18; docs/14 §7
- **PRD:** PAY-18
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /parallel-run importRegister (CSV), compareRun, loadYtd; frontend/src/pages/payroll/ParallelRunPage.tsx
- **SOW rows:** 5
- **Acceptance (UI):**
  1. Parallel run > Upload register .xlsx
  2. Compare: per-employee per-component diff, totals
  3. Export variance .xlsx

### RQ-PAY-019: Independent reconciliation: register totals recomputed via a second path must match to the paisa before finalize is enabled.

- **Source:** docs/14 §7.7
- **PRD:** PAY-18
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** run.router reconcile; reconciliation.service.ts
- **Acceptance (UI):**
  1. Compute run
  2. Reconcile shows engine total = SQL aggregate
  3. Inject mismatch (test): Finalize disabled

### RQ-PAY-020: Annual bonus (Payment of Bonus Act 8.33-20%, ₹21k eligibility, prorated) and monthly bonus component true-up.

- **Source:** docs/01 PAY-17; SOW row 184; PAYROLL_TEST_REPORT (bonus not prorated)
- **PRD:** PAY-17
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** annual.router calculateBonusTrueup; Agreement: annual bonus "no use case"
- **SOW rows:** 184
- **Acceptance (UI):**
  1. Annual > Bonus true-up for FY
  2. Eligible employees listed with computed bonus, prorated for partial year
  3. Apply in run

### RQ-PAY-021: Annual increment processing with effective dates (batch simulate and apply).

- **Source:** docs/01 PAY-17; SOW row 184
- **PRD:** PAY-17
- **Roles:** payroll_admin, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** simulateIncrement/applyIncrementBatch
- **SOW rows:** 184
- **Acceptance (UI):**
  1. Annual > Increment batch upload (.xlsx) with % per employee
  2. Simulate shows new CTC
  3. Apply: salary history rows effective 1 Apr; arrears in next run

### RQ-PAY-022: OT charges calculated and cross-verified against attendance; OT basis per signed policy (docs/04 Basic/26/8 vs docs/10 Factories Act).

- **Source:** SOW row 77; docs/04 vs docs/10
- **PRD:** PAY-05
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** template OT section uses Factories Act base (template.service.ts:152-161); conflict
- **SOW rows:** 65, 77
- **Acceptance (UI):**
  1. Approved OT 4h
  2. OT line equals configured formula; OT payslip shows base, divisor, rate, hours

### RQ-PAY-023: Payroll queries handled through helpdesk category "Payroll" with SLA.

- **Source:** SOW row 78; Agreement (payroll queries 0.5)
- **PRD:** HD-01
- **Roles:** employee, payroll_admin
- **Priority:** P2
- **Status:** **Done**
- **Evidence:** helpdesk categories
- **SOW rows:** 78
- **Acceptance (UI):**
  1. Employee raises ticket category Payroll
  2. Payroll admin receives, replies; SLA tracked

### RQ-PAY-024: New-joiner salary availability: LOI/offer salary breakup carries into the employee salary record on DOJ so payroll never misses a new joiner.

- **Source:** docs/01 PAY-07; PainPoint PP-12 (new-joiner salary missing); Agreement 2.1a (compensation not entered for new joiners)
- **PRD:** PAY-07
- **Roles:** hr_ops, payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** canonical initial salary open (pack33 unchecked item); backend/src/modules/lifecycle/onboarding/onboarding.service.ts
- **SOW rows:** 4, 26, 72, 127
- **Acceptance (UI):**
  1. Convert candidate with offer CTC 6,00,000 at 80% probation
  2. Payroll > Salary history shows effective salary from DOJ
  3. First run includes the joiner prorated without manual salary entry

### RQ-PAY-025: ESS payroll access timing for new joiners follows SOW (after client approves inputs / after first payroll when inputs via Excel / at agreed interval via connector).

- **Source:** SOW rows 132-134
- **PRD:** PAY-07
- **Roles:** employee, payroll_admin
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** MyPayPage shows finalized months only
- **SOW rows:** 132, 133, 134
- **Acceptance (UI):**
  1. New joiner logs in before first payroll: My Pay shows "no payslip yet"; after finalize: payslip visible

## STAT Statutory compliance

### RQ-STAT-001: PF: employee 12% on configured wage base (RML = ACTUAL basic, not capped at 15k); employer split EPS 8.33% capped at 15k wage (₹1,250) and EPF balance; admin/EDLI charges; rates versioned by effective date.

- **Source:** docs/09 G1; docs/10; PAYROLL_TEST_REPORT P-01 (PF capped 1,800 vs 3,874)
- **PRD:** PAY-09
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/statutory/pf.ts (ACTUAL default); /payroll/config/statutory-rates; pay.statutory_rates was empty pre-fix (SCHEMA_AUDIT S-01)
- **Acceptance (UI):**
  1. Employee BASIC 32,286 with wage base ACTUAL
  2. PF EE = 3,874; EPS 1,250; EPF ER = 2,624
  3. Switch employee to CEILING mode: PF EE 1,800

### RQ-STAT-002: ESIC: EE 0.75% / ER 3.25% for employees with gross ≤ ₹21,000; contribution-period continuity (stays covered until period end); OT treatment per ESIC rules.

- **Source:** docs/10; SCHEMA_AUDIT S-01; QA B-17 (ESI above 21k)
- **PRD:** PAY-10
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/statutory/esic.ts (21000 gate); D01 OT question
- **Acceptance (UI):**
  1. Gross 18,500: ESI EE 139, ER 602
  2. Gross 21,001 new joiner: no ESI
  3. Employee crossing 21k mid contribution period: still deducted till period end

### RQ-STAT-003: Professional Tax by state slabs (WB 110/130/150/200; Odisha etc.), by work location; versioned slabs editable.

- **Source:** docs/10; PAYROLL_TEST_REPORT (PT state)
- **PRD:** PAY-11
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/statutory/pt.ts; /payroll/config/pt-slabs
- **SOW rows:** 170
- **Acceptance (UI):**
  1. Config > PT slabs WB
  2. Gross 64,573 in WB: PT 200
  3. Employee located in Odisha: Odisha slab applied

### RQ-STAT-004: LWF: WB employee ₹3 / employer ₹30 half-yearly (Jun, Dec) or per state; Form D/return file.

- **Source:** docs/10; SOW row 178
- **PRD:** PAY-12
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/statutory/lwf.ts; generateFormD
- **SOW rows:** 178
- **Acceptance (UI):**
  1. Jun run: LWF EE 3, ER 30 for WB staff
  2. Jul run: no LWF
  3. Generate Form D for H1

### RQ-STAT-005: Monthly TDS: new regime default (standard deduction 75k, 87A rebate, cess), old regime on declaration; projection with YTD; FY 2026-27 slabs seeded.

- **Source:** docs/10 §6; SCHEMA_AUDIT S-13 (FY24-25 slabs seeded); SOW row 145 ("handling only white collars")
- **PRD:** PAY-13
- **Roles:** payroll_admin, employee
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/statutory/tds.ts; projectTds route; it_slabs table unused (S-13)
- **SOW rows:** 73, 145, 185
- **Acceptance (UI):**
  1. Employee annual taxable 14L new regime: monthly TDS per projection
  2. Tax sheet shows slab-wise computation
  3. Regime switch to old with declarations recalculates

### RQ-STAT-006: Employee investment declaration (80C, 80D, HRA rent, 24(b) home loan etc.) in ESS within a window; proof submission at year end; payroll verifies proofs.

- **Source:** SOW rows 28,73,123,223; Pending Implementation (open after Aug payroll)
- **PRD:** PAY-13
- **Roles:** employee, payroll_admin
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** declareInvestment/verifyDeclaration require payroll.run.manage (statutory.router.ts) - no employee self-service
- **SOW rows:** 28, 73, 123, 181, 185, 223
- **Acceptance (UI):**
  1. Employee: My Pay > Tax declaration > add 80C 1,50,000 > submit (window open)
  2. Payroll admin verifies; TDS projection drops
  3. Year-end: employee uploads proofs; unverified amounts reversed

### RQ-STAT-007: Form 24Q quarterly data file and Form 16 (Part A/B) annual generation, downloadable by payroll and by employee (incl. alumni).

- **Source:** docs/01 PAY-13; SOW row 146; QA (Form 16 route missing)
- **PRD:** PAY-13
- **Roles:** payroll_admin, employee
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** generateForm24QSummary function only (tds.ts:363) with no route; no Form 16 route; Alumni page references Form 16 without backend
- **SOW rows:** 146, 181
- **Acceptance (UI):**
  1. Payroll > Statutory > Form 24Q Q1: file generated
  2. Year end > Form 16 batch
  3. Employee: My Pay > Form 16 FY2026-27 downloads PDF

### RQ-STAT-008: TDS challan record and reconciliation of deducted vs deposited tax per month/quarter.

- **Source:** docs/01 PAY-13; SOW row 147; Agreement (challan reconciliation 0)
- **PRD:** PAY-13
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** pay.tds_challans unreferenced (SCHEMA_AUDIT S-23)
- **SOW rows:** 147
- **Acceptance (UI):**
  1. Statutory > Challans: enter BSR/challan no/amount for Jun
  2. Reconciliation shows deducted 4,20,000 vs paid 4,20,000 = 0 diff

### RQ-STAT-009: PF ECR file generation in EPFO format; PF challan data.

- **Source:** SOW row 150
- **PRD:** PAY-09
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** generateEcr (statutory.router.ts); company PF code null (S-24)
- **SOW rows:** 76, 150
- **Acceptance (UI):**
  1. Statutory > ECR for Jun
  2. Download text file in EPFO ECR format with UAN, wages, contributions; totals equal register

### RQ-STAT-010: ESIC monthly contribution file/challan data.

- **Source:** SOW row 163
- **PRD:** PAY-10
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** generateEsicReturn
- **SOW rows:** 76, 163
- **Acceptance (UI):**
  1. Statutory > ESIC return Jun: file lists IP numbers, days, wages, contributions

### RQ-STAT-011: PT return (PTRC) / remittance data per state.

- **Source:** SOW row 170
- **PRD:** PAY-11
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** generatePtrc
- **SOW rows:** 76, 170
- **Acceptance (UI):**
  1. Statutory > PTRC WB Jun: slab-wise counts and amounts equal register

### RQ-STAT-012: Gratuity per Payment of Gratuity Act (15/26 x last drawn basic+DA x years), eligibility per signed rule (5 years vs 4y240d).

- **Source:** docs/10; docs/04 (conflict)
- **PRD:** PAY-15
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-core/fnf/gratuity-calculator.ts; /payroll/config statutory-params
- **SOW rows:** 42
- **Acceptance (UI):**
  1. F&F for employee with 6y 3m service, basic 30,000: gratuity = 15/26 x 30,000 x 6 = 1,03,846
  2. Employee with 4y 245d: per signed rule

### RQ-STAT-013: Statutory rates/slabs/ceilings are versioned data editable by authorised payroll/HR (no hard-coded literals), audited, with effective dates.

- **Source:** docs/03 §6.8; AGENTS.md; SCHEMA_AUDIT S-01; commit ba6e81d
- **PRD:** PAY-09..13
- **Roles:** payroll_admin, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /payroll/config/statutory-rates|statutory-params|pt-slabs (commit ba6e81d)
- **SOW rows:** 3, 160
- **Acceptance (UI):**
  1. Payroll > Config > Statutory rates: add ESIC EE 0.75 effective 1 Apr 2027
  2. Runs before Apr use old rate; after use new
  3. Audit row recorded

## OUT Payroll outputs

### RQ-OUT-001: Payslip types: Regular, Reimbursement, Overtime, in the RML (old) format consistently every month, showing PAN, UAN, PF no, ESIC no, masked bank, payable/LOP days, cost centre.

- **Source:** docs/09; Protiviti Status 26 July (payslip to match old format); PainPoint (payslip RML format; PF/UAN); Pending Implementation (template inconsistency May/Jun/Jul)
- **PRD:** PAY-06
- **Roles:** payroll_admin, employee
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** backend/src/modules/payroll-outputs/payslip/template.service.ts (3 types); client format sign-off pending
- **Acceptance (UI):**
  1. Generate payslips for Jun
  2. Open regular payslip: layout matches approved RML sample; PAN/UAN/PF/ESIC present
  3. OT payslip and reimbursement payslip variants render

### RQ-OUT-002: Employee sees own payslips (current + history) and downloads PDF; never another employee's (no fake data).

- **Source:** docs/01 PAY-06; QA B-02 (fake payslip to everyone)
- **PRD:** PAY-06
- **Roles:** employee
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** getMyPayslip; frontend/src/pages/payroll/MyPayPage.tsx rewritten (uncommitted) - re-test
- **SOW rows:** 30, 181
- **Acceptance (UI):**
  1. Log in as employee
  2. My Pay: list of finalized months; open Jun: own e-code and figures
  3. Change ID in URL/API: 403

### RQ-OUT-003: Bulk payslip generation for a run (all employees, no failure at batch size) and bulk download/email.

- **Source:** SOW row 182; PAYROLL_TEST_REPORT (payslip batch 500)
- **PRD:** PAY-06
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** generateRunPayslips; fix b92b6d2 (payslip atomicity)
- **SOW rows:** 182
- **Acceptance (UI):**
  1. Run > Generate payslips for 700 employees
  2. All generated; zip download; optional email dispatch with delivery status

### RQ-OUT-004: Bank transfer file in the bank's format (per entity), excluding held salaries, totals equal net pay.

- **Source:** SOW rows 75,99; docs/01 PAY-05
- **PRD:** PAY-05
- **Roles:** payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** generateBankFile (backend/src/modules/payroll-outputs/bank/bank-file.service.ts); bank format unconfirmed
- **SOW rows:** 75, 99
- **Acceptance (UI):**
  1. Finalized run > Bank file
  2. File totals = sum net pay of non-held employees; format per bank spec

### RQ-OUT-005: SAP journal voucher (JV) export with GL mapping per component and cost centre.

- **Source:** SOW row 75,101; docs/01 PAY-05
- **PRD:** PAY-05
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** generateSapJv; /payroll/config/gl-accounts
- **SOW rows:** 75, 101
- **Acceptance (UI):**
  1. Config > GL accounts mapped
  2. Run > SAP JV: debit/credit balanced; cost centre split

### RQ-OUT-006: Standard reports: final pay register, TDS, PF, PT, ESIC, LWF reports; variance report vs previous month; customised report builder.

- **Source:** SOW rows 75,76
- **PRD:** PAY-05
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** getRunOutputs, getVarianceReport
- **SOW rows:** 75, 76
- **Acceptance (UI):**
  1. Run outputs page lists register, statutory reports, variance
  2. Each downloads .xlsx with totals equal register

### RQ-OUT-007: Tax computation sheet / IT statement per employee in ESS.

- **Source:** SOW rows 30,100,181
- **PRD:** PAY-13
- **Roles:** employee
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** generateItStatementLines (tds.ts:298); ESS route not evidenced
- **SOW rows:** 30, 100, 181
- **Acceptance (UI):**
  1. My Pay > Tax sheet: projected income, exemptions, slabs, TDS to date

### RQ-OUT-008: HR & payroll SPOC access: bulk download of payroll and compliance reports, employee data and letters.

- **Source:** SOW row 182; Agreement ESS SPOC row (0.5/0.8)
- **PRD:** PAY-05
- **Roles:** payroll_admin, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** getRunOutputs; outputs-bundle.service.ts
- **SOW rows:** 182
- **Acceptance (UI):**
  1. Run outputs page: download register, statutory files, payslips zip in one place

## LN Loans & advances

### RQ-LN-001: Loan types with schedulers: diminishing balance, flat interest, EMI without interest; preview amortisation schedule.

- **Source:** docs/01 LN-01; SOW rows 118-121
- **PRD:** LN-01
- **Roles:** employee, payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** backend/src/modules/loans/amortization.ts; /loans/preview
- **SOW rows:** 118, 119, 120, 121
- **Acceptance (UI):**
  1. Loans > Preview: 1,00,000 @ 9% diminishing 12m
  2. Schedule shows EMI and declining interest; flat and zero-interest variants correct

### RQ-LN-002: Loan eligibility rules (e.g. multiple of Basic, tenure since DOJ, max concurrent loans); ineligible applications rejected; loans not open to all employees.

- **Source:** docs/01 LN-01/02; Pending Implementation (not open to all); SOW row 119 remark; QA B-06 (₹1 crore accepted)
- **PRD:** LN-02
- **Roles:** employee
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** loans.service eligibility checks; SCHEMA_AUDIT S-08 (₹5 crore active loan, no CHECKs)
- **SOW rows:** 29, 119
- **Acceptance (UI):**
  1. Employee with basic 20,000 applies 10,00,000 (beyond 3x basic)
  2. Rejected with eligibility reason
  3. Employee not in eligible category: Apply button hidden

### RQ-LN-003: Loan application in ESS with approval chain RM -> HR Head -> Payroll; loan becomes active only after final approval.

- **Source:** docs/01 LN-02; docs/08 §4; QA B-06
- **PRD:** LN-02
- **Roles:** employee, manager, hr_head, payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** workflow loan (definitions.seed.ts:60-65); fix b92b6d2 loans lifecycle; Agreement: loans module not active
- **SOW rows:** 29
- **Acceptance (UI):**
  1. Employee applies 50,000
  2. Status Pending at RM; approve -> HR Head -> Payroll
  3. Only after payroll approval status Active and EMI scheduled

### RQ-LN-004: EMI auto-deducted in payroll; balance and ledger visible to employee; salary-advance deductions as monthly inputs.

- **Source:** docs/01 LN-03; SOW row 124; PAYROLL_TEST_REPORT (loans without EMI)
- **PRD:** LN-03
- **Roles:** employee, payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /loans/{id}/ledger; compute-engine EMI (b92b6d2)
- **SOW rows:** 124
- **Acceptance (UI):**
  1. Active loan EMI 4,500
  2. Jun payroll deducts 4,500; loan ledger posts; outstanding reduces
  3. Employee My loans shows balance

### RQ-LN-005: Legacy SAP loan balances (before May 2025) importable from Excel with opening balance and remaining schedule.

- **Source:** docs/01 LN-03; SOW row 118 remark; PainPoint (loans)
- **PRD:** LN-03
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /loans/legacy-import (JSON payload; no xlsx)
- **SOW rows:** 10, 118
- **Acceptance (UI):**
  1. Loans > Legacy import .xlsx (e-code, principal, outstanding, EMI, start)
  2. Rows validated; loans appear active with source=sap_legacy

### RQ-LN-006: Perquisite valuation on concessional loans at SBI lending rate for TDS.

- **Source:** SOW row 122; docs/01 LN-01
- **PRD:** LN-01
- **Roles:** payroll_admin
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** perquisite in loans.service.ts
- **SOW rows:** 122
- **Acceptance (UI):**
  1. Loan at 0% of 3,00,000
  2. Monthly perquisite = outstanding x SBI rate/12 added to taxable income

### RQ-LN-007: Travel advance requests with configurable chain: domestic RM -> functional/HOD; global adds CHRO (George) as final approver.

- **Source:** docs/01 LN-04; Latest Update in Protiviti (George final approver for global users)
- **PRD:** LN-04
- **Roles:** employee, manager, HOD, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** travel_advance_domestic only (definitions.seed.ts:69-75); no global chain; Protiviti dropped travel advance
- **Acceptance (UI):**
  1. Employee raises international advance
  2. Chain RM -> HOD -> CHRO (George)
  3. Domestic: no CHRO step

## CLM Claims & reimbursements

### RQ-CLM-001: Claim types configurable (medical, conveyance/fuel, telephone, LTA, relocation, misc.) with entitlement per grade, bill-required flag, taxability.

- **Source:** docs/01 CLM-01; SOW row 187
- **PRD:** CLM-01
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** claims module; sponsor deferred claims/budgets (plans/launch-readiness/00); SCHEMA_AUDIT S-02 (insert violates CHECK)
- **SOW rows:** 13, 27, 187
- **Acceptance (UI):**
  1. Config claim type Telephone 1,000/month bill required
  2. Employee entitlement shows 1,000

### RQ-CLM-002: ESS claim submission with bills and running entitlement balance; RM -> HR verify -> payroll; partial approval; mandatory rejection reason.

- **Source:** docs/01 CLM-02/03; QA B-08/B-09 (claims 500/404)
- **PRD:** CLM-02/03
- **Roles:** employee, manager, hr_ops, payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /claims/submit etc.; claims 500 per QA; deferred
- **SOW rows:** 181, 187
- **Acceptance (UI):**
  1. Employee: My Claims > New > Telephone 900 + bill > submit
  2. Approve chain; HR approves 800 partial with note
  3. Payroll run pays 800 as reimbursement

### RQ-CLM-003: Reimbursement payout via payroll (taxable/non-taxable per type) or off-cycle reimbursement batch with own bank file, register and reimbursement payslip.

- **Source:** docs/01 CLM-04; SOW row 187
- **PRD:** CLM-04
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /claims/route-payout; reimbursement payslip template
- **SOW rows:** 187
- **Acceptance (UI):**
  1. Route approved claims to off-cycle batch
  2. Bank file + reimbursement register + reimbursement payslips generated

### RQ-CLM-004: Year-end TDS on unclaimed/unsubstantiated entitlement; lapse/carry per type.

- **Source:** docs/01 CLM-05
- **PRD:** CLM-05
- **Roles:** payroll_admin
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /claims/year-end-recovery
- **SOW rows:** 185
- **Acceptance (UI):**
  1. Year-end recovery run: unsubstantiated amount added to taxable income in March

### RQ-CLM-005: Reimbursement register (R31) and per-employee claim history.

- **Source:** docs/01 CLM-06
- **PRD:** CLM-06
- **Roles:** payroll_admin, employee
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /reports/r31-claims
- **SOW rows:** 187
- **Acceptance (UI):**
  1. Reports > R31 export
  2. Employee My Claims history

### RQ-CLM-006: Travel advance settlement links to claims; unspent advance recovered via payroll deduction.

- **Source:** docs/01 CLM-07
- **PRD:** CLM-07
- **Roles:** payroll_admin
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** settlement.service.ts; recovery channel
- **Acceptance (UI):**
  1. Advance 10,000, claim 7,000 -> 3,000 recovery appears as payroll deduction next run

## LC Onboarding, probation & transfers

### RQ-LC-001: Onboarding from ATS: LOI-accepted candidate imported with LOI fields into a separate pre-boarding population (not employees).

- **Source:** docs/01 LC-01; plans/launch-readiness/02; ATS SOW (onboarding integration)
- **PRD:** LC-01
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /lifecycle/candidates(+ingest); frontend/src/pages/lifecycle/OnboardingBoardPage.tsx
- **SOW rows:** 10, 129
- **Acceptance (UI):**
  1. Lifecycle > Onboarding: candidates list shows ATS-ingested candidates with offer details
  2. They do not appear in People/headcount

### RQ-LC-002: Personal-email pre-joining link (time-limited, single-use) for the candidate to complete data and upload documents; link delivery tracked; resend/correct.

- **Source:** docs/01 LC-01; SOW row 25; Temp Copy PainPoint (pre-onboarding link)
- **PRD:** LC-01
- **Roles:** hr_ops, candidate
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /lifecycle/prejoin/validate|submit; frontend/src/pages/lifecycle/PrejoinPortalPage.tsx; resend/correction and delivery proof open (pack33)
- **SOW rows:** 25, 127
- **Acceptance (UI):**
  1. HR sends prejoin link
  2. Candidate opens link, fills personal/bank/statutory/documents, submits
  3. Second submit with same link rejected
  4. HR sees delivery status and can resend

### RQ-LC-003: HR reviews the submitted application, accepts or returns it, then confirms actual joining which converts atomically to employee with e-code, org unit, salary and login.

- **Source:** plans/launch-readiness/02; pack33
- **PRD:** LC-01
- **Roles:** hr_ops
- **Priority:** P0
- **Status:** **Done**
- **Evidence:** /lifecycle/candidates/convert; frontend/src/pages/lifecycle/OnboardingApplicationReview.tsx
- **Acceptance (UI):**
  1. Open candidate application > Accept
  2. Confirm joining with DOJ
  3. Employee created with e-code; failure mid-way leaves no orphan employee

### RQ-LC-004: Onboarding task checklist auto-assigned on DOJ to stakeholders (IT: e-code/email/biometric enrolment; Admin: assets; HR: induction) with due dates, reminders and escalation; alerts to stakeholders.

- **Source:** docs/01 LC-02; Protiviti Status 26 July (onboarding alerts by 29 Jul); Latest Update
- **PRD:** LC-02
- **Roles:** hr_ops, it_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /lifecycle/tasks(+complete); task-owner authority and delivery open (pack33)
- **Acceptance (UI):**
  1. Confirm a joining
  2. Tasks created for IT/Admin/HR with due dates
  3. IT user sees task in their queue, completes with evidence
  4. Overdue task escalates

### RQ-LC-005: Biometric enrolment step for new joiners verified against real device data (no fake verification).

- **Source:** pack33; PainPoint rows 27-32 (enrolment upload)
- **PRD:** LC-02
- **Roles:** it_admin
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /lifecycle/biometric/verify fails closed
- **Acceptance (UI):**
  1. IT completes biometric task
  2. Verification requires a real swipe from the card; fixture/fake rejected

### RQ-LC-006: Daily boarding & exit report at a configured time to Plant Head + HR + Business Head + CEO Cell, per plant, listing previous day's joins and exits (also to RMs where configured); Excel download.

- **Source:** docs/01 LC-03; PainPoint PP-6/26; ERP QUICK UPDATE (pending daily boarding/exit report); Reports-Templates email
- **PRD:** LC-03
- **Roles:** plant_head, hr_ops, ceo_cell
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** boarding-exit job 01:30 UTC (jobs/worker.ts:97); /lifecycle/boarding-exit(+excel,+send); SMTP delivery unproven
- **Acceptance (UI):**
  1. Ensure 1 joiner and 1 exit yesterday at RML1
  2. At configured time recipients receive email with both rows
  3. Lifecycle > Boarding/exit > Excel download matches

### RQ-LC-007: Probation tracking: end-date, auto-reminders to manager ahead of due date (e.g. 30/15/7 days), review form.

- **Source:** docs/01 LC-04; SOW row 33; Pending Implementation (probation alerts not coming); ERP (probation form under config)
- **PRD:** LC-04
- **Roles:** manager, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /lifecycle/probation/alerts|reviews|evaluate; frontend/src/pages/lifecycle/ProbationBoardPage.tsx
- **SOW rows:** 33
- **Acceptance (UI):**
  1. Employee probation ends in 30 days
  2. Manager receives reminder and sees review form in Approvals
  3. Lifecycle > Probation board lists due items

### RQ-LC-008: Multi-level confirmation workflow (RM -> HR Head) -> confirmation letter -> salary switch to full breakup; RM alone cannot confirm.

- **Source:** docs/01 LC-04; SOW row 34; QA B-10 (RM can confirm probation)
- **PRD:** LC-04
- **Roles:** manager, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** workflow confirmation (RM -> hr_head); B-10 open pre-fix
- **SOW rows:** 34
- **Acceptance (UI):**
  1. Manager submits review "Confirm"
  2. Status awaits HR Head
  3. HR Head approves: confirmation letter issued to ESS; salary switch effective date set

### RQ-LC-009: Probation extension or termination outcomes with letters.

- **Source:** docs/04 lifecycle
- **PRD:** LC-04
- **Roles:** manager, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /lifecycle/probation/decide
- **Acceptance (UI):**
  1. Review outcome "Extend 3 months"
  2. New end date set; extension letter generated

### RQ-LC-010: Transfers (department, location, cost centre, entity) with approvals, effective date (future-dated takes effect on date), documentation and compensation/role change updates, history.

- **Source:** docs/01 LC-05; SOW rows 36-38; QA B-18
- **PRD:** LC-05
- **Roles:** hr_ops, manager, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /lifecycle/transfers(+approve,+history,+as-of); B-18 immediate effect pre-fix
- **SOW rows:** 36, 37, 38
- **Acceptance (UI):**
  1. HR raises transfer effective 1 Nov
  2. Approvals RM -> HR ops
  3. Before 1 Nov: employee still in old dept; on 1 Nov: new dept, cost centre; history shows both
  4. Transfer letter generated

### RQ-LC-011: Promotion & internal movement captured as events (designation/grade change) with report.

- **Source:** docs/01 RPT-05; Latest Update; ERP QUICK UPDATE
- **PRD:** RPT-05
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /reports/r23-transfers includes promotions
- **SOW rows:** 38
- **Acceptance (UI):**
  1. Promote employee (designation + grade)
  2. R23 report lists the promotion with old/new

## SEP Separation, F&F & exit

### RQ-SEP-001: Resignation initiated by the employee in ESS (only for self), with requested LWD; notice period computed by category (e.g. 90 days white collar, 30 others).

- **Source:** docs/01 LC-06; QA B-04 (anyone could resign for a colleague); settings notice_days
- **PRD:** LC-06
- **Roles:** employee
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /lifecycle/separations/apply; B-04 IDOR fix in progress (separation.router.ts uncommitted)
- **SOW rows:** 40
- **Acceptance (UI):**
  1. Employee: Me > Resign: reason, requested LWD
  2. Notice computed and shortfall shown
  3. Attempt to submit for another e-code (API): 403

### RQ-SEP-002: Resignation approval chain RM -> HR Head -> HR Ops where every configured approver is notified and must act; no single-step finalisation; withdrawal before approval.

- **Source:** docs/01 LC-06; docs/08 §4; Pending Implementation (resignation not visible to Chaitanya); QA B-10
- **PRD:** LC-06
- **Roles:** manager, hr_head, hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** workflow resignation (definitions.seed.ts:85-91); /separations/{id}/approve|reject|withdraw|ceo-review
- **SOW rows:** 40
- **Acceptance (UI):**
  1. Employee resigns
  2. RM approves -> HR Head sees and approves -> HR Ops approves
  3. Only then status Approved with LWD
  4. Employee withdraws before final: status Withdrawn

### RQ-SEP-003: Absconding case handling (process hold, notices, separation by HR).

- **Source:** SOW row 137; /lifecycle/separations/absconding
- **PRD:** LC-06
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /lifecycle/separations/absconding
- **SOW rows:** 137
- **Acceptance (UI):**
  1. HR marks absconding
  2. Payroll process hold applied
  3. Separation completed by HR with reason

### RQ-SEP-004: Digital department clearances (IT, Admin, Finance, HR) incl. asset return; each department sees and signs off its items; F&F waits for all clearances.

- **Source:** docs/01 LC-06; SOW row 41, 204
- **PRD:** LC-06
- **Roles:** it_admin, hr_ops, payroll_admin
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /lifecycle/clearances(+update)
- **SOW rows:** 41, 204
- **Acceptance (UI):**
  1. Approved separation creates clearances
  2. IT marks laptop returned (asset return recorded)
  3. Finance clears dues
  4. F&F compute blocked until all cleared

### RQ-SEP-005: F&F settlement: days payable, leave encashment, notice pay/recovery, gratuity, salary-hold release, loan recovery, other dues; correct rupee amounts (no x100 errors); settlement statement.

- **Source:** docs/01 PAY-15; SOW rows 42,221,225; QA B-05 (F&F x100)
- **PRD:** PAY-15
- **Roles:** payroll_admin, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /separations/{id}/compute-fnf, /pay; fnf-engine.ts; fix b92b6d2 F&F guards
- **SOW rows:** 42, 221, 225
- **Acceptance (UI):**
  1. Separation of employee gross 20,000, LWD 15th
  2. Compute F&F: half-month salary ≈ 10,000 + encashment + gratuity if eligible - recoveries
  3. Statement PDF shows each line

### RQ-SEP-006: F&F: two settlement cycles per month; TAT target 3 working days from clearance (wage-code 2-day rule to be confirmed).

- **Source:** SOW rows 227,228; plans 08 D01
- **PRD:** PAY-15
- **Roles:** payroll_admin
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No cycle/TAT tracking; unique run key cannot model 2 F&F cycles (D11)
- **SOW rows:** 227, 228
- **Acceptance (UI):**
  1. F&F board shows cycle 1/2 and age in working days since clearance
  2. Items breaching TAT highlighted

### RQ-SEP-007: Relieving and experience letters issued through the system only after clearance completion; visible in ESS/alumni.

- **Source:** docs/01 LC-06, CORE-09; SOW row 44
- **PRD:** LC-06
- **Roles:** hr_ops, employee
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** letters module; gating not evidenced
- **SOW rows:** 44
- **Acceptance (UI):**
  1. Before clearance: Issue relieving letter disabled
  2. After: issue; employee/alumni sees letter

### RQ-SEP-008: Exit sets status/DOL exactly once; removed from active lists; ESS restricted to alumni view (payslips, Form 16); unreturned assets flagged.

- **Source:** docs/01 LC-07; SOW row 230 (alumni portal)
- **PRD:** LC-07
- **Roles:** employee (alumni), hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** frontend/src/pages/lifecycle/AlumniPortalPage.tsx; Form 16 backend missing
- **SOW rows:** 230
- **Acceptance (UI):**
  1. Exit employee
  2. Login as alumni: only Payslips/Form 16/letters visible
  3. Asset still assigned: flagged on non-returned dashboard

### RQ-SEP-009: F&F inputs in Excel format (days payable, holds, recoveries) accepted from HR.

- **Source:** SOW row 221
- **PRD:** PAY-15
- **Roles:** payroll_admin
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** no F&F upload route
- **SOW rows:** 221
- **Acceptance (UI):**
  1. Upload F&F input .xlsx
  2. Values populate F&F computation

### RQ-SEP-010: Investment proofs for exiting employees processed before F&F; F&F deliverables (statement, payslip, bank file) shared with SPOC only.

- **Source:** SOW rows 223-225,229
- **PRD:** PAY-15
- **Roles:** payroll_admin
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** manual/process; partial code
- **SOW rows:** 222, 223, 224, 225
- **Acceptance (UI):**
  1. Exiting employee proofs verified
  2. F&F TDS computed
  3. Deliverables downloadable by SPOC role only

## LTR Letters

### RQ-LTR-001: Letter templates with merge fields: appointment, confirmation, experience, relieving, salary certificate, show-cause/warning, transfer; workflow sign-off; issued letters archived on employee and visible in ESS.

- **Source:** docs/01 CORE-09; SOW rows 23,44; PainPoint PP-14
- **PRD:** CORE-09
- **Roles:** hr_ops, hr_head, employee
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /letters/templates|issue|mine; workflow letter_signature
- **SOW rows:** 23, 44, 182
- **Acceptance (UI):**
  1. Letters > Templates: edit Experience letter merge fields
  2. Issue to employee -> signature workflow HR ops -> HR head
  3. Employee: My letters shows PDF

### RQ-LTR-002: Appointment letter tracking (issued / acknowledged).

- **Source:** SOW row 23; Agreement (appointment letters 0.5)
- **PRD:** CORE-09
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** letters list
- **SOW rows:** 23
- **Acceptance (UI):**
  1. Letters list filter type=Appointment: status issued/acknowledged per employee

## RPT Reports & dashboards

### RQ-RPT-001: Offer report: candidate, org unit, designation, DOJ, offer date, offered salary with probation %, LOI status (Accepted/Rejected/Yet to accept).

- **Source:** docs/01 RPT-02; PainPoint PP-24
- **PRD:** RPT-02
- **Roles:** hr_ops, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /reports/r21-offers (reads ATS-ingested data)
- **SOW rows:** 22
- **Acceptance (UI):**
  1. Reports > R21 Offers
  2. Columns as listed; filter by status; export .xlsx

### RQ-RPT-002: CEO dashboard with all HR Dashboard pptx KPIs split by Total / White Collar / Trainee / Blue Collar / Contract / Consultants: manpower, average age, average tenure, leadership %, contract dependency ratio, average CTC by level, labour productivity, output per man-hour, cost per man-hour, cost per unit, OT hours, OT cost, absenteeism %, attrition %, number of leavers, burnout index; new-hire attrition at 3/6/12 months.

- **Source:** docs/01 RPT-03; CEO DASHBOARD/HR Dashboard.pptx; docs/06 KPI formulas; Additional Requirement (CEO dashboard status)
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** /reports/executive(+trend,+leavers,+rebuild); kpi-snapshot.service.ts; output/production inputs (units) have no source system
- **SOW rows:** 19
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive: each KPI tile present per column split
  3. Drill to trend; leavers list aggregate
  4. Values reconcile with R26/R27 and payroll aggregates; no individual salary

### RQ-RPT-003: HR dashboard: this week's joiners/exits, absence cases by stage, OT pending aging, probation due 30 days, policy acknowledgment %, helpdesk SLA.

- **Source:** docs/05 §4.1; SOW row 19 (0); Pending Implementation (dashboard not done)
- **PRD:** RPT-04
- **Roles:** hr_ops, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /dashboards/hr-ops; frontend/src/pages/home/HrOpsDashboard.tsx
- **SOW rows:** 19
- **Acceptance (UI):**
  1. Log in as hr_ops
  2. Home shows the 6 cards with live counts scoped to entity
  3. Click card drills to list

### RQ-RPT-004: Business-Unit dashboard in the format shared with Protiviti (headcount, attendance, OT, attrition per BU/plant).

- **Source:** docs/01 RPT-04; ERP QUICK UPDATE (dashboards for HR/BU/CEO Cell pending)
- **PRD:** RPT-04
- **Roles:** plant_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /dashboards/business-unit; BU template not available (D08)
- **Acceptance (UI):**
  1. Log in as plant_head
  2. BU dashboard shows own plant metrics only

### RQ-RPT-005: Recruitment & hiring report (requisitions, offers, joins, TAT, source effectiveness).

- **Source:** docs/01 RPT-05; Latest Update; ATS proposal (TAT, source effectiveness, vacancy aging)
- **PRD:** RPT-05
- **Roles:** hr_head
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No recruitment/hiring report route
- **Acceptance (UI):**
  1. Reports > Recruitment & hiring for quarter
  2. Counts by stage, TAT, source; export

### RQ-RPT-006: Attendance reports/dashboards for HR and management (daily attendance %, absentee, late, OT).

- **Source:** SOW row 69 (0); Agreement standard reports 0.2
- **PRD:** RPT-06
- **Roles:** hr_ops, plant_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** R2-R6 reports, muster; summary dashboard partial
- **SOW rows:** 69
- **Acceptance (UI):**
  1. Reports: daily attendance summary by plant/department; trend chart; export

### RQ-RPT-007: Supporting reports R2 swipes, R3 regularizations, R4 exceptions, R5 OT, R6 absence, R23 transfers, R24 boarding, R25 probation, R26 attrition, R27 headcount, R28 assets, R29 helpdesk, R30 policies, R31 claims - each scoped to the viewer's population.

- **Source:** docs/06
- **PRD:** RPT-06
- **Roles:** hr_ops, manager, plant_head
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** /reports/r* routes; frontend/src/pages/reports/SupportingReports.tsx; pack30 population scope
- **Acceptance (UI):**
  1. For each report: open as hr_ops (entity) and manager (tree)
  2. Rows limited to scope; export matches

### RQ-RPT-008: Offer-pending-approval report and template.

- **Source:** ERP QUICK UPDATE (offer pending approval template); Latest Update
- **PRD:** RPT-02
- **Roles:** hr_head
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** No offer approval implementation in HRMS
- **Acceptance (UI):**
  1. Reports > Offers pending approval: offer, stage, approver, age

### RQ-RPT-009: Employee master report with RM, functional RM, cost centre, entity, statutory fields (masked per role).

- **Source:** Pending Implementation payroll sheet (functional RM in master report)
- **PRD:** CORE-03
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No master report route
- **Acceptance (UI):**
  1. Reports > Employee master export .xlsx with listed columns

### RQ-RPT-101: CEO dashboard KPI: Manpower count (Total/WC/Trainee/BC/Contract/Consultant), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Manpower count (Total/WC/Trainee/BC/Contract/Consultant)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-102: CEO dashboard KPI: Average age, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Average age" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-103: CEO dashboard KPI: Average tenure, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Average tenure" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-104: CEO dashboard KPI: Leadership % (rank cutoff configurable), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Leadership % (rank cutoff configurable)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-105: CEO dashboard KPI: Contract dependency ratio, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Contract dependency ratio" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-106: CEO dashboard KPI: Average CTC by level (aggregate only), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Average CTC by level (aggregate only)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-107: CEO dashboard KPI: Labour productivity, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Labour productivity" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-108: CEO dashboard KPI: Output per man-hour (needs production output source), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Output per man-hour (needs production output source)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-109: CEO dashboard KPI: Cost per man-hour, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Cost per man-hour" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-110: CEO dashboard KPI: Cost per unit (needs production units source), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Cost per unit (needs production units source)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-111: CEO dashboard KPI: OT hours, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "OT hours" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-112: CEO dashboard KPI: OT cost, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "OT cost" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-113: CEO dashboard KPI: Absenteeism %, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Absenteeism %" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-114: CEO dashboard KPI: Attrition % (annualised), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Attrition % (annualised)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-115: CEO dashboard KPI: Number of leavers (MTD/YTD), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Done**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Number of leavers (MTD/YTD)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-116: CEO dashboard KPI: Burnout index (formula per docs/06), shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "Burnout index (formula per docs/06)" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

### RQ-RPT-117: CEO dashboard KPI: New-hire attrition at 3 / 6 / 12 months, shown per workforce split column and as monthly trend, computed per docs/06 formula and reconciling to source reports.

- **Source:** CEO DASHBOARD/HR Dashboard.pptx; docs/06 CEO KPI formulas; docs/01 RPT-03
- **PRD:** RPT-03
- **Roles:** ceo_cell, hr_head
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** backend/src/modules/reports/kpi-snapshot.service.ts; frontend/src/pages/executive/ExecutivePage.tsx (Partial where inputs such as production units, OT cost, payroll aggregates are unproven)
- **Acceptance (UI):**
  1. Log in as ceo_cell
  2. Executive dashboard: "New-hire attrition at 3 / 6 / 12 months" tile visible for each split
  3. Hand-compute the value for one month from R27/R26/payroll aggregates; matches tile within rounding
  4. Trend shows last 12 months

## AST Assets

### RQ-AST-001: Asset registry with search by asset number, type, holder.

- **Source:** docs/01 AST-01; Additional Requirement; Task Divide Matrix (asset number filter)
- **PRD:** AST-01
- **Roles:** hr_ops (admin)
- **Priority:** P1
- **Status:** **Done**
- **Evidence:** /assets, /assets/{assetNo}; frontend/src/pages/workplace/AssetsPage.tsx
- **SOW rows:** 197, 198
- **Acceptance (UI):**
  1. Assets: search "LAP-0042" -> single asset; filter type Laptop; filter holder e-code

### RQ-AST-002: Warranty date accepts past dates.

- **Source:** docs/01 AST-02; Additional Requirement
- **PRD:** AST-02
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Done**
- **Evidence:** assets.router.ts:73 comment + isoDate
- **SOW rows:** 198
- **Acceptance (UI):**
  1. Register asset with warranty till 01-01-2024: saves

### RQ-AST-003: Allocation to employees and third-party/contract persons (dropdown).

- **Source:** docs/01 AST-03; Additional Requirement
- **PRD:** AST-03
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Done**
- **Evidence:** holderKind employee|third_party (assets.router.ts:108-110)
- **SOW rows:** 197
- **Acceptance (UI):**
  1. Assign asset > Holder type Third party > name
  2. Asset shows holder third party

### RQ-AST-004: Resigned employee's assets visible and returned through exit clearance.

- **Source:** docs/01 AST-04; Additional Requirement
- **PRD:** AST-04
- **Roles:** hr_ops, it_admin
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /assets/held-by/{employeeId}; clearance linkage open (plans 05 W01)
- **SOW rows:** 203, 204
- **Acceptance (UI):**
  1. Employee resigns
  2. Clearance lists held assets
  3. Return asset: clearance item auto-cleared

### RQ-AST-005: Non-returned assets dashboard tile and report.

- **Source:** docs/01 AST-05; Additional Requirement
- **PRD:** AST-05
- **Roles:** hr_ops, hr_head
- **Priority:** P2
- **Status:** **Done**
- **Evidence:** /assets/non-returned(+export); R28
- **SOW rows:** 205
- **Acceptance (UI):**
  1. Dashboard tile "Non-returned assets: 3"
  2. Click -> list with exited holders; export

### RQ-AST-006: Maintenance scheduling, incident/damage reporting and lost-asset handling with history.

- **Source:** docs/01 AST-06; SOW rows 200,201,205
- **PRD:** AST-06
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /assets/{id}/maintenance; incident/lost flow partial
- **SOW rows:** 200, 201, 205
- **Acceptance (UI):**
  1. Asset > Maintenance: schedule service on date
  2. Report damage with photo
  3. Mark lost: holder retained, disposition recorded

### RQ-AST-007: Asset and location tracking (asset location field and movement history).

- **Source:** Protiviti Status 26 July (asset & location tracking pending); PainPoint row 31
- **PRD:** AST-01
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** location fields; movement history not evidenced
- **Acceptance (UI):**
  1. Asset shows current location; move to plant RML6: history row

## HD Helpdesk

### RQ-HD-001: Categorised tickets (Payroll, Attendance, Leave, IT, Statutory…), auto-acknowledgment and auto-assignment to category owner.

- **Source:** docs/01 HD-01; SOW rows 208,209
- **PRD:** HD-01
- **Roles:** employee, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /helpdesk/tickets, /categories; category access gaps (pack22)
- **SOW rows:** 181, 208, 209
- **Acceptance (UI):**
  1. Employee: Helpdesk > New ticket category Payroll
  2. Auto-ack message; ticket assigned to payroll queue

### RQ-HD-002: SLA-based escalation matrix with automated escalation of unresolved tickets.

- **Source:** docs/01 HD-01, WF-03; SOW row 211; Agreement (helpdesk escalation 0)
- **PRD:** HD-01
- **Roles:** hr_ops, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** helpdesk escalation job hourly; /helpdesk/escalate
- **SOW rows:** 211
- **Acceptance (UI):**
  1. Ticket breaches 48h SLA
  2. Escalates to level 2 owner; notification; history shows escalation

### RQ-HD-003: Open/pending/resolved tracking, ticket thread, reopen/closure history; monthly performance report export; query logs for audit.

- **Source:** docs/01 HD-01; SOW rows 213,214,216
- **PRD:** HD-01
- **Roles:** hr_ops, hr_head
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /helpdesk/tickets/{id}/thread|status, /helpdesk/performance(+export); reopen history gap (pack22)
- **SOW rows:** 213, 214, 216, 218
- **Acceptance (UI):**
  1. Helpdesk board filters by status
  2. Ticket thread shows replies and status changes
  3. Performance report for month exports .xlsx

## EN Engagement & policies

### RQ-EN-001: Policy repository: publish policy, per-employee acknowledgment tracking in real time, auto-alerts to non-acknowledgers, acknowledgment report.

- **Source:** docs/01 CORE-13, EN-04; SOW rows 16-18
- **PRD:** CORE-13
- **Roles:** hr_ops, employee
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** /policies/*; policy nag job Mondays; population errors (pack22)
- **SOW rows:** 3, 16, 17, 18
- **Acceptance (UI):**
  1. HR publishes policy to RML audience
  2. Employee home shows pending policy; Acknowledge
  3. Report: 1 of N acknowledged; weekly nag to others

### RQ-EN-002: Announcements/news broadcast to company/plant audiences.

- **Source:** docs/01 EN-01; SOW row 190
- **PRD:** EN-01
- **Roles:** hr_ops, employee
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /engagement/announcements; company audience leak (pack22 O01)
- **SOW rows:** 190
- **Acceptance (UI):**
  1. Post announcement to RGH audience
  2. RGH employee sees it; RML employee does not

### RQ-EN-003: Opinion polls with results.

- **Source:** docs/01 EN-02; SOW row 191 (0)
- **PRD:** EN-02
- **Roles:** hr_ops, employee
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /engagement/polls(+respond,+results)
- **SOW rows:** 191
- **Acceptance (UI):**
  1. Create poll
  2. Employees respond once
  3. Results visible to HR (aggregate)

### RQ-EN-004: Structured pulse/feedback surveys with response analytics; (data-driven recommendations = scope decision).

- **Source:** docs/01 EN-03; SOW rows 193,194; Latest Update (pulse survey); Pending Implementation (feedback surveys)
- **PRD:** EN-03
- **Roles:** hr_ops, employee
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /engagement/surveys; answer validation gaps (pack22)
- **SOW rows:** 193, 194
- **Acceptance (UI):**
  1. Create survey with 5 questions
  2. Employees respond; malformed answers rejected
  3. Analytics per question

## TE Travel & expense

### RQ-TE-001: Trip request with itineraries (flight/train/bus/hotel/car), domestic/international, purpose, visa flag, attachments, reference number; approval.

- **Source:** docs/01 TE-01/02; docs/11
- **PRD:** TE-01
- **Roles:** employee, manager
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /travel/trips(+itineraries); frontend/src/pages/travel/TravelPage.tsx
- **Acceptance (UI):**
  1. Travel > New trip domestic with 2 legs
  2. Reference number generated; RM approves

### RQ-TE-002: Per-trip budget engine by grade/level (Dom-A..F, international tiers) and policy enforcement (over-budget flagged for higher approval).

- **Source:** docs/01 TE-05/06
- **PRD:** TE-05
- **Roles:** employee, manager
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /travel/budgets
- **Acceptance (UI):**
  1. Trip budget computed per level
  2. Claim above budget flagged for extra approval

### RQ-TE-003: Travel advance linked to trip; approved advance credits immutable wallet; claim settlement nets advance; recoverable via payroll.

- **Source:** docs/01 TE-07..09
- **PRD:** TE-08/09
- **Roles:** employee, manager, payroll_admin
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /travel/advances, wallet, claims/settle; QA B-15 settled without approval
- **Acceptance (UI):**
  1. Advance 10,000 approved -> wallet +10,000
  2. Claim 8,000 settled -> recoverable 2,000 posted to payroll deduction

### RQ-TE-004: Travel claim line items with receipts, multi-currency, approval chain with send-back.

- **Source:** docs/01 TE-10/11; Temp Copy PainPoint (travel claim approval broken after 15th approval)
- **PRD:** TE-10
- **Roles:** employee, approvers
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** /travel/claims(+items,+submit)
- **Acceptance (UI):**
  1. Claim with 3 items incl. USD hotel
  2. Exchange rate captured
  3. Send back and resubmit works through all stages

### RQ-TE-005: Corporate booking connector (MakeMyTrip Corporate) behind interface; own-arrangement option.

- **Source:** docs/01 TE-03
- **PRD:** TE-03
- **Roles:** employee
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** No booking connector
- **Acceptance (UI):**
  1. Trip > Book via connector returns booking id; own arrangement with reason

### RQ-TE-006: Migrate Yatra Avedan data, parallel run, decommission.

- **Source:** docs/01 TE-12
- **PRD:** TE-12
- **Roles:** it_admin
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** plans/phase-3.5 T4 open
- **Acceptance (UI):**
  1. Migration report reconciles trips/claims/wallets counts and balances

### RQ-TE-007: International travel: visa sub-flow, multi-currency, country policy, passport/visa documents.

- **Source:** docs/01 TE-02
- **PRD:** TE-02
- **Roles:** employee, travel admin
- **Priority:** P3
- **Status:** **Partial**
- **Evidence:** te.trips.visa_status; flow not proven
- **Acceptance (UI):**
  1. International trip with visa required: visa request step and document upload; currency captured

### RQ-TE-008: Trip status machine with cancellation (reason + cancellation cost) and closure.

- **Source:** docs/01 TE-04
- **PRD:** TE-04
- **Roles:** employee, manager
- **Priority:** P3
- **Status:** **Partial**
- **Evidence:** /travel/trips/{id}
- **Acceptance (UI):**
  1. Cancel approved trip with reason and cost 2,500
  2. Status Cancelled; cost recorded; closure after settlement

### RQ-TE-009: Spend validated against approved budget; over-budget flagged for higher approval (not silently blocked).

- **Source:** docs/01 TE-06
- **PRD:** TE-06
- **Roles:** manager
- **Priority:** P3
- **Status:** **Partial**
- **Evidence:** budget engine; flag routing not proven
- **Acceptance (UI):**
  1. Claim 20% over budget routes to extra approver with flag

### RQ-TE-010: Travel advance chain RM -> HOD -> Admin/Finance (Chandan Modi) / CEO stages for high value; Sent Back status.

- **Source:** docs/01 TE-07; ERP QUICK UPDATE (loans shown to Chandan Modi)
- **PRD:** TE-07
- **Roles:** manager, HOD, finance, ceo_cell
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** travel_advance_domestic RM -> functional manager only
- **Acceptance (UI):**
  1. Advance above high-value threshold adds CEO stage; send-back returns to employee

### RQ-TE-011: Claim approval chain by amount (RM -> Travel Admin/CM -> CEO) with send_back; works beyond 15 approvals (Yatra Avedan defect).

- **Source:** docs/01 TE-11; Temp Copy PainPoint (claim approval broken after 15th approval)
- **PRD:** TE-11
- **Roles:** approvers
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** travel_claim chain RM only (definitions.seed.ts:115-117)
- **Acceptance (UI):**
  1. Claim of high amount routes 3 stages; 16th sequential approval in system works

## ATS Recruitment, offer & LOI

### RQ-ATS-001: Manpower requisition with approval (RM -> HR Head) before sourcing.

- **Source:** ATS/SOW_ATS_FINAL.docx; workflow requisition_approval
- **PRD:** RPT-05
- **Roles:** manager, hr_head
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** workflow definition only; Recruitment page is a Phase-4 placeholder (frontend/src/pages/recruitment/RecruitmentPage.tsx)
- **Acceptance (UI):**
  1. Manager raises requisition (position, vacancies, type, experience, location, JD)
  2. Approvals RM -> HR Head
  3. Approved requisition visible to recruiters

### RQ-ATS-002: Offer/LOI approval workflow in HRMS (independent of ATS): Initiator -> Plant Head (RML1) / GM (RML6) -> HR Head -> CEO; then offer generated, candidate accept/decline tracked, onboarding triggered.

- **Source:** ATS/LOI_Approval_Process_Flowchart.docx; Reports-Templates email (offer approval separate from ATS); Pending Implementation; PainPoint (offer approval)
- **PRD:** WF-01
- **Roles:** hr_ops (initiator), plant_head, hr_head, ceo_cell
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** Seed offer_approval = hr_head -> ceo_cell only (definitions.seed.ts:128-132), no offer entity/UI in HRMS
- **SOW rows:** 22
- **Acceptance (UI):**
  1. HR creates offer draft: candidate, position, CTC, probation % (70/80/90), hike %, terms, attachments
  2. Submit: routes to plant head of the plant -> HR Head -> CEO
  3. Each stage timestamped; reminders on delay
  4. After CEO approval: offer letter generated; candidate accept -> onboarding candidate created

### RQ-ATS-003: Offer stage tracker: Drafted -> Review (HRBP/Manager) -> Business Head -> HR Head -> Management -> CEO -> Issued -> Accepted/Rejected with timestamps and reminders.

- **Source:** ATS/SOW_ATS_FINAL.docx
- **PRD:** RPT-02
- **Roles:** hr_head
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** ATS scope (separate app)
- **Acceptance (UI):**
  1. Offer list shows current stage and age per offer; overdue reminder sent

### RQ-ATS-004: Pending-interview report (candidate, with whom, aging, reminders) and today's interviews (panel, time, mode, status) with calendar sync; missed-interview exception report.

- **Source:** ATS/SOW_ATS_FINAL.docx; ATS Implementation Extra.docx
- **PRD:** —
- **Roles:** hr_ops (recruiter)
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** ATS app (separate); not in HRMS
- **Acceptance (UI):**
  1. Recruiter dashboard lists today's interviews and pending feedback aging
  2. Missed interviews report lists no-shows

### RQ-ATS-005: Candidate pipeline stages: Resume screening, HR, Tech1, Tech2, Managerial, CEO, Offer discussion; candidate inbox; multi-channel sourcing; agency portal; career page; resume parsing.

- **Source:** ATS/SOW_ATS_FINAL.docx; ATS proposal PDF
- **PRD:** —
- **Roles:** hr_ops (recruiter)
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** ATS app scope (Phase 4)
- **Acceptance (UI):**
  1. Move candidate through stages; history kept; source captured

### RQ-ATS-006: Recruiter logins scoped by plant/department (15 recruiters).

- **Source:** ATS proposal PDF; Recruiter Details RML.xlsx
- **PRD:** —
- **Roles:** hr_ops
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** ATS scope
- **Acceptance (UI):**
  1. Recruiter for RML1 sees only RML1 requisitions

### RQ-ATS-007: Single sign-on between HRMS and the separate ATS app (linked accounts, PKCE handoff), no implicit account creation.

- **Source:** plans/launch-readiness/01-ATS-CONNECTED-ACCOUNTS.md; docs/02 §3
- **PRD:** NFR-03
- **Roles:** all HR roles
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** Not implemented (SSO gate open)
- **SOW rows:** 10
- **Acceptance (UI):**
  1. Linked user clicks "Open ATS" in HRMS: lands logged in to ATS
  2. Unlinked user: clear denial

### RQ-ATS-008: Excel upload of offers/joiners as an interim ATS replacement (per client: "If Excel is possible to upload we can proceed").

- **Source:** Latest Update in Protiviti (ATS)
- **PRD:** LC-01
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** /lifecycle/candidates/ingest is JSON from ATS; no Excel upload
- **SOW rows:** 129
- **Acceptance (UI):**
  1. Upload offers .xlsx
  2. Offers appear in offer report and onboarding candidates

## SVC Vendor service duties (non-software)

### RQ-SVC-001: PF operations: UAN generation/KYC, inspection support, EDLI returns, DOL updates on EPFO, Form 5A, establishment changes, joint declaration, death claims, claim rejections, notices, amendments tracking. Software only prepares data/files and records evidence; humans file/remit.

- **Source:** plans/sow-completion/08 M01; SOW rows 149,151-160
- **PRD:** PAY-09..12
- **Roles:** payroll_admin, hr_ops (process owners)
- **Priority:** P2
- **Status:** **Not software**
- **Evidence:** Manual/service duties (plans/sow-completion/08-DECISIONS-AND-OPERATIONS.md M01)
- **SOW rows:** 149, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160
- **Acceptance (UI):**
  1. Process owner keeps an evidence register (period, file checksum, acknowledgment/challan ref) per obligation
  2. Software provides the source file/report for each

### RQ-SVC-002: ESIC operations: IP generation/e-Pehchan, half-yearly submissions/audits, family updates on portal, remitted challan sharing, corrections at ESIC office, employer details update. Software only prepares data/files and records evidence; humans file/remit.

- **Source:** plans/sow-completion/08 M01; SOW rows 162,164-168
- **PRD:** PAY-09..12
- **Roles:** payroll_admin, hr_ops (process owners)
- **Priority:** P2
- **Status:** **Not software**
- **Evidence:** Manual/service duties (plans/sow-completion/08-DECISIONS-AND-OPERATIONS.md M01)
- **SOW rows:** 162, 164, 165, 166, 167, 168
- **Acceptance (UI):**
  1. Process owner keeps an evidence register (period, file checksum, acknowledgment/challan ref) per obligation
  2. Software provides the source file/report for each

### RQ-SVC-003: PT operations: enrolment/renewal, EC remittance/returns, company tax remittance, challan sharing, inspections. Software only prepares data/files and records evidence; humans file/remit.

- **Source:** plans/sow-completion/08 M01; SOW rows 171-176
- **PRD:** PAY-09..12
- **Roles:** payroll_admin, hr_ops (process owners)
- **Priority:** P2
- **Status:** **Not software**
- **Evidence:** Manual/service duties (plans/sow-completion/08-DECISIONS-AND-OPERATIONS.md M01)
- **SOW rows:** 171, 172, 173, 174, 175, 176
- **Acceptance (UI):**
  1. Process owner keeps an evidence register (period, file checksum, acknowledgment/challan ref) per obligation
  2. Software provides the source file/report for each

### RQ-SVC-004: LWF inspection/compliance reporting; regulatory query handling; audit data support; third-party loan remittance (excluded); F&F communication only via SPOC; ESIC new-joiner handoff. Software only prepares data/files and records evidence; humans file/remit.

- **Source:** plans/sow-completion/08 M01; SOW rows 125,130,140,179,217,229
- **PRD:** PAY-09..12
- **Roles:** payroll_admin, hr_ops (process owners)
- **Priority:** P2
- **Status:** **Not software**
- **Evidence:** Manual/service duties (plans/sow-completion/08-DECISIONS-AND-OPERATIONS.md M01)
- **SOW rows:** 125, 130, 140, 179, 217, 229
- **Acceptance (UI):**
  1. Process owner keeps an evidence register (period, file checksum, acknowledgment/challan ref) per obligation
  2. Software provides the source file/report for each

## JF Joining form RML/HR/02/01 (added 19 Oct 2026)

Added from the owner's three joining-form PDFs (same form; base, +medical, +Form F/ESIC-1/EPF-11 packs). Field-level map: /workspace/STATE/JOINING_FORM_MAP.md (copied to docs/qa-handover/requirements/JOINING_FORM_MAP.md).

### RQ-JF-001: Pre-join → employee conversion applies the same validation as HR create/import: PAN AAAAA9999A, Aadhaar 12 digits + Verhoeff, UAN 12 digits, IFSC AAAA0XXXXXX, account 9–18 digits, 18+ on DOJ, duplicate PAN/Aadhaar/UAN/ESIC/bank account across employees.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** hr_ops, candidate
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** lifecycle/onboarding/prejoin-schema.ts checks lengths only; onboarding.service.ts convert inserts core.employees directly; duplicate check = email/mobile/PAN only. Importer rules in bulk/importers/employees.ts.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Create a candidate and open the pre-join link
  2. Submit Aadhaar 234567890123 (bad checksum), IFSC ABCD1234567, account 1234567A
  3. Expect field errors on the portal
  4. Force-submit via API and try Convert as hr_ops
  5. Expect 400 with the same messages POST /employees gives; no employee created

### RQ-JF-002: Personal extension captured on joining and editable by HR: father's name, spouse name, marriage date, nationality, country of origin, religion, caste (optional, restricted), height, weight, physically disabled (Y/N + %), identification mark, passport no. + validity, driving licence no., name as per Aadhaar.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops, employee (view own)
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No columns on core.employees (JOINING_FORM_MAP rows 13–31).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Pre-join portal shows every field in §2 of the form
  2. HR People > Edit shows and saves them
  3. Profile > Personal shows them; caste/religion visible only to HR roles

### RQ-JF-003: Gender options Male / Female / Transgender, collected on the pre-join portal and copied on conversion.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** employee-master.router.ts enum Male/Female/Other; prejoin has no gender; convert leaves gender NULL.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Submit pre-join with gender Transgender
  2. Convert
  3. Profile shows Transgender; ESIC/PF exports carry it

### RQ-JF-004: Marital status options Single / Married / Widow / Widower / Divorcee (EPF Form 11), captured on pre-join and HR create/edit.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** core.employees.marital_status exists (display only); not in POST/PATCH /employees or prejoin.
- **SOW rows:** —
- **Acceptance (UI):**
  1. HR edit employee > marital status Widow > Save
  2. Profile shows Widow; audit row written

### RQ-JF-005: HR create/edit (POST/PATCH /employees, importer columns, EmployeeFormDrawer) covers every master field: personal e-mail, marital status, blood group, both addresses, emergency contact, plant, cost centre, functional manager.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** hr_ops, hr_head
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** employee-master.router.ts fields omit personal_email, marital_status, blood_group, addresses, emergency, plant, cost centre.
- **SOW rows:** —
- **Acceptance (UI):**
  1. HR keys a paper joining form for a walk-in joiner via People > New
  2. All §1–§5 and §9 fields save
  3. Download importer template: same columns present

### RQ-JF-006: Structured present and permanent address: house/flat, locality, city/village, post office, police station/thana, district, state (code), country, PIN (6 digits); "same as present" option; state drives PT/LWF.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** present_address/permanent_address are single text columns (prejoin min 5 chars).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Enter PIN 7000 → error "PIN must be 6 digits"
  2. Tick same as present → permanent copies
  3. Profile shows formatted address; PT state = address/work-location rule per policy

### RQ-JF-007: Emergency contact: name, relationship (persisted), mobile (10 digits), alternate number, address; at least one required.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, employee, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** emergencyContactRelation is collected by the prejoin portal and dropped on conversion (no column); no alternate/address.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Submit pre-join with relationship "Brother"
  2. Convert
  3. Profile shows relationship Brother

### RQ-JF-008: Bank details: bank, branch, account holder name, account no., IFSC, account type (savings/current); warn when holder name differs from employee name.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops, payroll_admin
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No branch/holder/type columns; prejoin label hard-codes "Savings".
- **SOW rows:** —
- **Acceptance (UI):**
  1. Enter holder name differing from employee name
  2. Expect amber warning, HR must confirm
  3. Bank file uses holder name

### RQ-JF-009: Education grid (qualification, institute/university, year of passing, specialization, % / CGPA), multiple rows, on pre-join, HR edit and profile.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops, employee
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** No table/API/UI.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Add 2 rows on pre-join
  2. After conversion, Profile > Education shows both
  3. HR can edit; audit written

### RQ-JF-010: Certification grid (name, issuing organisation, date, specialization, grade/score, expiry date) with expiry alerts.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** No table.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Add a certificate expiring in 20 days
  2. Expect it in HR expiry alerts

### RQ-JF-011: Previous employment grid (employer, designation, from, to, reason for leaving; optional last CTC, previous PF/UAN).

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** Only onboarding_candidates.previous_company (single, not copied). See RQ-CORE-024.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Add 2 employers on pre-join
  2. Profile > Experience lists them; total experience computed

### RQ-JF-012: Family grid captured on pre-join: name, relation, gender, DOB/age, Aadhaar, pre-existing disease (restricted), residing with employee (Y/N, else town/state), ESIC dependent flag.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, employee, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** core.employee_family has name/relation/dob/aadhaar/esic/nominee; no gender, disease, residing; not in prejoin.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Add spouse and child on pre-join
  2. After conversion Family tab lists both
  3. Disease visible to HR-medical only

### RQ-JF-013: Scheme-wise nominations: PF (Form 2), EPS, gratuity (Form F), ESIC (s.71), group insurance. Each holds nominee, relationship, address, age, share % (100 per scheme), minor guardian, and Form F witnesses + employer certification; a new nomination supersedes the previous one.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** employee, hr_ops
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** Single is_nominee + nominee_share_pct on employee_family for all schemes (family.service.ts).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Employee nominates spouse 100% for gratuity and mother 100% for PF
  2. Both saved separately; shares checked per scheme
  3. Form F PDF lists spouse only

### RQ-JF-014: EPF Form 11 history captured: earlier EPF member, earlier EPS member, member before 01-Sep-2014, previous UAN/PF no., exit date, scheme certificate, PPO, EPF/EPS withdrawn, international worker + country + passport; PF engine uses it for EPS eligibility (no EPS for post-Sep-2014 new members with PF wages > ₹15,000; international workers uncapped).

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops, payroll_admin
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** No fields; statutory/pf.ts cannot decide EPS eligibility per member.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Joiner: first-time member, basic ₹25,000
  2. Run payroll: employer 12% goes fully to EPF, EPS 0
  3. Joiner with pre-2014 membership: EPS 8.33% of ₹15,000

### RQ-JF-015: ESIC Form-1 data: dispensary, branch office, previous insurance no., previous employer code, family residing details; export for IP registration.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** None; ESIC registration is a portal task (RQ-SVC-002) but HRMS must hold the data.
- **SOW rows:** —
- **Acceptance (UI):**
  1. ESIC-eligible joiner: HR completes ESIC block
  2. Export "ESIC new IP" sheet with all Form-1 fields

### RQ-JF-016: Declaration and consent are recorded: §10 joining declaration, EPF undertaking (Aadhaar eKYC + fund transfer), ESIC declaration, DPDP consent for health data. Each record keeps the text version, timestamp, IP and an e-signature or uploaded signature.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** Prejoin submit has no declaration/consent; prv.consents not wired.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Pre-join submit is disabled until the declaration is ticked and signed
  2. HR sees "Declared 19-Oct-2026 10:02 IST from IP …"

### RQ-JF-017: Document checklist with upload and verification: photo, PAN, Aadhaar, bank proof, education, experience/relieving, last payslips, passport/DL, medical fitness, disability certificate. Mandatory items per category; HR verifies or rejects each with a reason; files go to the employee repository.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops, employee
- **Priority:** P0
- **Status:** **Missing**
- **Evidence:** core.documents + doc.types (pan, aadhaar, appointment, medical_fitness) but no upload/verify API or UI; photo_path never set.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Pre-join: upload PAN, Aadhaar, cheque, photo
  2. HR review shows each with Verify/Reject
  3. Convert blocked while a mandatory doc is missing or rejected
  4. Profile > Documents lists them

### RQ-JF-018: Medical questionnaire (self and family history, medications, limitations, surgeries, allergies, height/weight/BMI, lifestyle, emergency medical needs, sports) is stored in a restricted store with DPDP consent and its own permission; managers never see it.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr (medical)
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** None (variants B and C pages 5–6 / 9–10).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Candidate completes medical section
  2. Manager opening Profile sees no medical tab
  3. HR-medical role sees it; access is audited

### RQ-JF-019: HR office-use checklist on the joining record: joining formalities complete, master created, payroll set up (salary assigned), ID card/access, BGV initiated (Y/N/NA), induction scheduled (date), HR representative sign-off with date.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** Tasks it_email/it_laptop/it_biometric/admin_id_card/hr_induction only (task-fanout.service.ts); no BGV/payroll task or sign-off.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Convert a joiner
  2. Checklist shows 7 items; payroll item done only when a salary is assigned
  3. HR signs off; timestamp shown

### RQ-JF-020: Pre-filled PDF output from the master: Employee Joining Form RML/HR/02/01, Form F, ESIC Form-1 data, EPF Form 11, ready for e-sign or wet signature and stored in documents.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Missing**
- **Evidence:** Letters engine has no such templates.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Profile > Documents > Generate joining pack
  2. PDF matches the RML layout with data filled

### RQ-JF-021: Employment type maps the form's Permanent / Contract / Trainee / Consultant (+ Apprentice, Intern, Fixed-term) onto one documented field; conversion does not hard-code probationary.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** hr_ops
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** category + contract_type enums overlap; convert sets contract_type=probationary.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Convert a consultant
  2. Employee shows type Consultant, not probationary

### RQ-JF-022: Multi-step joining form UI (pre-join portal and HR "New joiner") in the RML/HR/02/01 section order with repeating-row editors, save draft, progress, review page, mobile one-hand layout (360–430px), WCAG AA.

- **Source:** owner-docs RML/HR/02/01 Employee Joining Form (3 variants, 04 Sep 2026); /workspace/STATE/JOINING_FORM_MAP.md
- **PRD:** CORE-01 / LC-01
- **Roles:** candidate, hr_ops
- **Priority:** P1
- **Status:** **Missing**
- **Evidence:** PrejoinPortalPage.tsx is a single page with 12 fields.
- **SOW rows:** —
- **Acceptance (UI):**
  1. On a 390px phone complete all steps
  2. Draft survives reload
  3. axe reports 0 serious issues


## BP Enterprise blueprint additions (added 19 Oct 2026)

Rows from the owner's Enterprise HRMS Blueprint that no existing row covers, plus core items where the blueprint widens an existing row. Full Done/Partial/Missing map of all 87 blueprint requirements: /workspace/STATE/BLUEPRINT_GAP.md (copied to docs/qa-handover/requirements/BLUEPRINT_GAP.md).

### RQ-BP-002: Position kept separate from designation; each position holds sanctioned HC, occupied HC, vacancy

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §1/§6
- **PRD:** Blueprint §1/§6
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** No position table or API.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Position kept separate from designation; each position holds sanctioned HC, occupied HC, vacancy
  3. Expect the behaviour in blueprint §1/§6; go-live: Later

### RQ-BP-020: All major HR transactions effective-dated, preserving old values (transfer, promotion, revision, designation/grade, dept/location, RM, employment-type change)

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §4; widens RQ-LC-011
- **PRD:** Blueprint §4
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** Transfers + salary revisions effective-dated; designation/grade/RM/type edits via PATCH are immediate (no effective date, no history row).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: All major HR transactions effective-dated, preserving old values (transfer, promotion, revision, designation/grade, dept
  3. Expect the behaviour in blueprint §4; go-live: Core

### RQ-BP-040: Position master (position ID/name, entity, division, location, establishment, dept, section, designation, grade, job family, job level, cost centre, budgeted/sanctioned/occupied HC, vacancy, reporting position)

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §6
- **PRD:** Blueprint §6
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Position master (position ID/name, entity, division, location, establishment, dept, section, designation, grade, job fam
  3. Expect the behaviour in blueprint §6; go-live: Later

### RQ-BP-080: OT types: normal, holiday, weekly-off, night OT, shift allowance, comp-off

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §11; widens RQ-ATT-019, RQ-PAY-022
- **PRD:** Blueprint §11
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** att.overtime_entries has one type; comp-off credit for WO; no per-type OT rates.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: OT types: normal, holiday, weekly-off, night OT, shift allowance, comp-off
  3. Expect the behaviour in blueprint §11; go-live: Core

### RQ-BP-110: Pre-payroll validation: missing bank/PAN/UAN/ESIC, abnormal salary change, negative salary, excess OT, duplicate employees, bank changes, major variances

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §14; widens RQ-PAY-008
- **PRD:** Blueprint §14
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** variance.service.ts (negative net, variance anomalies); bank-file refuses missing bank/IFSC at output time only; no pre-run missing-PAN/UAN/ESIC, excess-OT or bank-change alert.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Pre-payroll validation: missing bank/PAN/UAN/ESIC, abnormal salary change, negative salary, excess OT, duplicate employe
  3. Expect the behaviour in blueprint §14; go-live: Core

### RQ-BP-111: Excel import engine: template → upload → validate → error report → preview → maker → checker → approve → import → transaction ID → audit

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §14; widens RQ-CORE-021
- **PRD:** Blueprint §14
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** core/bulk/engine.ts + /bulk/{importer}/template|preview|jobs/{id}/report|commit; the uploader commits their own job (no checker step).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Excel import engine: template → upload → validate → error report → preview → maker → checker → approve → import → transa
  3. Expect the behaviour in blueprint §14; go-live: Core

### RQ-BP-112: Every import has an Import Batch ID and supports rollback/reversal of the complete batch (mandatory for salary, employee, attendance)

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §14; widens RQ-CORE-021
- **PRD:** Blueprint §14
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** core.bulk_jobs.id is the batch ID; savepoint rollback only on commit failure; no post-commit reversal.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Every import has an Import Batch ID and supports rollback/reversal of the complete batch (mandatory for salary, employee
  3. Expect the behaviour in blueprint §14; go-live: Core

### RQ-BP-120: Exit workflow: resignation → manager → Business Head → HR → notice → clearance → attendance freeze → leave encashment → salary/LOP → bonus/gratuity → recovery → asset clearance → F&F → finance approval → payment → relieving/experience letter → exit

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §15; widens RQ-SEP-002, RQ-SEP-005
- **PRD:** Blueprint §15
- **Roles:** per blueprint
- **Priority:** P0
- **Status:** **Partial**
- **Evidence:** lifecycle/separation (chain, ceo-review), clearances, compute-fnf, pay (row lock, E2E-022), letters; no Business Head or Finance approval step in the seeded chain.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Exit workflow: resignation → manager → Business Head → HR → notice → clearance → attendance freeze → leave encashment → 
  3. Expect the behaviour in blueprint §15; go-live: Core

### RQ-BP-121: Separation types: resignation, termination, retirement, absconding, death, contract expiry, misconduct, restructuring, mutual separation

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §15; widens RQ-SEP-003
- **PRD:** Blueprint §15
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** core.separations initiated_by employee|hr, absconding path; no separation-type enum (death/retirement change gratuity eligibility and F&F payee).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Separation types: resignation, termination, retirement, absconding, death, contract expiry, misconduct, restructuring, m
  3. Expect the behaviour in blueprint §15; go-live: Core

### RQ-BP-140: Performance: goals/KRA/KPI, weightage, mid-year, continuous feedback, self/manager appraisal, calibration, rating, increment/promotion linkage, 360, PIP

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §17
- **PRD:** Blueprint §17
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** Only the probation review form.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Performance: goals/KRA/KPI, weightage, mid-year, continuous feedback, self/manager appraisal, calibration, rating, incre
  3. Expect the behaviour in blueprint §17; go-live: Later

### RQ-BP-141: OKR hierarchy Company → Business → Department → Individual objective

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §17
- **PRD:** Blueprint §17
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: OKR hierarchy Company → Business → Department → Individual objective
  3. Expect the behaviour in blueprint §17; go-live: Later

### RQ-BP-150: Training lifecycle TNA → annual plan → nomination → training → attendance → assessment → feedback → effectiveness → record

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §18
- **PRD:** Blueprint §18
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Training lifecycle TNA → annual plan → nomination → training → attendance → assessment → feedback → effectiveness → reco
  3. Expect the behaviour in blueprint §18; go-live: Later

### RQ-BP-151: Programme types: induction, technical, behavioural, compliance, safety, ISO, POSH, fire, LOTO, HIRA, SOP, leadership

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §18
- **PRD:** Blueprint §18
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None (hr_induction is a single onboarding task).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Programme types: induction, technical, behavioural, compliance, safety, ISO, POSH, fire, LOTO, HIRA, SOP, leadership
  3. Expect the behaviour in blueprint §18; go-live: Later

### RQ-BP-152: Skill matrix employee → process → skill → required/current level → gap → training, rating 0–5

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §18/§31
- **PRD:** Blueprint §18/§31
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Skill matrix employee → process → skill → required/current level → gap → training, rating 0–5
  3. Expect the behaviour in blueprint §18/§31; go-live: Later

### RQ-BP-160: Critical-position identification, successor mapping, readiness, potential, risk, development plan

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §19
- **PRD:** Blueprint §19
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Critical-position identification, successor mapping, readiness, potential, risk, development plan
  3. Expect the behaviour in blueprint §19; go-live: Later

### RQ-BP-161: 9-box performance/potential framework and talent review

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §19
- **PRD:** Blueprint §19
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: 9-box performance/potential framework and talent review
  3. Expect the behaviour in blueprint §19; go-live: Later

### RQ-BP-181: Confidential grievance and POSH case management with restricted access, evidence, investigation, IC actions, closure

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §22
- **PRD:** Blueprint §22
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** Schema only (ird.posh_cases, ird.grievances, ird.ic_members, posh_case_access_log); no API or UI.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Confidential grievance and POSH case management with restricted access, evidence, investigation, IC actions, closure
  3. Expect the behaviour in blueprint §22; go-live: Later

### RQ-BP-192: Rewards: Star of Month/Quarter, Employee of Year, Safety, Innovation, Long Service, Spot awards with nomination/approval

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §23
- **PRD:** Blueprint §23
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Rewards: Star of Month/Quarter, Employee of Year, Safety, Innovation, Long Service, Spot awards with nomination/approval
  3. Expect the behaviour in blueprint §23; go-live: Later

### RQ-BP-201: Document version control, expiry/renewal alerts, verification, e-sign, access control, download restrictions, audit

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §24
- **PRD:** Blueprint §24
- **Roles:** per blueprint
- **Priority:** P2
- **Status:** **Partial**
- **Evidence:** core.documents.expires_on/status columns; cmp.registrations expiry for licences; no versioning, verify flow or e-sign.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Document version control, expiry/renewal alerts, verification, e-sign, access control, download restrictions, audit
  3. Expect the behaviour in blueprint §24; go-live: Core

### RQ-BP-213: Training analytics: plan vs actual, hours, cost, effectiveness, skill gaps

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §25
- **PRD:** Blueprint §25
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Training analytics: plan vs actual, hours, cost, effectiveness, skill gaps
  3. Expect the behaviour in blueprint §25; go-live: Later

### RQ-BP-220: Internal AI assistant (HR queries, policy search, requests, reports, exception analysis)

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §26
- **PRD:** Blueprint §26
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Internal AI assistant (HR queries, policy search, requests, reports, exception analysis)
  3. Expect the behaviour in blueprint §26; go-live: Later

### RQ-BP-221: AI recruitment (resume parsing, JD match, ranking, duplicates, interview questions, rediscovery)

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §26
- **PRD:** Blueprint §26
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: AI recruitment (resume parsing, JD match, ranking, duplicates, interview questions, rediscovery)
  3. Expect the behaviour in blueprint §26; go-live: Later

### RQ-BP-222: Predictive analytics (attrition risk, absenteeism, retirement, skill gaps, hiring, critical-position risk), advisory only

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §26
- **PRD:** Blueprint §26
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** Burnout index KPI only (RQ-RPT-116).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Predictive analytics (attrition risk, absenteeism, retirement, skill gaps, hiring, critical-position risk), advisory onl
  3. Expect the behaviour in blueprint §26; go-live: Later

### RQ-BP-230: Approvals: sequential, parallel, conditional, amount-, grade-, plant- and department-based

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §27; widens RQ-WF-001, RQ-WF-011
- **PRD:** Blueprint §27
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** workflow-definition.ts: sequential steps; approver = RM / FM / department_head / role / user; no parallel, condition or amount routing; plant-head step missing (RQ-WF-011).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Approvals: sequential, parallel, conditional, amount-, grade-, plant- and department-based
  3. Expect the behaviour in blueprint §27; go-live: Core

### RQ-BP-240: RBAC: Super Admin, Group HR, Legal Entity HR, Plant HR, Department HR, Manager, Employee, Payroll, Finance, Auditor

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §28; widens RQ-RBAC-001, RQ-RBAC-008
- **PRD:** Blueprint §28
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** Roles: employee, manager, hod, hr_ops, hr_head, payroll_admin, plant_head, ceo_cell, it_admin, super_admin; entity/plant HR via hr_ops scope; no Finance or read-only Auditor role.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: RBAC: Super Admin, Group HR, Legal Entity HR, Plant HR, Department HR, Manager, Employee, Payroll, Finance, Auditor
  3. Expect the behaviour in blueprint §28; go-live: Core

### RQ-BP-241: Security: encryption, MFA, SSO, audit logs, session control, password policy, IP/device controls, backups, DR, data masking

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §28; widens RQ-NFR-004, RQ-NFR-009
- **PRD:** Blueprint §28
- **Roles:** per blueprint
- **Priority:** P1
- **Status:** **Partial**
- **Evidence:** Audit hash chain, sessions page, password history, backup/restore scripts, masking; sec.mfa_enrolments table but no MFA API/UI; no SSO, no IP allow-list (except Kent webhook); PII encryption is a plan (PII_ENCRYPTION_PLAN.md).
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Security: encryption, MFA, SSO, audit logs, session control, password policy, IP/device controls, backups, DR, data mask
  3. Expect the behaviour in blueprint §28; go-live: Core

### RQ-BP-251: REST APIs, webhooks, SFTP, JSON/XML, OAuth 2.0

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §29
- **PRD:** Blueprint §29
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Partial**
- **Evidence:** REST/OpenAPI (oRPC); inbound Kent webhook + CSV drop; no outbound webhooks or OAuth2 client credentials.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: REST APIs, webhooks, SFTP, JSON/XML, OAuth 2.0
  3. Expect the behaviour in blueprint §29; go-live: Later

### RQ-BP-260: Recommended stack: React/Next + TS, Flutter mobile, Java/Spring or .NET backend, PostgreSQL, Redis, OpenSearch, AWS/Azure, object storage, Power BI

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §30
- **PRD:** Blueprint §30
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Partial**
- **Evidence:** React + TS, PostgreSQL 17 as recommended; backend is Node/TypeScript (not Java/.NET); local-disk storage; no Redis/OpenSearch; mobile plan is PWA + Capacitor (MOBILE_RECOMMENDATION.md), not Flutter. Deviation needs an owner decision, not a rewrite.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Recommended stack: React/Next + TS, Flutter mobile, Java/Spring or .NET backend, PostgreSQL, Redis, OpenSearch, AWS/Azur
  3. Expect the behaviour in blueprint §30; go-live: Later

### RQ-BP-271: Contractor manpower and labour compliance (CLRA: agency, licence, wage register, compliance)

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §31
- **PRD:** Blueprint §31
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** Only category=contract; no contractor/agency master or contract-labour registers.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Contractor manpower and labour compliance (CLRA: agency, licence, wage register, compliance)
  3. Expect the behaviour in blueprint §31; go-live: Later

### RQ-BP-273: Medical fitness, PPE, safety training, certification expiry

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §31
- **PRD:** Blueprint §31
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Partial**
- **Evidence:** doc.types medical_fitness (blue_collar) without upload; PPE only as an asset category; no safety-training or certificate-expiry records.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Medical fitness, PPE, safety training, certification expiry
  3. Expect the behaviour in blueprint §31; go-live: Later

### RQ-BP-281: Weekly vacancy, HR-pending and contractor-compliance reports

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §32
- **PRD:** Blueprint §32
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None scheduled.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Weekly vacancy, HR-pending and contractor-compliance reports
  3. Expect the behaviour in blueprint §32; go-live: Later

### RQ-BP-291: No-code form builder and report builder

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §33
- **PRD:** Blueprint §33
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Missing**
- **Evidence:** None.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: No-code form builder and report builder
  3. Expect the behaviour in blueprint §33; go-live: Later

### RQ-BP-300: Core entity set (legal_entity … import_batch, API log)

- **Source:** owner-docs "Rashmi Group HRMS Enterprise HRMS Requirements & Feature Blueprint" (docx); /workspace/STATE/BLUEPRINT_GAP.md §34
- **PRD:** Blueprint §34
- **Roles:** per blueprint
- **Priority:** P3
- **Status:** **Partial**
- **Evidence:** Present: companies, locations, plants, departments, designations, grades, cost_centers, employees, employee_family, documents, employee_history, transfers, employee_salaries, salary_components, attendance (att.*), shifts, rosters, leave (lv.*), overtime, payroll runs/items/lines, arrears, fnf, onboarding, candidates, claims, travel, assets, compliance (cmp.*), grievance (schema), helpdesk, surveys, workflow, notifications, audit_log, bulk_jobs. Missing: division, section, job_family, job_level, position, profit centre, employee_address, employee_nominee (scheme-wise), employee_bank, employee_statutory, employee_education/experience, requisition, interview, offer, training, skill, competency, performance, goal, OKR, contractor, disciplinary_case, reward, api_log.
- **SOW rows:** —
- **Acceptance (UI):**
  1. Log in as hr_head (or the owning role)
  2. Exercise: Core entity set (legal_entity … import_batch, API log)
  3. Expect the behaviour in blueprint §34; go-live: Later
