# 03 — Database Schema

PostgreSQL 16, database `hrms`. Conventions:

- Schemas group modules: `core`, `att`, `lv`, `pay`, `wf`, `ast`, `hd`, `eng`.
- Every table: `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` (trigger-maintained). These are not repeated below.
- Soft state via explicit `status` enums — no boolean graveyards. Deletes are rare; history tables and ledgers preserve truth.
- Money: `NUMERIC(14,2)`. Rates/percentages: `NUMERIC(7,4)`. All timestamps `timestamptz`; all business dates `date` (IST semantics).
- Every column below has a stated purpose. If a column has no requirement ID or operational necessity behind it, it does not exist.

---

## 1. Auth & access (`core`)

```sql
CREATE TABLE core.users (
  id            BIGINT ...,
  employee_id   BIGINT REFERENCES core.employees,  -- NULL for pure-admin/service accounts; links login to person
  email         CITEXT UNIQUE NOT NULL,            -- login identifier; company email (Recruiter Details shows @rashmigroup.com)
  password_hash TEXT NOT NULL,                     -- bcrypt
  is_active     BOOLEAN NOT NULL DEFAULT true,     -- disable login on exit (LC-07) without deleting history
  last_login_at TIMESTAMPTZ,                       -- security review / dormant-account cleanup
  failed_attempts SMALLINT NOT NULL DEFAULT 0,     -- lockout counter (NFR-03)
  locked_until  TIMESTAMPTZ                        -- lockout expiry
);

CREATE TABLE core.roles (          -- e.g. employee, manager, hr_ops, hr_head, payroll, plant_head, ceo_cell, it_admin, super_admin
  code TEXT UNIQUE NOT NULL,       -- stable machine name used in permission checks
  name TEXT NOT NULL               -- display label
);

CREATE TABLE core.permissions (    -- module × action grid (CORE-10)
  code TEXT UNIQUE NOT NULL        -- e.g. 'attendance.muster.export', 'payroll.run.finalize', 'employee.compensation.read'
);

CREATE TABLE core.role_permissions (
  role_id BIGINT NOT NULL REFERENCES core.roles,
  permission_id BIGINT NOT NULL REFERENCES core.permissions,
  UNIQUE(role_id, permission_id)
);

CREATE TABLE core.user_roles (
  user_id BIGINT NOT NULL REFERENCES core.users,
  role_id BIGINT NOT NULL REFERENCES core.roles,
  scope_org_unit_id BIGINT REFERENCES core.org_units, -- optional: restrict a role to an entity/plant (e.g. plant_head of Plant 1701 only)
  UNIQUE(user_id, role_id, scope_org_unit_id)
);

CREATE TABLE core.audit_log (      -- append-only (CORE-11, NFR-04); INSERT-only enforced by trigger
  actor_user_id BIGINT REFERENCES core.users,  -- who did it (NULL = system job)
  action  TEXT NOT NULL,           -- 'update' | 'create' | 'delete' | 'login' | 'approve' | 'finalize' ...
  entity  TEXT NOT NULL,           -- table or domain name, e.g. 'core.employees'
  entity_id BIGINT,                -- which record
  field   TEXT,                    -- which column (for field-level changes)
  old_value TEXT, new_value TEXT,  -- values as text; sensitive fields stored masked
  ip      INET,                    -- source of auth events
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON core.audit_log (entity, entity_id, at);
```

## 2. Organization structure (`core`)

```sql
CREATE TABLE core.companies (      -- legal entities (confirmed live, 09-RECON §10.1): RML (Rashmi Metaliks), RGH, EIPL (eHoome IOT),
                                   -- RPF (Rashmi Pipes & Fittings, Dubai), RPL (Rashmi Paradigm Ltd), RDL (Rashmi/Reach Dredging — confirm)
  code TEXT UNIQUE NOT NULL,       -- 'RML','RGH','EIPL','RPF','RPL','RDL' — also the e-code prefix (CORE-02)
  name TEXT NOT NULL,              -- 'Rashmi Metaliks Limited'
  ecode_next_seq INTEGER NOT NULL, -- next employee-code number for this entity; sequence-enforced generation (CORE-02)
  ecode_format TEXT NOT NULL,      -- e.g. 'RML0#####' — zero-padded template so codes match legacy series
  gstin TEXT, pan TEXT,            -- appear on statutory outputs and payslip footer (PAY-06)
  pf_establishment_code TEXT,      -- EPFO establishment id — required in ECR file (PAY-09)
  esic_code TEXT,                  -- ESIC employer code — required on ESIC returns (PAY-10)
  pt_registration_no TEXT,         -- WB PT enrolment — PT return (PAY-11)
  tan TEXT,                        -- TDS deductor number — 24Q/Form16 (PAY-13)
  address TEXT                     -- letterheads and statutory forms
);

CREATE TABLE core.locations (      -- physical sites: Kharagpur plant, Kolkata HO, Dubai — holiday calendars & muster grouping (ATT-13)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  name TEXT NOT NULL,              -- 'Kharagpur Plant', 'Kolkata HO'
  state_code TEXT NOT NULL,        -- 'WB' — selects PT slab table & LWF rates (PAY-11/12)
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'
);

CREATE TABLE core.cost_centers (   -- e.g. plant 1701 / Substore (PP-8, CORE-04)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  code TEXT NOT NULL,              -- '1701' — matches SAP cost center for JV mapping (§6.7)
  name TEXT NOT NULL,              -- human label shown in muster/cost reports
  UNIQUE(company_id, code)
);

CREATE TABLE core.departments (    -- 'Human Resource', 'CEO Cell' … (Recruiter Details columns)
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE core.org_units (      -- OU per Recruiter Details ('Rashmi Metaliks Limited', 'eHoome iOT…'); reporting rollup for BU dashboards (RPT-04)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  parent_id BIGINT REFERENCES core.org_units,  -- tree for BU rollups
  name TEXT NOT NULL
);

CREATE TABLE core.designations (   -- 'Deputy Manager', 'AGM-HR' … free-ish list, validated: special chars stripped (CORE-08)
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE core.grades (         -- pay bands driving salary templates & loan eligibility (PAY-01, LN-01)
  code TEXT UNIQUE NOT NULL,       -- 'E1', 'M3' …
  name TEXT NOT NULL,
  rank SMALLINT NOT NULL           -- ordering for "leadership percentage" KPI (CEO dashboard: Leadership % needs a cutoff rank)
);
```

## 3. Employee master (`core`) — the most important table

```sql
CREATE TYPE core.employment_category AS ENUM
  ('white_collar','blue_collar','trainee','consultant','contract');  -- CEO dashboard splits (CORE-05); 'contract' reserved (D3)

CREATE TYPE core.employee_status AS ENUM
  ('onboarding','active','on_notice','exited');                      -- lifecycle (CORE-06)

CREATE TYPE core.contract_type AS ENUM
  ('permanent','temporary','probationary','consultant','fixed_term');-- LOI §4 Employment Terms

CREATE TABLE core.employees (
  id BIGINT ...,
  -- identity
  ecode         TEXT UNIQUE NOT NULL,   -- 'RML032772' — generated per company series (CORE-02); THE identifier on every report
  company_id    BIGINT NOT NULL REFERENCES core.companies,
  first_name    TEXT NOT NULL,
  last_name     TEXT,                   -- some legacy names are single-token ('Rachna') — hence nullable
  photo_path    TEXT,                   -- ESS/profile display
  gender        TEXT,                   -- ESIC returns & demographics reporting require it
  dob           DATE NOT NULL,          -- minor check (CORE-08), age KPIs (CEO: Average Age), retirement projection
  marital_status TEXT,                  -- tax (some exemptions) + ESIC family declarations
  blood_group   TEXT,                   -- plant-safety requirement for factory ID cards (standard steel-plant practice; on ID card print)
  -- contact
  personal_email TEXT,                  -- pre-joining link + payslip fallback + alumni contact (LC-01, LC-07)
  work_email     CITEXT UNIQUE,         -- SSO login + notifications; assigned by IT during onboarding (LC-02)
  mobile         TEXT NOT NULL,         -- alerts/OTP; column in attendance report (PP-25)
  emergency_contact_name TEXT, emergency_contact_phone TEXT, -- plant safety
  present_address TEXT, permanent_address TEXT,              -- LOI §1, PF/ESIC forms
  -- employment
  category      core.employment_category NOT NULL,  -- CORE-05
  contract_type core.contract_type NOT NULL,        -- LOI §4
  contract_end_date DATE,               -- only for fixed_term/consultant; renewal alerts
  doj           DATE NOT NULL,          -- date of joining — proration, tenure KPI, new-hire attrition (RPT-03)
  dol           DATE,                   -- date of leaving — set exactly once at exit (LC-07, PP-17)
  status        core.employee_status NOT NULL DEFAULT 'onboarding',
  exit_reason   TEXT,                   -- attrition analytics + EPFO date-of-leaving reason (SOW-5.10.5)
  designation_id BIGINT NOT NULL REFERENCES core.designations,
  department_id  BIGINT NOT NULL REFERENCES core.departments,
  org_unit_id    BIGINT NOT NULL REFERENCES core.org_units,
  location_id    BIGINT NOT NULL REFERENCES core.locations,   -- holiday calendar + muster grouping
  cost_center_id BIGINT NOT NULL REFERENCES core.cost_centers,-- PP-8; every employee must carry one
  grade_id       BIGINT REFERENCES core.grades,               -- salary template + leadership KPI
  reporting_manager_id  BIGINT REFERENCES core.employees,     -- approval chains + muster column (CORE-03, PP-5)
  functional_manager_id BIGINT REFERENCES core.employees,     -- dotted-line manager; master-report column (PI-PAY-8)
  -- probation & confirmation (LC-04, PAY-02)
  probation_months     SMALLINT,        -- from LOI ('Probation Duration')
  probation_salary_pct SMALLINT,        -- 70 | 80 | 90 (LOI §3; PI-ESS-1)
  probation_due_date   DATE,            -- doj + probation_months; reminder driver
  confirmation_date    DATE,            -- set by confirmation workflow; triggers salary switch
  -- statutory identifiers (CORE-07; all validated per CORE-08)
  pan TEXT, aadhaar TEXT,               -- masked outside payroll permission (NFR-03)
  uan TEXT, pf_number TEXT,             -- payslip print (PP-4) + ECR
  esic_ip_number TEXT,                  -- ESIC returns; only when gross ≤ threshold
  pf_applicable BOOLEAN NOT NULL DEFAULT true,   -- apprentices/consultants excluded (PAY-14)
  esic_applicable BOOLEAN NOT NULL DEFAULT false,-- derived at hire from gross, re-evaluated each contribution period
  pt_applicable BOOLEAN NOT NULL DEFAULT true,
  lwf_applicable BOOLEAN NOT NULL DEFAULT true,
  tax_regime TEXT NOT NULL DEFAULT 'new',        -- 'old'|'new' — employee election (PAY-13)
  -- banking (payroll)
  bank_name TEXT, bank_account TEXT, bank_ifsc TEXT,  -- bank transfer file (PAY-05); length/IFSC validation (CORE-08)
  payment_mode TEXT NOT NULL DEFAULT 'bank',          -- 'bank'|'cheque'|'hold' — some blue-collar cases
  -- attendance linkage
  access_card_no TEXT,                  -- Kent card id (EmployeeSwipeDetails 'Access Card'); maps device swipes → employee
  biometric_registered BOOLEAN NOT NULL DEFAULT false, -- onboarding checklist telemetry (LC-02)
  attendance_mode TEXT NOT NULL DEFAULT 'biometric'    -- 'biometric'|'mobile'|'manual' — sales staff use mobile (ATT-14)
);
CREATE INDEX ON core.employees (status, company_id);
CREATE INDEX ON core.employees (reporting_manager_id);

-- Reporting-tree closure (CORE-10, KQ multi-level access): maintained by trigger on reporting_manager_id
CREATE TABLE core.reporting_tree (   -- company-AGNOSTIC: a manager may have reports in another entity (live: RPL DGM approves RDL staff, 09-RECON §10.3)
  manager_id BIGINT NOT NULL, employee_id BIGINT NOT NULL, depth SMALLINT NOT NULL,
  PRIMARY KEY (manager_id, employee_id)
);

CREATE TABLE core.employee_history ( -- position/comp change log: every transfer/promotion/manager change (LC-05; promotion report RPT-05)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  effective_date DATE NOT NULL,
  change_type TEXT NOT NULL,        -- 'transfer_department'|'transfer_location'|'transfer_entity'|'promotion'|'manager_change'|'confirmation'|'category_change'
  field TEXT NOT NULL, old_value TEXT, new_value TEXT,
  reference_id BIGINT               -- link to the workflow request that caused it
);

CREATE TABLE core.employee_family ( -- ESIC family declaration (SOW-5.10 ESIC 'family members details') + gratuity/PF nominee
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  name TEXT NOT NULL, relation TEXT NOT NULL, dob DATE,
  aadhaar TEXT,                     -- ESIC portal requires it for dependents
  is_esic_dependent BOOLEAN NOT NULL DEFAULT false,
  is_nominee BOOLEAN NOT NULL DEFAULT false, nominee_share_pct NUMERIC(5,2) -- PF/gratuity nomination forms
);

CREATE TABLE core.employee_education ( -- LOI attachments checklist ('Educational Documents'); background-verification record
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  qualification TEXT NOT NULL, institution TEXT, year_of_passing SMALLINT, document_id BIGINT REFERENCES core.documents
);

CREATE TABLE core.employee_prev_employment ( -- SOW-3.2g 'capturing previous employment details'; LTA/gratuity continuity in F&F (SOW-10.1)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  company TEXT NOT NULL, designation TEXT, from_date DATE, to_date DATE,
  last_drawn_ctc NUMERIC(14,2),     -- offer benchmarking (LOI 'Current Salary')
  pf_member_id TEXT                 -- PF transfer-in support
);

CREATE TABLE core.documents (       -- single file registry for all uploads (ID proofs, certificates, letters, payslip PDFs)
  owner_employee_id BIGINT REFERENCES core.employees,
  kind TEXT NOT NULL,               -- 'aadhaar'|'pan'|'education'|'experience_letter'|'offer_letter'|'relieving_letter'|'policy'|'payslip'|...
  path TEXT NOT NULL,               -- MinIO object key (bucket/key); DB stores the reference, bytes live in MinIO
  original_name TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  uploaded_by BIGINT REFERENCES core.users
);

CREATE TABLE core.letters (         -- generated letters (CORE-09); templates in core.letter_templates
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  template_code TEXT NOT NULL,      -- 'appointment'|'confirmation'|'experience'|'relieving'|'salary_certificate'|'show_cause'|'warning'
  document_id BIGINT NOT NULL REFERENCES core.documents,  -- rendered docx/pdf
  issued_by BIGINT REFERENCES core.users, issued_at TIMESTAMPTZ,
  workflow_request_id BIGINT        -- approval chain that authorized issuance (PP-14: letters must go through the system)
);

CREATE TABLE core.letter_templates (
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  body_docx_document_id BIGINT NOT NULL REFERENCES core.documents, -- docx with merge fields
  merge_fields JSONB NOT NULL       -- declared fields, validated against employee data at render time
);

CREATE TABLE core.policies (        -- CORE-13 policy repository
  title TEXT NOT NULL, document_id BIGINT NOT NULL REFERENCES core.documents,
  effective_date DATE NOT NULL, requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
  audience JSONB                    -- optional filter: categories/departments/locations
);

CREATE TABLE core.policy_acknowledgments (
  policy_id BIGINT NOT NULL REFERENCES core.policies,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  acknowledged_at TIMESTAMPTZ NOT NULL,
  UNIQUE(policy_id, employee_id)    -- real-time tracking tile = policies × active employees minus these rows
);
```

## 4. Attendance (`att`)

```sql
CREATE TABLE att.devices (          -- Kent/Astra doors ('Seamless-Plant_S4', 'Seamless-Plant_G4') — health board (ATT-02)
  source TEXT NOT NULL,             -- 'kent' | 'mobile'
  door_code TEXT UNIQUE NOT NULL,   -- Door/Address from swipe export
  location_id BIGINT REFERENCES core.locations,
  last_seen_at TIMESTAMPTZ,         -- gap detection input
  expected_hourly_swipes NUMERIC(8,2), -- rolling average; zero-against-average triggers offline alert
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE att.device_watermarks ( -- P1-T07 / doc 14 §8.5: completeness, distinct from heartbeat/source cursor
  device_id BIGINT PRIMARY KEY REFERENCES att.devices ON DELETE CASCADE,
  watermark_ts TIMESTAMPTZ NOT NULL, -- connector has proved this door has no ingestion gap through this instant
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- DB trigger rejects watermark regression. Swipe arrival and last_seen_at alone
-- never advance this cursor; only an explicit connector completeness receipt may.

CREATE TABLE att.swipe_events (     -- RAW, immutable (ATT-01). Columns mirror EmployeeSwipeDetails.xlsx so any Kent export loads losslessly.
  employee_id BIGINT REFERENCES core.employees, -- resolved from access_card/employee_no; NULL if unmatched (exception queue)
  employee_no TEXT NOT NULL,        -- as sent by Kent ('RGH033256') — kept verbatim for reconciliation
  access_card TEXT,                 -- card id as sent
  shift_label TEXT,                 -- Kent's shift field ('RGH-Gen-C','Default') — diagnostic only; our shift comes from roster
  swipe_ts TIMESTAMPTZ NOT NULL,    -- 'Swipe Date'
  door_code TEXT,                   -- 'Door/Address' → att.devices
  longitude NUMERIC(9,6), latitude NUMERIC(9,6), location_type TEXT, -- mobile/geo check-ins (ATT-14); Kent sends blank
  mobile_device_name TEXT, mobile_device_id TEXT,  -- mobile check-in device fingerprint (fraud review)
  swipe_type TEXT,                  -- 'Astra' etc. — source system tag
  direction TEXT,                   -- 'in'|'out'|NULL — Kent 'Status'; NULL means infer from first/last
  remarks TEXT, permission_reason TEXT, signed_by TEXT, -- Kent passthrough columns (present in export; kept for audit parity)
  received_at TIMESTAMPTZ NOT NULL, -- Kent 'Received On' — measures device→cloud lag (the PP-9 failure signal)
  source TEXT NOT NULL DEFAULT 'kent',            -- 'kent'|'mobile'|'manual'
  UNIQUE (employee_no, swipe_ts, door_code)        -- idempotent ingestion key
);
CREATE INDEX ON att.swipe_events (employee_id, swipe_ts);

CREATE TABLE att.shifts (           -- ATT-04 / SOW-4.1
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,   -- 'GEN', 'A', 'B', 'C', 'NIGHT'
  start_time TIME NOT NULL, end_time TIME NOT NULL,
  crosses_midnight BOOLEAN NOT NULL DEFAULT false, -- night shifts: attendance date attribution rule
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,    -- late-coming grace (SOW-4.5a)
  grace_out_minutes SMALLINT NOT NULL DEFAULT 0,
  min_half_day_hours NUMERIC(4,2) NOT NULL,        -- below this = absent; between this and min_full = half day (ATT-05)
  min_full_day_hours NUMERIC(4,2) NOT NULL,
  break_minutes SMALLINT NOT NULL DEFAULT 0        -- net-hours computation
);

CREATE TABLE att.rosters (          -- manager-maintained month roster (ATT-04); one row per employee-date
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  work_date DATE NOT NULL,
  shift_id BIGINT REFERENCES att.shifts,           -- NULL + is_week_off=true = week-off day
  is_week_off BOOLEAN NOT NULL DEFAULT false,
  set_by BIGINT REFERENCES core.users,             -- manager accountability (Agreement 4.1a: roster by managers by 5th)
  UNIQUE(employee_id, work_date)
);

CREATE TABLE att.holidays (         -- ATT-13; per location
  location_id BIGINT NOT NULL REFERENCES core.locations,
  holiday_date DATE NOT NULL, name TEXT NOT NULL,
  UNIQUE(location_id, holiday_date)
);

CREATE TYPE att.day_status AS ENUM
  ('P','A','HD','WO','H','L','OD','CO','UAB');     -- Present/Absent/HalfDay/WeekOff/Holiday/Leave/OnDuty/CompOff/UnauthorizedAbsence (ATT-05)
-- Two-session days (09-RECON §4): RML shifts split into Session 1 / Session 2 (G5 09:00-13:30 / 13:31-18:00);
--   a day may hold a dual status (A:P, P:O). day_records carries an optional per-session breakdown below.

CREATE TABLE att.day_records (      -- PROCESSED attendance; recomputable from raw until locked (ATT-03)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  work_date DATE NOT NULL,
  shift_id BIGINT REFERENCES att.shifts,           -- effective shift that day (roster resolution)
  status att.day_status NOT NULL,
  leave_type_id BIGINT REFERENCES lv.leave_types,  -- when status='L': which leave
  first_in TIMESTAMPTZ, last_out TIMESTAMPTZ,      -- from swipes; muster drill-down
  worked_minutes INTEGER,                          -- net of break; feeds OT + productivity KPIs (CEO: output/man-hour)
  late_minutes SMALLINT NOT NULL DEFAULT 0,        -- vs shift start + grace (ATT-11 alerts, deduction policy SOW-4.5b)
  early_exit_minutes SMALLINT NOT NULL DEFAULT 0,
  ot_minutes SMALLINT NOT NULL DEFAULT 0,          -- detected OT (pre-approval); payable only via att.overtime_entries
  weekoff_paid BOOLEAN,                            -- week-off eligibility outcome (ATT-09): computed at week close
  source TEXT NOT NULL DEFAULT 'auto',             -- 'auto'|'regularized'|'manual' — manual requires HR permission + audit
  is_locked BOOLEAN NOT NULL DEFAULT false,        -- month lock (ATT-15); locked rows immutable by trigger
  session_statuses JSONB,                          -- optional dual-session breakdown [{session:1,status:'A'},{session:2,status:'P'}] for split shifts (09-RECON §4); NULL = single-status day
  scheme_code TEXT,                                -- effective attendance scheme that day (e.g. 'GCS' Saturday scheme vs weekday 'G5')
  penalty_flag BOOLEAN NOT NULL DEFAULT false,     -- attendance-penalty policy outcome ("Penalty Days" live metric)
  computed_at TIMESTAMPTZ,
  UNIQUE(employee_id, work_date)
);
CREATE INDEX ON att.day_records (work_date, status);

CREATE TABLE att.regularizations (  -- AR (ATT-06) and OD (ATT-07) requests
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  kind TEXT NOT NULL,               -- 'AR' | 'OD' | 'PERMISSION' (short time-bounded exception, 09-RECON §5)
  from_date DATE NOT NULL, to_date DATE NOT NULL,  -- OD may be future-dated (KQ); AR past-only — validator enforces
  from_time TIME, to_time TIME,     -- partial-day OD; required for PERMISSION (the bounded hours)
  reason TEXT NOT NULL,             -- mandatory justification (audit)
  requested_status att.day_status NOT NULL,        -- what the day should become ('P' for AR, 'OD' for OD)
  workflow_request_id BIGINT NOT NULL,             -- approval chain instance (WF-01)
  applied BOOLEAN NOT NULL DEFAULT false           -- set when approved AND day_records recomputed
);

CREATE TABLE att.overtime_entries ( -- ATT-08: the 48-hour rule
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  work_date DATE NOT NULL,
  detected_minutes SMALLINT NOT NULL,   -- from swipes beyond shift
  claimed_minutes SMALLINT NOT NULL,    -- what goes for approval (≤ detected; rounding policy applied)
  approved_minutes SMALLINT,            -- manager decision
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'approved'|'rejected'|'lapsed'|'converted_comp_off'
  manager_id BIGINT REFERENCES core.employees, -- who must act (daily OT summary recipient)
  decided_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ NOT NULL,     -- intimation + 48h (Protiviti Status doc); lapse job flips status
  comp_off_credit_id BIGINT REFERENCES lv.ledger, -- set when employee/policy chose comp-off instead of pay (Agreement 5.1.6)
  payroll_item_id BIGINT,               -- set when paid — proves each OT minute lands in exactly one place
  UNIQUE(employee_id, work_date)
);

CREATE TABLE att.absence_cases (    -- ATT-10: 7–10 day continuous-absence engine
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  start_date DATE NOT NULL,
  days_absent SMALLINT NOT NULL,        -- rolling count while open
  stage TEXT NOT NULL DEFAULT 'watch',  -- 'watch'(≥4d) → 'show_cause'(≥7d) → 'warning' → 'termination_review' (PP-7 strict process)
  letter_id BIGINT REFERENCES core.letters,  -- issued show-cause/warning letter
  hr_owner_id BIGINT REFERENCES core.users,  -- routed 'through an official HR email' (PP-9 instruction)
  resolution TEXT,                       -- 'returned'|'regularized'|'exited'|NULL while open
  closed_at TIMESTAMPTZ
);

CREATE TABLE att.month_locks (      -- ATT-15; payroll precondition
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL,              -- first of month
  locked_by BIGINT NOT NULL REFERENCES core.users, locked_at TIMESTAMPTZ NOT NULL,
  UNIQUE(company_id, month)
);
```

## 5. Leave (`lv`)

```sql
CREATE TABLE lv.leave_types (       -- LV-01 (SOW-4.3a): CL, SL, EL, ML, CO, LWP
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT true,           -- LWP=false → LOP feed to payroll
  accrual_per_month NUMERIC(5,2) NOT NULL DEFAULT 0, -- monthly credit amount (LV-02); 0 = granted, not accrued
  accrual_requires_service_months SMALLINT NOT NULL DEFAULT 0, -- EL only after 12 months (Latest-Update 'Earned Leave')
  max_carry_forward NUMERIC(5,2),   -- year-end carry rule (SOW-4.3e); NULL = unlimited
  encashable BOOLEAN NOT NULL DEFAULT false,       -- EL encashment in F&F (PAY-15)
  max_per_request NUMERIC(4,1),     -- policy cap
  allow_half_day BOOLEAN NOT NULL DEFAULT true,
  sandwich_rule TEXT NOT NULL DEFAULT 'exclude',   -- 'include'|'exclude' holidays/week-offs inside a leave span (LV-03)
  applicable_categories core.employment_category[] -- e.g. ML rules, trainee restrictions
);

CREATE TABLE lv.ledger (            -- LV-05: immutable transactions; balance = SUM(delta)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  leave_type_id BIGINT NOT NULL REFERENCES lv.leave_types,
  txn_type TEXT NOT NULL,           -- 'accrual'|'grant'|'application'|'cancel'|'lapse'|'encash'|'comp_off_earn'|'adjustment'
  delta NUMERIC(5,2) NOT NULL,      -- + credit / − debit
  effective_date DATE NOT NULL,
  expiry_date DATE,                 -- comp-off expiry window (LV-04)
  reference_id BIGINT,              -- application id / payroll run id / OT entry id that caused it
  note TEXT,                        -- mandatory for 'adjustment' (audited manual correction)
  created_by BIGINT REFERENCES core.users -- NULL = system job (LV-02 auto-credit)
);
CREATE INDEX ON lv.ledger (employee_id, leave_type_id, effective_date);

CREATE TABLE lv.applications (      -- LV-03
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  leave_type_id BIGINT NOT NULL REFERENCES lv.leave_types,
  from_date DATE NOT NULL, to_date DATE NOT NULL,
  from_half BOOLEAN NOT NULL DEFAULT false, to_half BOOLEAN NOT NULL DEFAULT false, -- half-day support
  days NUMERIC(4,1) NOT NULL,       -- computed net of sandwich rule; snapshot for payroll
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'cancelled'
  workflow_request_id BIGINT NOT NULL,
  ledger_txn_id BIGINT REFERENCES lv.ledger  -- debit created on approval; reversal on cancel
);
```
Comp-off earn: approved week-off/holiday work creates `lv.ledger (txn_type='comp_off_earn', expiry_date = earn_date + policy window)` linked from `att.overtime_entries.comp_off_credit_id` (LV-04).

## 6. Payroll & statutory (`pay`)

```sql
-- Live RML component seed (09-RECON §2): earnings BASIC, HRA (=BASIC*0.5), MEDICAL_ALLOW (1250 fixed),
--   SPECIAL_ALLOW, EDUCATION_ALLOW (200 fixed), BONUS (monthly statutory);
--   deductions PF_EE (12% of FULL basic — RML does NOT cap at 15k for its deduction base; EPS split still capped),
--   PT (WB slab, 200 top), plus recovery components e.g. GUEST_HOUSE (per-employee variable via pay.inputs).
CREATE TABLE pay.salary_components ( -- PAY-01; model ported from Frappe HR's Salary Component
  code TEXT UNIQUE NOT NULL,        -- 'BASIC','HRA','MEDICAL_ALLOW','SPECIAL_ALLOW','EDUCATION_ALLOW','BONUS','PF_EE','PF_ER','ESI_EE','PT','TDS','LWF','OT','LOP','GUEST_HOUSE',...
  name TEXT NOT NULL,               -- payslip line label (must match RML payslip template — PAY-06)
  kind TEXT NOT NULL,               -- 'earning'|'deduction'|'employer_contribution' (employer side prints on CTC sheet, not payslip net)
  formula TEXT,                     -- expression over other components/vars, e.g. 'BASIC * 0.4'; NULL = fixed amount per employee
  rounding TEXT NOT NULL DEFAULT 'round', -- 'round'|'floor' — statutory components have mandated rounding
  taxable BOOLEAN NOT NULL DEFAULT true,  -- feeds TDS projection
  part_of_gross BOOLEAN NOT NULL DEFAULT true,   -- ESIC gross determination (PAY-10)
  part_of_pf_wages BOOLEAN NOT NULL DEFAULT false, -- PF wage base flag (usually BASIC [+DA])
  prorate_on_lop BOOLEAN NOT NULL DEFAULT true,    -- most earnings prorate; some (e.g., statutory bonus) don't
  display_order SMALLINT NOT NULL   -- payslip line order — fixed template (PP-3)
);

CREATE TABLE pay.salary_structures ( -- template per grade/category/location (PAY-01, SOW-2.2a)
  name TEXT UNIQUE NOT NULL,        -- 'White Collar E1 — Kharagpur'
  company_id BIGINT NOT NULL REFERENCES core.companies,
  components JSONB NOT NULL,        -- ordered [{component_code, formula_override|amount_rule}] — template rows
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE pay.employee_salaries ( -- effective-dated assignment (PAY-16 arrears need history)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  structure_id BIGINT NOT NULL REFERENCES pay.salary_structures,
  effective_from DATE NOT NULL,     -- revision effective date (SOW-5.2.1)
  annual_ctc NUMERIC(14,2) NOT NULL,-- must equal sum of annualized components (CORE-08 CTC-vs-breakup check)
  phase TEXT NOT NULL DEFAULT 'confirmed', -- 'probation'|'confirmed' — PAY-02 auto-switch writes a new row at confirmation
  component_amounts JSONB NOT NULL, -- resolved {code: monthly_amount} snapshot — payslips never depend on later template edits
  revision_reason TEXT,             -- 'annual_increment'|'promotion'|'confirmation'|'correction'
  approved_by BIGINT REFERENCES core.users,
  UNIQUE(employee_id, effective_from)
);

CREATE TABLE pay.payroll_runs (     -- PAY-03 pipeline state machine
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL,              -- first of month
  run_type TEXT NOT NULL DEFAULT 'regular', -- 'regular'|'off_cycle'|'fnf'|'bonus'|'arrears'
  status TEXT NOT NULL DEFAULT 'draft',     -- 'draft'→'inputs_locked'→'computed'→'under_review'→'approved'→'finalized' (immutable)|'reopened'(audited)
  attendance_lock_id BIGINT REFERENCES att.month_locks, -- hard precondition (ATT-12/15): no run without locked attendance
  computed_at TIMESTAMPTZ, finalized_at TIMESTAMPTZ,
  finalized_by BIGINT REFERENCES core.users,
  notes TEXT,
  UNIQUE(company_id, month, run_type)
);

CREATE TABLE pay.payroll_items (    -- one row per employee per run: the payslip header
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  days_in_month NUMERIC(4,1) NOT NULL,   -- proration base per policy (SOW-5.4: calendar/fixed)
  payable_days NUMERIC(4,1) NOT NULL,    -- from locked attendance: P+HD/2+WO(paid)+H+L(paid)+OD+CO
  lop_days NUMERIC(4,1) NOT NULL DEFAULT 0,       -- LWP + UAB + unpaid week-offs (ATT-09)
  lop_reversal_days NUMERIC(4,1) NOT NULL DEFAULT 0, -- previous-month LOP corrections (SOW-5.4e)
  ot_minutes INTEGER NOT NULL DEFAULT 0,  -- approved OT paid this run (from att.overtime_entries)
  gross NUMERIC(14,2) NOT NULL, total_deductions NUMERIC(14,2) NOT NULL, net_pay NUMERIC(14,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'payable', -- 'payable'|'hold_payment'|'hold_process' (PAY-08 / SOW-5.7)
  payslip_document_id BIGINT REFERENCES core.documents, -- rendered PDF (PAY-06)
  UNIQUE(run_id, employee_id)
);

CREATE TABLE pay.payroll_item_lines ( -- payslip lines: component × amount (audit + variance report needs line level)
  item_id BIGINT NOT NULL REFERENCES pay.payroll_items,
  component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
  amount NUMERIC(14,2) NOT NULL,
  calc_note TEXT                    -- human-readable formula trace, e.g. 'BASIC 40000 × 28.5/30' — explainability (design principle: no black boxes)
);

CREATE TABLE pay.inputs (           -- ad-hoc monthly variable inputs (SOW-5.1.1): incentives, deductions, adjustments
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  component_code TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL,
  note TEXT NOT NULL, entered_by BIGINT NOT NULL REFERENCES core.users -- who keyed it (input audit; active-status check CORE-06 enforced by validator)
);

CREATE TABLE pay.salary_holds (     -- PAY-08 exactly per SOW-5.7 scenarios
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  hold_type TEXT NOT NULL,          -- 'payment' (process fully, drop from bank file) | 'process' (full LOP until release)
  reason TEXT NOT NULL, start_month DATE NOT NULL, released_month DATE,
  created_by BIGINT NOT NULL REFERENCES core.users
);

CREATE TABLE pay.arrears (          -- PAY-16: revision arrears, component-wise
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  source_salary_id BIGINT NOT NULL REFERENCES pay.employee_salaries, -- the revision that caused it
  for_month DATE NOT NULL,          -- month being corrected
  paid_in_run_id BIGINT REFERENCES pay.payroll_runs,
  component_code TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL
);

-- 6.8 Statutory configuration (versioned DATA, not code — Budget/notification updates are rows)
CREATE TABLE pay.statutory_rates (
  scheme TEXT NOT NULL,             -- 'pf'|'eps'|'edli'|'pf_admin'|'esic_ee'|'esic_er'|'lwf_wb_ee'|'lwf_wb_er'|'gratuity'|'bonus'
  param TEXT NOT NULL,              -- 'rate'|'wage_ceiling'|'eligibility_ceiling'|...
  value NUMERIC(14,4) NOT NULL,     -- e.g. pf rate 0.12, eps ceiling 15000, esic eligibility 21000
  effective_from DATE NOT NULL,     -- historical correctness for arrears/reruns
  source_note TEXT NOT NULL         -- the notification/circular this value came from (audit answerability)
);

CREATE TABLE pay.pt_slabs (         -- PAY-11: per state, effective-dated
  state_code TEXT NOT NULL, min_monthly NUMERIC(14,2) NOT NULL, max_monthly NUMERIC(14,2),
  amount NUMERIC(8,2) NOT NULL, effective_from DATE NOT NULL
);

CREATE TABLE pay.it_slabs (         -- PAY-13: income-tax slabs per regime per FY (model from Frappe HR)
  fy TEXT NOT NULL,                 -- '2026-27'
  regime TEXT NOT NULL,             -- 'old'|'new'
  slab_from NUMERIC(14,2) NOT NULL, slab_to NUMERIC(14,2), rate NUMERIC(6,4) NOT NULL,
  surcharge_rules JSONB, cess_rate NUMERIC(6,4) NOT NULL DEFAULT 0.04,
  standard_deduction NUMERIC(14,2) NOT NULL, rebate_87a JSONB -- threshold+cap; marginal relief handled in engine
);

CREATE TABLE pay.investment_declarations ( -- PAY-13 ESS declarations (SOW-3.2d)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  fy TEXT NOT NULL,
  section TEXT NOT NULL,            -- '80C'|'80D'|'HRA_RENT'|'24B'|'80CCD1B'|...
  declared_amount NUMERIC(14,2) NOT NULL,
  proof_document_id BIGINT REFERENCES core.documents, -- uploaded at proof window (SOW-10.1: proofs before F&F too)
  verified_amount NUMERIC(14,2),    -- HR-verified figure used in final tax
  verified_by BIGINT REFERENCES core.users, verified_at TIMESTAMPTZ,
  UNIQUE(employee_id, fy, section)
);

CREATE TABLE pay.tds_challans (     -- PAY-13 reconciliation (SOW-5.9.3)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL, amount NUMERIC(14,2) NOT NULL,
  challan_no TEXT NOT NULL, bsr_code TEXT, paid_on DATE NOT NULL
);

CREATE TABLE pay.gl_accounts (      -- SAP JV mapping (§02-ARCH §5)
  component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
  cost_center_id BIGINT REFERENCES core.cost_centers, -- NULL = default mapping
  gl_code TEXT NOT NULL, gl_description TEXT
);

CREATE TABLE pay.bank_batches (     -- PAY-05 bank transfer file per run
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  file_document_id BIGINT NOT NULL REFERENCES core.documents,
  total_amount NUMERIC(16,2) NOT NULL, record_count INTEGER NOT NULL,
  generated_by BIGINT NOT NULL REFERENCES core.users
);

CREATE TABLE pay.fnf_settlements (  -- PAY-15 / SOW-10
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  separation_id BIGINT NOT NULL,    -- lifecycle record that triggered it
  run_id BIGINT REFERENCES pay.payroll_runs,       -- run_type='fnf'
  last_working_day DATE NOT NULL,
  days_payable NUMERIC(4,1) NOT NULL,              -- SOW-10.1 input
  leave_encash_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  notice_recovery_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  gratuity_amount NUMERIC(14,2) NOT NULL DEFAULT 0, -- formula in 04-MODULE-SPECS §6.7; 0 if service < 4y240d
  other_payments NUMERIC(14,2) NOT NULL DEFAULT 0, other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  held_salary_released NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',            -- 'draft'|'clearances_pending'|'computed'|'approved'|'paid'
  tat_due_date DATE                                 -- 3-working-day TAT tracking (SOW-10.2)
);

CREATE TABLE pay.loans (            -- M11 (SOW-5.5, LN-01..03)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  loan_type TEXT NOT NULL,          -- 'loan_diminishing'|'loan_flat'|'emi_no_interest'|'salary_advance'|'travel_advance'
  principal NUMERIC(14,2) NOT NULL,
  interest_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  emi NUMERIC(14,2) NOT NULL,
  start_month DATE NOT NULL, tenure_months SMALLINT NOT NULL,
  outstanding NUMERIC(14,2) NOT NULL,       -- maintained by payroll deduction postings
  perquisite_applicable BOOLEAN NOT NULL DEFAULT false, -- SBI-rate perquisite valuation (SOW-5.5.3)
  source TEXT NOT NULL DEFAULT 'hrms',      -- 'hrms'|'sap_legacy' (PP-11 import)
  workflow_request_id BIGINT,               -- ESS application approval (LN-02)
  status TEXT NOT NULL DEFAULT 'active'     -- 'active'|'closed'|'written_off'
);

CREATE TABLE pay.loan_postings (    -- per-month deduction trail; reconciles outstanding
  loan_id BIGINT NOT NULL REFERENCES pay.loans,
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  principal_part NUMERIC(14,2) NOT NULL, interest_part NUMERIC(14,2) NOT NULL,
  perquisite_value NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- 6.10 Claims & Reimbursements (M12 — CLM-01..07, SOW-6)
CREATE TABLE pay.claim_types (
  code TEXT UNIQUE NOT NULL,        -- 'medical'|'conveyance'|'telephone'|'lta'|'relocation'|'misc'
  name TEXT NOT NULL,
  entitlement_basis TEXT NOT NULL,  -- 'annual'|'monthly'|'per_event' (CLM-01)
  bill_required BOOLEAN NOT NULL DEFAULT true,
  taxable_if_unsubstantiated BOOLEAN NOT NULL DEFAULT true, -- year-end TDS on unclaimed/unproven (CLM-05)
  payout_component_code TEXT NOT NULL REFERENCES pay.salary_components(code) -- which payslip line pays it (CLM-04)
);

CREATE TABLE pay.claim_entitlements ( -- per grade × type limit (CLM-01); NULL grade = default
  claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types,
  grade_id BIGINT REFERENCES core.grades,
  amount NUMERIC(14,2) NOT NULL,    -- entitlement per basis period
  effective_from DATE NOT NULL      -- policy revisions without history loss
);

CREATE TABLE pay.claims (
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types,
  period_from DATE NOT NULL, period_to DATE NOT NULL, -- expense period (entitlement bucket resolution)
  claimed_amount NUMERIC(14,2) NOT NULL,
  approved_amount NUMERIC(14,2),    -- partial approval allowed (CLM-03); NULL until decided
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'verified'|'approved'|'rejected'|'paid'
  workflow_request_id BIGINT NOT NULL,     -- RM → HR verify → payroll (chain in 08-ROLES §4)
  rejection_reason TEXT,             -- mandatory when rejected (CLM-03)
  advance_loan_id BIGINT REFERENCES pay.loans, -- travel-advance adjustment linkage (CLM-07)
  paid_in_run_id BIGINT REFERENCES pay.payroll_runs, -- payroll payout (CLM-04)
  paid_in_batch_id BIGINT REFERENCES pay.bank_batches -- OR off-cycle reimbursement batch — CHECK: not both
);

CREATE TABLE pay.claim_bills (      -- CLM-02 multiple bill uploads per claim
  claim_id BIGINT NOT NULL REFERENCES pay.claims,
  document_id BIGINT NOT NULL REFERENCES core.documents,
  bill_no TEXT, bill_date DATE, amount NUMERIC(14,2) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false, verified_by BIGINT REFERENCES core.users -- HR bill check (CLM-03)
);
```

## 7. Lifecycle (`core`) — onboarding, confirmation, separation

```sql
CREATE TABLE core.onboarding_candidates ( -- LC-01 bridge from ATS 'Joined List' / LOI payload (full field list = LOI doc §1–4)
  ats_candidate_id BIGINT,          -- FK into ats DB (kept loose across databases)
  loi_reference TEXT,               -- requisition/LOI id for the offer report join (RPT-02)
  full_name TEXT NOT NULL, personal_email TEXT NOT NULL, mobile TEXT NOT NULL,
  dob DATE, address TEXT, total_experience_years NUMERIC(4,1),
  previous_company TEXT, current_salary NUMERIC(14,2), expected_salary NUMERIC(14,2), -- LOI §1
  position_title TEXT NOT NULL, department TEXT, org_unit TEXT, designation TEXT,
  category core.employment_category NOT NULL, replacement_of_ecode TEXT, -- LOI §2 (replacement tracks previous ecode+salary)
  offered_ctc NUMERIC(14,2) NOT NULL, probation_months SMALLINT, probation_salary_pct SMALLINT, -- LOI §3 → PAY-02/07
  proposed_doj DATE NOT NULL, offer_date DATE NOT NULL, work_location TEXT,
  prejoin_link_token TEXT UNIQUE,   -- personal-email data-collection link (SOW-3.2a)
  prejoin_link_sent_at TIMESTAMPTZ, prejoin_completed_at TIMESTAMPTZ, -- delivery tracking (greytHR failure: links not received)
  status TEXT NOT NULL DEFAULT 'awaiting_prejoin', -- →'prejoin_done'→'converted'→ (or 'no_show')
  employee_id BIGINT REFERENCES core.employees      -- set on conversion (DOJ)
);

CREATE TABLE core.onboarding_tasks ( -- LC-02: stakeholder checklist with escalation
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  task_code TEXT NOT NULL,          -- 'it_email'|'it_biometric'|'admin_assets'|'hr_induction'|'payroll_salary_setup'|...
  owner_role TEXT NOT NULL,         -- routed by role, resolved to users at creation
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open'|'done'|'escalated'
  done_by BIGINT REFERENCES core.users, done_at TIMESTAMPTZ
);

CREATE TABLE core.probation_reviews ( -- LC-04 (SOW-3.3)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  due_date DATE NOT NULL,
  manager_recommendation TEXT,      -- 'confirm'|'extend'|'terminate'
  extension_months SMALLINT,        -- when extended
  review_notes TEXT,
  workflow_request_id BIGINT,       -- multi-level confirmation chain (PI-ESS-10)
  outcome TEXT,                     -- 'confirmed'|'extended'|'separated'
  decided_at TIMESTAMPTZ
);

CREATE TABLE core.separations (     -- LC-06 (SOW-3.5, PP-14)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  initiated_at TIMESTAMPTZ NOT NULL,
  initiated_by TEXT NOT NULL,       -- 'employee'|'hr' (absconding/termination path from att.absence_cases)
  reason TEXT NOT NULL,
  resignation_date DATE NOT NULL,
  notice_period_days SMALLINT NOT NULL,      -- from contract terms (LOI §4)
  requested_lwd DATE NOT NULL,               -- employee-requested last working day
  approved_lwd DATE,                         -- final LWD after approvals (drives DOL)
  workflow_request_id BIGINT NOT NULL,       -- multi-level chain; every approver notified (the Chaitanya-never-notified bug is a WF-02 test case)
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending'|'approved'|'withdrawn'|'rejected'|'completed'
  fnf_id BIGINT                              -- set when settlement created
);

CREATE TABLE core.clearances (      -- LC-06 department clearances (SOW-3.5b)
  separation_id BIGINT NOT NULL REFERENCES core.separations,
  department TEXT NOT NULL,         -- 'IT'|'Admin'|'Finance'|'HR'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'cleared'|'flagged'
  remarks TEXT,                     -- e.g. unreturned asset list (AST-04)
  cleared_by BIGINT REFERENCES core.users, cleared_at TIMESTAMPTZ,
  UNIQUE(separation_id, department)
);
```

## 8. Workflow & notifications (`wf`)

```sql
CREATE TABLE wf.definitions (       -- WF-01 configurable chains; LOI flowchart is the canonical example
  code TEXT UNIQUE NOT NULL,        -- 'leave'|'ar'|'od'|'ot'|'resignation'|'confirmation'|'transfer'|'loan'|'travel_advance'|'offer_loi'
  name TEXT NOT NULL,
  steps JSONB NOT NULL              -- ordered [{step:1, approver:'reporting_manager'|'functional_manager'|role_code|user_id,
                                    --           sla_hours:48, on_breach:'escalate'|'auto_reject'|'lapse', escalate_to:...}]
);

CREATE TABLE wf.requests (          -- one row per approval instance
  definition_code TEXT NOT NULL REFERENCES wf.definitions(code),
  subject_employee_id BIGINT NOT NULL REFERENCES core.employees, -- whom it's about
  requested_by BIGINT NOT NULL REFERENCES core.users,
  payload JSONB NOT NULL,           -- snapshot of the request content shown to approvers
  current_step SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'cancelled'|'lapsed'
  decided_at TIMESTAMPTZ
);

CREATE TABLE wf.request_steps (     -- WF-04 visible timeline with timestamps (ATS offer-tracker pattern)
  request_id BIGINT NOT NULL REFERENCES wf.requests,
  step_no SMALLINT NOT NULL,
  approver_user_id BIGINT NOT NULL REFERENCES core.users, -- resolved person (incl. delegate)
  delegated_from BIGINT REFERENCES core.users,             -- delegation trail (WF-01)
  action TEXT,                       -- NULL while pending; 'approved'|'rejected'|'escalated'
  comment TEXT,
  notified_at TIMESTAMPTZ NOT NULL,  -- proof each approver was notified (the PP-14 failure)
  acted_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE wf.delegations (       -- out-of-office approval delegation
  from_user_id BIGINT NOT NULL REFERENCES core.users,
  to_user_id BIGINT NOT NULL REFERENCES core.users,
  from_date DATE NOT NULL, to_date DATE NOT NULL
);

CREATE TABLE wf.notifications (     -- WF-02 queue (in-app + email)
  recipient_user_id BIGINT REFERENCES core.users,
  recipient_email TEXT,             -- external recipients (candidate pre-join links)
  channel TEXT NOT NULL,            -- 'in_app'|'email'
  template_code TEXT NOT NULL, payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued'|'sent'|'failed'|'dead'
  attempts SMALLINT NOT NULL DEFAULT 0, last_error TEXT, sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ               -- in-app read receipt
);

CREATE TABLE wf.event_subscriptions ( -- per-event recipient matrix (PP-26: onboarding/exit → HR + BH + CEO Cell)
  event_code TEXT NOT NULL,         -- 'employee.joined'|'employee.exited'|'daily.boarding_report'|'attendance.uab'|...
  recipient_kind TEXT NOT NULL,     -- 'role'|'user'|'email'
  recipient_ref TEXT NOT NULL
);
```

## 9. Assets (`ast`), Helpdesk (`hd`), Engagement (`eng`)

```sql
CREATE TABLE ast.assets (
  asset_no TEXT UNIQUE NOT NULL,    -- searchable id (AR-1; Task-Matrix filter gap)
  category TEXT NOT NULL,           -- 'laptop'|'phone'|'sim'|'vehicle'|...
  description TEXT, serial_no TEXT,
  purchase_date DATE, warranty_till DATE,  -- past dates ALLOWED (AR-2 — greytHR blocked them)
  status TEXT NOT NULL DEFAULT 'in_stock', -- 'in_stock'|'assigned'|'maintenance'|'lost'|'scrapped'
  location_id BIGINT REFERENCES core.locations
);

CREATE TABLE ast.assignments (
  asset_id BIGINT NOT NULL REFERENCES ast.assets,
  holder_kind TEXT NOT NULL,        -- 'employee'|'third_party' (AR-3 dropdown)
  employee_id BIGINT REFERENCES core.employees,
  third_party_name TEXT, third_party_org TEXT, -- when holder_kind='third_party'
  assigned_at TIMESTAMPTZ NOT NULL, returned_at TIMESTAMPTZ,
  return_condition TEXT,            -- 'ok'|'damaged'|'not_returned' (AST-05 dashboard; exit clearance AST-04)
  assigned_by BIGINT NOT NULL REFERENCES core.users
);

CREATE TABLE ast.maintenance (      -- AST-06 (SOW-8.2)
  asset_id BIGINT NOT NULL REFERENCES ast.assets,
  kind TEXT NOT NULL,               -- 'scheduled'|'incident'|'damage'
  scheduled_for DATE, reported_by BIGINT REFERENCES core.users,
  description TEXT NOT NULL, resolved_at TIMESTAMPTZ, cost NUMERIC(12,2)
);

CREATE TABLE hd.tickets (           -- HD-01 (SOW-9)
  raised_by BIGINT NOT NULL REFERENCES core.users,
  category TEXT NOT NULL,           -- configurable list (payroll query, attendance, IT, admin…)
  subject TEXT NOT NULL, body TEXT NOT NULL,
  assignee_user_id BIGINT REFERENCES core.users,  -- auto-assignment by category routing
  status TEXT NOT NULL DEFAULT 'open',            -- 'open'|'pending'|'resolved'|'closed'
  sla_due_at TIMESTAMPTZ NOT NULL, escalated_level SMALLINT NOT NULL DEFAULT 0, -- escalation matrix (SOW-9.2)
  resolved_at TIMESTAMPTZ, resolution TEXT
);
CREATE TABLE hd.ticket_messages (   -- thread (query logs for audit — SOW-9.4)
  ticket_id BIGINT NOT NULL REFERENCES hd.tickets,
  author_user_id BIGINT NOT NULL REFERENCES core.users,
  body TEXT NOT NULL, attachment_document_id BIGINT REFERENCES core.documents
);

CREATE TABLE eng.announcements (    -- EN-01 (SOW-7.1)
  title TEXT NOT NULL, body TEXT NOT NULL, publish_at TIMESTAMPTZ NOT NULL,
  audience JSONB, created_by BIGINT NOT NULL REFERENCES core.users
);
CREATE TABLE eng.polls (            -- EN-02
  question TEXT NOT NULL, options JSONB NOT NULL, open_till TIMESTAMPTZ NOT NULL, is_anonymous BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE eng.poll_votes (
  poll_id BIGINT NOT NULL REFERENCES eng.polls, voter_user_id BIGINT NOT NULL, option_index SMALLINT NOT NULL,
  UNIQUE(poll_id, voter_user_id)    -- one vote; voter id stored for uniqueness, excluded from result queries when anonymous
);
CREATE TABLE eng.surveys (          -- EN-03 pulse surveys (SOW-7.2)
  title TEXT NOT NULL, questions JSONB NOT NULL, -- [{q, type:'rating'|'text'|'choice', options?}]
  open_from TIMESTAMPTZ NOT NULL, open_till TIMESTAMPTZ NOT NULL, is_anonymous BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE eng.survey_responses (
  survey_id BIGINT NOT NULL REFERENCES eng.surveys, respondent_hash TEXT NOT NULL, -- salted hash when anonymous (dedupe without identity)
  answers JSONB NOT NULL,
  UNIQUE(survey_id, respondent_hash)
);
```

## 10. Integrity rules enforced at DB level (not just app level)

1. `att.day_records` and `pay.payroll_*` rows for locked months: UPDATE/DELETE rejected by trigger unless an audited unlock exists (NFR-04).
2. `core.audit_log`, `att.swipe_events`, `lv.ledger`: INSERT-only (revoke UPDATE/DELETE from app role).
3. `core.employees.dol` NOT NULL when `status='exited'` (CHECK) — PP-17 can't recur.
4. `pay.payroll_runs.attendance_lock_id` NOT NULL when status ≥ 'computed' (CHECK) — payroll can never run on unlocked attendance.
5. E-code generation is a DB function taking `company_id`, using `SELECT … FOR UPDATE` on `companies.ecode_next_seq` — concurrent onboarding cannot duplicate codes (CORE-02).
6. `att.overtime_entries`: CHECK that at most one of (`comp_off_credit_id`, `payroll_item_id`) is set — OT is paid once, as money or comp-off, never both.
7. App connects via role `hrms_app` with table-level grants; `hrms_ro` (read-only) used by report exports and the ATS integration.
