-- REVIEW DRAFT ONLY. NOT A node-pg-migrate migration. Do not apply to hrms.
-- Remove this guard only in a separately reviewed, stage-specific migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'Schema proposal is not approved or migration-ordered. Read packs13-15 and resolve D decisions.';
END $review_guard$;

-- Exact docs03 reference tables normalized for SQL review.
-- Existing tables MUST be evolved, never re-CREATEd. This is not an executable migration chain.
-- Preserve current canonical alternatives: pay.claim_lines, eng.poll_responses, recovered pay.budgets/claims.
-- Baseline source: docs/03-DATABASE-SCHEMA.md:16 / table core.users
CREATE TABLE core.users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id   BIGINT REFERENCES core.employees,  -- NULL for pure-admin/service accounts; links login to person
  email         CITEXT UNIQUE NOT NULL,            -- login identifier; company email (Recruiter Details shows @rashmigroup.com)
  password_hash TEXT NOT NULL,                     -- bcrypt
  is_active     BOOLEAN NOT NULL DEFAULT true,     -- disable login on exit (LC-07) without deleting history
  last_login_at TIMESTAMPTZ,                       -- security review / dormant-account cleanup
  failed_attempts SMALLINT NOT NULL DEFAULT 0,     -- lockout counter (NFR-03)
  locked_until  TIMESTAMPTZ                        -- lockout expiry
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:27 / table core.roles
CREATE TABLE core.roles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,          -- e.g. employee, manager, hr_ops, hr_head, payroll, plant_head, ceo_cell, it_admin, super_admin
  code TEXT UNIQUE NOT NULL,       -- stable machine name used in permission checks
  name TEXT NOT NULL               -- display label
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:32 / table core.permissions
CREATE TABLE core.permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,    -- module × action grid (CORE-10)
  code TEXT UNIQUE NOT NULL        -- e.g. 'attendance.muster.export', 'payroll.run.finalize', 'employee.compensation.read'
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:36 / table core.role_permissions
CREATE TABLE core.role_permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES core.roles,
  permission_id BIGINT NOT NULL REFERENCES core.permissions,
  UNIQUE(role_id, permission_id)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:42 / table core.user_roles
CREATE TABLE core.user_roles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES core.users,
  role_id BIGINT NOT NULL REFERENCES core.roles,
  scope_org_unit_id BIGINT REFERENCES core.org_units, -- optional: restrict a role to an entity/plant (e.g. plant_head of Plant 1701 only)
  UNIQUE(user_id, role_id, scope_org_unit_id)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:49 / table core.audit_log
CREATE TABLE core.audit_log (      -- append-only (CORE-11, NFR-04); INSERT-only enforced by trigger
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES core.users,  -- who did it (NULL = system job)
  action  TEXT NOT NULL,           -- 'update' | 'create' | 'delete' | 'login' | 'approve' | 'finalize' ...
  entity  TEXT NOT NULL,           -- table or domain name, e.g. 'core.employees'
  entity_id BIGINT,                -- which record
  field   TEXT,                    -- which column (for field-level changes)
  old_value TEXT, new_value TEXT,  -- values as text; sensitive fields stored masked
  ip      INET,                    -- source of auth events
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope_org_unit_id BIGINT REFERENCES core.org_units, -- historical CORE-10 data scope; NULL = global/all-scope readers only
  hash_version SMALLINT NOT NULL DEFAULT 2 CHECK (hash_version IN (1, 2)), -- v1 legacy; v2 hashes scope
  prev_hash TEXT NOT NULL,         -- 'GENESIS' for the first row, otherwise previous row_hash
  row_hash  TEXT NOT NULL          -- SHA-256(prev_hash || row content), set by DB trigger (14 §7.4)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:71 / table core.companies
CREATE TABLE core.companies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- legal entities (confirmed live, 09-RECON §10.1): RML (Rashmi Metaliks), RGH, EIPL (eHoome IOT),
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:85 / table core.locations
CREATE TABLE core.locations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- physical sites: Kharagpur plant, Kolkata HO, Dubai — holiday calendars & muster grouping (ATT-13)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  name TEXT NOT NULL,              -- 'Kharagpur Plant', 'Kolkata HO'
  state_code TEXT NOT NULL,        -- 'WB' — selects PT slab table & LWF rates (PAY-11/12)
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:92 / table core.cost_centers
CREATE TABLE core.cost_centers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- e.g. plant 1701 / Substore (PP-8, CORE-04)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  code TEXT NOT NULL,              -- '1701' — matches SAP cost center for JV mapping (§6.7)
  name TEXT NOT NULL,              -- human label shown in muster/cost reports
  UNIQUE(company_id, code)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:99 / table core.departments
CREATE TABLE core.departments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,    -- 'Human Resource', 'CEO Cell' … (Recruiter Details columns)
  name TEXT UNIQUE NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:103 / table core.org_units
CREATE TABLE core.org_units (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- OU per Recruiter Details ('Rashmi Metaliks Limited', 'eHoome iOT…'); reporting rollup for BU dashboards (RPT-04)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  parent_id BIGINT REFERENCES core.org_units,  -- tree for BU rollups
  name TEXT NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:109 / table core.designations
CREATE TABLE core.designations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- 'Deputy Manager', 'AGM-HR' … free-ish list, validated: special chars stripped (CORE-08)
  name TEXT UNIQUE NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:113 / table core.grades
CREATE TABLE core.grades (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,         -- pay bands driving salary templates & loan eligibility (PAY-01, LN-01)
  code TEXT UNIQUE NOT NULL,       -- 'E1', 'M3' …
  name TEXT NOT NULL,
  rank SMALLINT NOT NULL           -- ordering for "leadership percentage" KPI (CEO dashboard: Leadership % needs a cutoff rank)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:132 / table core.employees
CREATE TABLE core.employees (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:192 / table core.reporting_tree
CREATE TABLE core.reporting_tree (   -- company-AGNOSTIC: a manager may have reports in another entity (live: RPL DGM approves RDL staff, 09-RECON §10.3)
  manager_id BIGINT NOT NULL, employee_id BIGINT NOT NULL, depth SMALLINT NOT NULL,
  PRIMARY KEY (manager_id, employee_id)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:197 / table core.employee_history
CREATE TABLE core.employee_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- position/comp change log: every transfer/promotion/manager change (LC-05; promotion report RPT-05)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  effective_date DATE NOT NULL,
  change_type TEXT NOT NULL,        -- 'transfer_department'|'transfer_location'|'transfer_entity'|'promotion'|'manager_change'|'confirmation'|'category_change'
  field TEXT NOT NULL, old_value TEXT, new_value TEXT,
  reference_id BIGINT               -- link to the workflow request that caused it
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:205 / table core.employee_family
CREATE TABLE core.employee_family (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ESIC family declaration (SOW-5.10 ESIC 'family members details') + gratuity/PF nominee
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  name TEXT NOT NULL, relation TEXT NOT NULL, dob DATE,
  aadhaar TEXT,                     -- ESIC portal requires it for dependents
  is_esic_dependent BOOLEAN NOT NULL DEFAULT false,
  is_nominee BOOLEAN NOT NULL DEFAULT false, nominee_share_pct NUMERIC(5,2) -- PF/gratuity nomination forms
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:213 / table core.employee_education
CREATE TABLE core.employee_education (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- LOI attachments checklist ('Educational Documents'); background-verification record
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  qualification TEXT NOT NULL, institution TEXT, year_of_passing SMALLINT, document_id BIGINT REFERENCES core.documents
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:218 / table core.employee_prev_employment
CREATE TABLE core.employee_prev_employment (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- SOW-3.2g 'capturing previous employment details'; LTA/gratuity continuity in F&F (SOW-10.1)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  company TEXT NOT NULL, designation TEXT, from_date DATE, to_date DATE,
  last_drawn_ctc NUMERIC(14,2),     -- offer benchmarking (LOI 'Current Salary')
  pf_member_id TEXT                 -- PF transfer-in support
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:225 / table core.documents
CREATE TABLE core.documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,       -- single file registry for all uploads (ID proofs, certificates, letters, payslip PDFs)
  owner_employee_id BIGINT REFERENCES core.employees,
  kind TEXT NOT NULL,               -- 'aadhaar'|'pan'|'education'|'experience_letter'|'offer_letter'|'relieving_letter'|'policy'|'payslip'|...
  path TEXT NOT NULL,               -- MinIO object key (bucket/key); DB stores the reference, bytes live in MinIO
  original_name TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  uploaded_by BIGINT REFERENCES core.users
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:233 / table core.letters
CREATE TABLE core.letters (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,         -- generated letters (CORE-09); templates in core.letter_templates
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  template_code TEXT NOT NULL,      -- 'appointment'|'confirmation'|'experience'|'relieving'|'salary_certificate'|'show_cause'|'warning'
  document_id BIGINT NOT NULL REFERENCES core.documents,  -- rendered docx/pdf
  issued_by BIGINT REFERENCES core.users, issued_at TIMESTAMPTZ,
  workflow_request_id BIGINT        -- approval chain that authorized issuance (PP-14: letters must go through the system)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:241 / table core.letter_templates
CREATE TABLE core.letter_templates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  body_docx_document_id BIGINT NOT NULL REFERENCES core.documents, -- docx with merge fields
  merge_fields JSONB NOT NULL       -- declared fields, validated against employee data at render time
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:247 / table core.policies
CREATE TABLE core.policies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,        -- CORE-13 policy repository
  title TEXT NOT NULL, document_id BIGINT NOT NULL REFERENCES core.documents,
  effective_date DATE NOT NULL, requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
  audience JSONB                    -- optional filter: categories/departments/locations
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:253 / table core.policy_acknowledgments
CREATE TABLE core.policy_acknowledgments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy_id BIGINT NOT NULL REFERENCES core.policies,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  acknowledged_at TIMESTAMPTZ NOT NULL,
  UNIQUE(policy_id, employee_id)    -- real-time tracking tile = policies × active employees minus these rows
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:264 / table att.devices
CREATE TABLE att.devices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,          -- Kent/Astra doors ('Seamless-Plant_S4', 'Seamless-Plant_G4') — health board (ATT-02)
  source TEXT NOT NULL,             -- 'kent' | 'mobile'
  door_code TEXT UNIQUE NOT NULL,   -- Door/Address from swipe export
  location_id BIGINT REFERENCES core.locations,
  last_seen_at TIMESTAMPTZ,         -- gap detection input
  expected_hourly_swipes NUMERIC(8,2), -- rolling average; zero-against-average triggers offline alert
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:273 / table att.device_watermarks
CREATE TABLE att.device_watermarks ( -- P1-T07 / doc 14 §8.5: completeness, distinct from heartbeat/source cursor
  device_id BIGINT PRIMARY KEY REFERENCES att.devices ON DELETE CASCADE,
  watermark_ts TIMESTAMPTZ NOT NULL, -- connector has proved this door has no ingestion gap through this instant
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:281 / table att.swipe_events
CREATE TABLE att.swipe_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- RAW, immutable (ATT-01). Columns mirror EmployeeSwipeDetails.xlsx so any Kent export loads losslessly.
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:299 / table att.shifts
CREATE TABLE att.shifts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,           -- ATT-04 / SOW-4.1
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,   -- 'GEN', 'A', 'B', 'C', 'NIGHT'
  start_time TIME NOT NULL, end_time TIME NOT NULL,
  crosses_midnight BOOLEAN NOT NULL DEFAULT false, -- night shifts: attendance date attribution rule
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,    -- late-coming grace (SOW-4.5a)
  grace_out_minutes SMALLINT NOT NULL DEFAULT 0,
  min_half_day_hours NUMERIC(4,2) NOT NULL,        -- below this = absent; between this and min_full = half day (ATT-05)
  min_full_day_hours NUMERIC(4,2) NOT NULL,
  break_minutes SMALLINT NOT NULL DEFAULT 0        -- net-hours computation
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:310 / table att.rosters
CREATE TABLE att.rosters (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,          -- manager-maintained month roster (ATT-04); one row per employee-date
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  work_date DATE NOT NULL,
  shift_id BIGINT REFERENCES att.shifts,           -- NULL + is_week_off=true = week-off day
  is_week_off BOOLEAN NOT NULL DEFAULT false,
  set_by BIGINT REFERENCES core.users,             -- manager accountability (Agreement 4.1a: roster by managers by 5th)
  UNIQUE(employee_id, work_date)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:319 / table att.holidays
CREATE TABLE att.holidays (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,         -- ATT-13; per location
  location_id BIGINT NOT NULL REFERENCES core.locations,
  holiday_date DATE NOT NULL, name TEXT NOT NULL,
  UNIQUE(location_id, holiday_date)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:330 / table att.day_records
CREATE TABLE att.day_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- PROCESSED attendance; recomputable from raw until locked (ATT-03)
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
  session_statuses JSONB,                          -- ordered sessions 1/2 with P/A/O; A:P, P:A, P:O (09-RECON §4); NULL = single-status day. Daily status remains the explicit summary; O is off, not absent.
  scheme_code TEXT,                                -- effective attendance scheme that day (e.g. 'GCS' Saturday scheme vs weekday 'G5')
  penalty_flag BOOLEAN NOT NULL DEFAULT false,     -- attendance-penalty policy outcome ("Penalty Days" live metric)
  computed_at TIMESTAMPTZ,
  UNIQUE(employee_id, work_date)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:352 / table att.regularizations
CREATE TABLE att.regularizations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- AR (ATT-06) and OD (ATT-07) requests
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  kind TEXT NOT NULL,               -- 'AR' | 'OD' | 'PERMISSION' (short time-bounded exception, 09-RECON §5)
  from_date DATE NOT NULL, to_date DATE NOT NULL,  -- OD may be future-dated (KQ); AR past-only — validator enforces
  from_time TIME, to_time TIME,     -- partial-day OD; required for PERMISSION (the bounded hours)
  reason TEXT NOT NULL,             -- mandatory justification (audit)
  requested_status att.day_status NOT NULL,        -- what the day should become ('P' for AR, 'OD' for OD)
  workflow_request_id BIGINT NOT NULL,             -- approval chain instance (WF-01)
  applied BOOLEAN NOT NULL DEFAULT false           -- set when approved AND day_records recomputed
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:363 / table att.overtime_entries
CREATE TABLE att.overtime_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ATT-08: the 48-hour rule
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:378 / table att.absence_cases
CREATE TABLE att.absence_cases (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,    -- ATT-10: 7–10 day continuous-absence engine
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  start_date DATE NOT NULL,
  days_absent SMALLINT NOT NULL,        -- rolling count while open
  stage TEXT NOT NULL DEFAULT 'watch',  -- 'watch'(≥4d) → 'show_cause'(≥7d) → 'warning' → 'termination_review' (PP-7 strict process)
  letter_id BIGINT REFERENCES core.letters,  -- issued show-cause/warning letter
  hr_owner_id BIGINT REFERENCES core.users,  -- routed 'through an official HR email' (PP-9 instruction)
  resolution TEXT,                       -- 'returned'|'regularized'|'exited'|NULL while open
  closed_at TIMESTAMPTZ
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:389 / table att.month_locks
CREATE TABLE att.month_locks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- ATT-15; payroll precondition
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL,              -- first of month
  locked_by BIGINT NOT NULL REFERENCES core.users, locked_at TIMESTAMPTZ NOT NULL,
  UNIQUE(company_id, month)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:400 / table lv.leave_types
CREATE TABLE lv.leave_types (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,       -- LV-01 (SOW-4.3a): CL, SL, EL, ML, CO, LWP
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:413 / table lv.ledger
CREATE TABLE lv.ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,            -- LV-05: immutable transactions; balance = SUM(delta)
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:426 / table lv.applications
CREATE TABLE lv.applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- LV-03
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:447 / table pay.salary_components
CREATE TABLE pay.salary_components (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- PAY-01; model ported from Frappe HR's Salary Component
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:460 / table pay.salary_structures
CREATE TABLE pay.salary_structures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- template per grade/category/location (PAY-01, SOW-2.2a)
  name TEXT UNIQUE NOT NULL,        -- 'White Collar E1 — Kharagpur'
  company_id BIGINT NOT NULL REFERENCES core.companies,
  components JSONB NOT NULL,        -- ordered [{component_code, formula_override|amount_rule}] — template rows
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:467 / table pay.employee_salaries
CREATE TABLE pay.employee_salaries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- effective-dated assignment (PAY-16 arrears need history)
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:479 / table pay.payroll_runs
CREATE TABLE pay.payroll_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- PAY-03 pipeline state machine
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:491 / table pay.payroll_items
CREATE TABLE pay.payroll_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,    -- one row per employee per run: the payslip header
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:505 / table pay.payroll_item_lines
CREATE TABLE pay.payroll_item_lines (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- payslip lines: component × amount (audit + variance report needs line level)
  item_id BIGINT NOT NULL REFERENCES pay.payroll_items,
  component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
  amount NUMERIC(14,2) NOT NULL,
  calc_note TEXT                    -- human-readable formula trace, e.g. 'BASIC 40000 × 28.5/30' — explainability (design principle: no black boxes)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:512 / table pay.inputs
CREATE TABLE pay.inputs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,           -- ad-hoc monthly variable inputs (SOW-5.1.1): incentives, deductions, adjustments
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  component_code TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL,
  note TEXT NOT NULL, entered_by BIGINT NOT NULL REFERENCES core.users -- who keyed it (input audit; active-status check CORE-06 enforced by validator)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:519 / table pay.salary_holds
CREATE TABLE pay.salary_holds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- PAY-08 exactly per SOW-5.7 scenarios
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  hold_type TEXT NOT NULL,          -- 'payment' (process fully, drop from bank file) | 'process' (full LOP until release)
  reason TEXT NOT NULL, start_month DATE NOT NULL, released_month DATE,
  created_by BIGINT NOT NULL REFERENCES core.users
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:526 / table pay.arrears
CREATE TABLE pay.arrears (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,          -- PAY-16: revision arrears, component-wise
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  source_salary_id BIGINT NOT NULL REFERENCES pay.employee_salaries, -- the revision that caused it
  for_month DATE NOT NULL,          -- month being corrected
  paid_in_run_id BIGINT REFERENCES pay.payroll_runs,
  component_code TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:535 / table pay.statutory_rates
CREATE TABLE pay.statutory_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scheme TEXT NOT NULL,             -- 'pf'|'eps'|'edli'|'pf_admin'|'esic_ee'|'esic_er'|'lwf_wb_ee'|'lwf_wb_er'|'gratuity'|'bonus'
  param TEXT NOT NULL,              -- 'rate'|'wage_ceiling'|'eligibility_ceiling'|...
  value NUMERIC(14,4) NOT NULL,     -- e.g. pf rate 0.12, eps ceiling 15000, esic eligibility 21000
  effective_from DATE NOT NULL,     -- historical correctness for arrears/reruns
  source_note TEXT NOT NULL         -- the notification/circular this value came from (audit answerability)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:543 / table pay.pt_slabs
CREATE TABLE pay.pt_slabs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,         -- PAY-11: per state, effective-dated
  state_code TEXT NOT NULL, min_monthly NUMERIC(14,2) NOT NULL, max_monthly NUMERIC(14,2),
  amount NUMERIC(8,2) NOT NULL, effective_from DATE NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:548 / table pay.it_slabs
CREATE TABLE pay.it_slabs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,         -- PAY-13: income-tax slabs per regime per FY (model from Frappe HR)
  fy TEXT NOT NULL,                 -- '2026-27'
  regime TEXT NOT NULL,             -- 'old'|'new'
  slab_from NUMERIC(14,2) NOT NULL, slab_to NUMERIC(14,2), rate NUMERIC(6,4) NOT NULL,
  surcharge_rules JSONB, cess_rate NUMERIC(6,4) NOT NULL DEFAULT 0.04,
  standard_deduction NUMERIC(14,2) NOT NULL, rebate_87a JSONB -- threshold+cap; marginal relief handled in engine
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:556 / table pay.investment_declarations
CREATE TABLE pay.investment_declarations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- PAY-13 ESS declarations (SOW-3.2d)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  fy TEXT NOT NULL,
  section TEXT NOT NULL,            -- '80C'|'80D'|'HRA_RENT'|'24B'|'80CCD1B'|...
  declared_amount NUMERIC(14,2) NOT NULL,
  proof_document_id BIGINT REFERENCES core.documents, -- uploaded at proof window (SOW-10.1: proofs before F&F too)
  verified_amount NUMERIC(14,2),    -- HR-verified figure used in final tax
  verified_by BIGINT REFERENCES core.users, verified_at TIMESTAMPTZ,
  UNIQUE(employee_id, fy, section)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:567 / table pay.tds_challans
CREATE TABLE pay.tds_challans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- PAY-13 reconciliation (SOW-5.9.3)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL, amount NUMERIC(14,2) NOT NULL,
  challan_no TEXT NOT NULL, bsr_code TEXT, paid_on DATE NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:573 / table pay.gl_accounts
CREATE TABLE pay.gl_accounts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- SAP JV mapping (§02-ARCH §5)
  component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
  cost_center_id BIGINT REFERENCES core.cost_centers, -- NULL = default mapping
  gl_code TEXT NOT NULL, gl_description TEXT
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:579 / table pay.bank_batches
CREATE TABLE pay.bank_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- PAY-05 bank transfer file per run
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  file_document_id BIGINT NOT NULL REFERENCES core.documents,
  total_amount NUMERIC(16,2) NOT NULL, record_count INTEGER NOT NULL,
  generated_by BIGINT NOT NULL REFERENCES core.users
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:586 / table pay.fnf_settlements
CREATE TABLE pay.fnf_settlements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- PAY-15 / SOW-10
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:601 / table pay.loans
CREATE TABLE pay.loans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,            -- M11 (SOW-5.5, LN-01..03)
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:615 / table pay.loan_postings
CREATE TABLE pay.loan_postings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,    -- per-month deduction trail; reconciles outstanding
  loan_id BIGINT NOT NULL REFERENCES pay.loans,
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  principal_part NUMERIC(14,2) NOT NULL, interest_part NUMERIC(14,2) NOT NULL,
  perquisite_value NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:623 / table pay.claim_types
CREATE TABLE pay.claim_types (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- 'medical'|'conveyance'|'telephone'|'lta'|'relocation'|'misc'
  name TEXT NOT NULL,
  entitlement_basis TEXT NOT NULL,  -- 'annual'|'monthly'|'per_event' (CLM-01)
  bill_required BOOLEAN NOT NULL DEFAULT true,
  taxable_if_unsubstantiated BOOLEAN NOT NULL DEFAULT true, -- year-end TDS on unclaimed/unproven (CLM-05)
  payout_component_code TEXT NOT NULL REFERENCES pay.salary_components(code) -- which payslip line pays it (CLM-04)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:632 / table pay.claim_entitlements
CREATE TABLE pay.claim_entitlements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- per grade × type limit (CLM-01); NULL grade = default
  claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types,
  grade_id BIGINT REFERENCES core.grades,
  amount NUMERIC(14,2) NOT NULL,    -- entitlement per basis period
  effective_from DATE NOT NULL      -- policy revisions without history loss
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:639 / table pay.claims
CREATE TABLE pay.claims (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:653 / table pay.claim_bills
CREATE TABLE pay.claim_bills (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- CLM-02 multiple bill uploads per claim
  claim_id BIGINT NOT NULL REFERENCES pay.claims,
  document_id BIGINT NOT NULL REFERENCES core.documents,
  bill_no TEXT, bill_date DATE, amount NUMERIC(14,2) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false, verified_by BIGINT REFERENCES core.users -- HR bill check (CLM-03)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:664 / table core.onboarding_candidates
CREATE TABLE core.onboarding_candidates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- LC-01 bridge from ATS 'Joined List' / LOI payload (full field list = LOI doc §1–4)
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:680 / table core.onboarding_tasks
CREATE TABLE core.onboarding_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- LC-02: stakeholder checklist with escalation
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  task_code TEXT NOT NULL,          -- 'it_email'|'it_biometric'|'admin_assets'|'hr_induction'|'payroll_salary_setup'|...
  owner_role TEXT NOT NULL,         -- routed by role, resolved to users at creation
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open'|'done'|'escalated'
  done_by BIGINT REFERENCES core.users, done_at TIMESTAMPTZ
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:689 / table core.probation_reviews
CREATE TABLE core.probation_reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- LC-04 (SOW-3.3)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  due_date DATE NOT NULL,
  manager_recommendation TEXT,      -- 'confirm'|'extend'|'terminate'
  extension_months SMALLINT,        -- when extended
  review_notes TEXT,
  workflow_request_id BIGINT,       -- multi-level confirmation chain (PI-ESS-10)
  outcome TEXT,                     -- 'confirmed'|'extended'|'separated'
  decided_at TIMESTAMPTZ
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:700 / table core.separations
CREATE TABLE core.separations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- LC-06 (SOW-3.5, PP-14)
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:714 / table core.clearances
CREATE TABLE core.clearances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- LC-06 department clearances (SOW-3.5b)
  separation_id BIGINT NOT NULL REFERENCES core.separations,
  department TEXT NOT NULL,         -- 'IT'|'Admin'|'Finance'|'HR'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'cleared'|'flagged'
  remarks TEXT,                     -- e.g. unreturned asset list (AST-04)
  cleared_by BIGINT REFERENCES core.users, cleared_at TIMESTAMPTZ,
  UNIQUE(separation_id, department)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:727 / table wf.definitions
CREATE TABLE wf.definitions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,       -- WF-01 configurable chains; LOI flowchart is the canonical example
  code TEXT UNIQUE NOT NULL,        -- 'leave'|'ar'|'od'|'ot'|'resignation'|'confirmation'|'transfer'|'loan'|'travel_advance'|'offer_loi'
  name TEXT NOT NULL,
  steps JSONB NOT NULL              -- ordered [{step:1, approver:'reporting_manager'|'functional_manager'|role_code|user_id,
                                    --           sla_hours:48, on_breach:'escalate'|'auto_reject'|'lapse', escalate_to:...}]
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:734 / table wf.requests
CREATE TABLE wf.requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,          -- one row per approval instance
  definition_code TEXT NOT NULL REFERENCES wf.definitions(code),
  subject_employee_id BIGINT NOT NULL REFERENCES core.employees, -- whom it's about
  requested_by BIGINT NOT NULL REFERENCES core.users,
  payload JSONB NOT NULL,           -- snapshot of the request content shown to approvers
  current_step SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'cancelled'|'lapsed'
  decided_at TIMESTAMPTZ
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:744 / table wf.request_steps
CREATE TABLE wf.request_steps (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- WF-04 visible timeline with timestamps (ATS offer-tracker pattern)
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

-- Baseline source: docs/03-DATABASE-SCHEMA.md:756 / table wf.delegations
CREATE TABLE wf.delegations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,       -- out-of-office approval delegation
  from_user_id BIGINT NOT NULL REFERENCES core.users,
  to_user_id BIGINT NOT NULL REFERENCES core.users,
  from_date DATE NOT NULL, to_date DATE NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:762 / table wf.notifications
CREATE TABLE wf.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,     -- WF-02 queue (in-app + email)
  recipient_user_id BIGINT REFERENCES core.users,
  recipient_email TEXT,             -- external recipients (candidate pre-join links)
  channel TEXT NOT NULL,            -- 'in_app'|'email'
  template_code TEXT NOT NULL, payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued'|'sent'|'failed'|'dead'
  attempts SMALLINT NOT NULL DEFAULT 0, last_error TEXT, sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ               -- in-app read receipt
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:772 / table wf.event_subscriptions
CREATE TABLE wf.event_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- per-event recipient matrix (PP-26: onboarding/exit → HR + BH + CEO Cell)
  event_code TEXT NOT NULL,         -- 'employee.joined'|'employee.exited'|'daily.boarding_report'|'attendance.uab'|...
  recipient_kind TEXT NOT NULL,     -- 'role'|'user'|'email'
  recipient_ref TEXT NOT NULL
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:782 / table ast.assets
CREATE TABLE ast.assets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_no TEXT UNIQUE NOT NULL,    -- searchable id (AR-1; Task-Matrix filter gap)
  category TEXT NOT NULL,           -- 'laptop'|'phone'|'sim'|'vehicle'|...
  description TEXT, serial_no TEXT,
  purchase_date DATE, warranty_till DATE,  -- past dates ALLOWED (AR-2 — greytHR blocked them)
  status TEXT NOT NULL DEFAULT 'in_stock', -- 'in_stock'|'assigned'|'maintenance'|'lost'|'scrapped'
  location_id BIGINT REFERENCES core.locations
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:791 / table ast.assignments
CREATE TABLE ast.assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES ast.assets,
  holder_kind TEXT NOT NULL,        -- 'employee'|'third_party' (AR-3 dropdown)
  employee_id BIGINT REFERENCES core.employees,
  third_party_name TEXT, third_party_org TEXT, -- when holder_kind='third_party'
  assigned_at TIMESTAMPTZ NOT NULL, returned_at TIMESTAMPTZ,
  return_condition TEXT,            -- 'ok'|'damaged'|'not_returned' (AST-05 dashboard; exit clearance AST-04)
  assigned_by BIGINT NOT NULL REFERENCES core.users
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:801 / table ast.maintenance
CREATE TABLE ast.maintenance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- AST-06 (SOW-8.2)
  asset_id BIGINT NOT NULL REFERENCES ast.assets,
  kind TEXT NOT NULL,               -- 'scheduled'|'incident'|'damage'
  scheduled_for DATE, reported_by BIGINT REFERENCES core.users,
  description TEXT NOT NULL, resolved_at TIMESTAMPTZ, cost NUMERIC(12,2)
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:808 / table hd.tickets
CREATE TABLE hd.tickets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,           -- HD-01 (SOW-9)
  raised_by BIGINT NOT NULL REFERENCES core.users,
  category TEXT NOT NULL,           -- configurable list (payroll query, attendance, IT, admin…)
  subject TEXT NOT NULL, body TEXT NOT NULL,
  assignee_user_id BIGINT REFERENCES core.users,  -- auto-assignment by category routing
  status TEXT NOT NULL DEFAULT 'open',            -- 'open'|'pending'|'resolved'|'closed'
  sla_due_at TIMESTAMPTZ NOT NULL, escalated_level SMALLINT NOT NULL DEFAULT 0, -- escalation matrix (SOW-9.2)
  resolved_at TIMESTAMPTZ, resolution TEXT
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:817 / table hd.ticket_messages
CREATE TABLE hd.ticket_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- thread (query logs for audit — SOW-9.4)
  ticket_id BIGINT NOT NULL REFERENCES hd.tickets,
  author_user_id BIGINT NOT NULL REFERENCES core.users,
  body TEXT NOT NULL, attachment_document_id BIGINT REFERENCES core.documents
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:823 / table eng.announcements
CREATE TABLE eng.announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,    -- EN-01 (SOW-7.1)
  title TEXT NOT NULL, body TEXT NOT NULL, publish_at TIMESTAMPTZ NOT NULL,
  audience JSONB, created_by BIGINT NOT NULL REFERENCES core.users
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:827 / table eng.polls
CREATE TABLE eng.polls (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,            -- EN-02
  question TEXT NOT NULL, options JSONB NOT NULL, open_till TIMESTAMPTZ NOT NULL, is_anonymous BOOLEAN NOT NULL DEFAULT true
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:830 / table eng.poll_votes
CREATE TABLE eng.poll_votes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poll_id BIGINT NOT NULL REFERENCES eng.polls, voter_user_id BIGINT NOT NULL, option_index SMALLINT NOT NULL,
  UNIQUE(poll_id, voter_user_id)    -- one vote; voter id stored for uniqueness, excluded from result queries when anonymous
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:834 / table eng.surveys
CREATE TABLE eng.surveys (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,          -- EN-03 pulse surveys (SOW-7.2)
  title TEXT NOT NULL, questions JSONB NOT NULL, -- [{q, type:'rating'|'text'|'choice', options?}]
  open_from TIMESTAMPTZ NOT NULL, open_till TIMESTAMPTZ NOT NULL, is_anonymous BOOLEAN NOT NULL DEFAULT true
);

-- Baseline source: docs/03-DATABASE-SCHEMA.md:838 / table eng.survey_responses
CREATE TABLE eng.survey_responses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id BIGINT NOT NULL REFERENCES eng.surveys, respondent_hash TEXT NOT NULL, -- salted hash when anonymous (dedupe without identity)
  answers JSONB NOT NULL,
  UNIQUE(survey_id, respondent_hash)
);

ROLLBACK;
