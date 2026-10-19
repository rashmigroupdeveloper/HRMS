/**
 * REQ-002/005/006/007 (RQ-JF-002..013): the full RML/HR/02/01 joining-form
 * master (pack C: base form + Form F + ESIC Form-1 + EPF Form 11).
 *
 * - core.employees: personal extension, emergency-contact relation (was dropped
 *   on conversion), bank branch / holder / type, HR office-use checklist.
 *   Gender is Male / Female / Transgender (EPF/ESIC wording); marital status is
 *   the EPF set. The five EPS columns are shared with the payroll job's
 *   1752700000300 migration and declared IF NOT EXISTS so either order works.
 * - core.employee_addresses: structured present / permanent address with PIN
 *   and state; the legacy text columns stay as derived read copies.
 * - core.employee_education / _certifications / _experience: repeating grids.
 * - core.employee_family: gender, address, residence, occupation, dependency.
 * - core.employee_statutory_profile: EPF Form 11 history and the ESIC block.
 * - core.employee_nominations + core.nomination_declarations: per-scheme
 *   nominations (PF, EPS, gratuity Form F, ESIC s.71, GPA, GMC, GTLI) with
 *   versioning, witnesses and employer certification.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    SET lock_timeout = '5s';

    UPDATE core.employees SET gender = 'Transgender' WHERE gender IN ('Other', 'other', 'T', 'Transgender');
    UPDATE core.employees SET gender = 'Male' WHERE gender IN ('M', 'male', 'MALE');
    UPDATE core.employees SET gender = 'Female' WHERE gender IN ('F', 'female', 'FEMALE');
    UPDATE core.employees SET gender = NULL WHERE gender IS NOT NULL AND gender NOT IN ('Male', 'Female', 'Transgender');
    UPDATE core.employees SET marital_status = lower(btrim(marital_status)) WHERE marital_status IS NOT NULL;
    UPDATE core.employees SET marital_status = CASE marital_status
        WHEN 'unmarried' THEN 'single' WHEN 'widow' THEN 'widowed' WHEN 'widower' THEN 'widowed'
        WHEN 'divorcee' THEN 'divorced' ELSE marital_status END
      WHERE marital_status IS NOT NULL;
    UPDATE core.employees SET marital_status = NULL
      WHERE marital_status IS NOT NULL AND marital_status NOT IN ('single', 'married', 'widowed', 'divorced', 'separated');

    ALTER TABLE core.employees
      ADD CONSTRAINT employees_gender_check CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Transgender')),
      ADD CONSTRAINT employees_marital_status_check CHECK (marital_status IS NULL OR marital_status IN ('single', 'married', 'widowed', 'divorced', 'separated')),
      ADD COLUMN IF NOT EXISTS father_name TEXT,
      ADD COLUMN IF NOT EXISTS spouse_name TEXT,
      ADD COLUMN IF NOT EXISTS form11_relative TEXT NOT NULL DEFAULT 'father' CHECK (form11_relative IN ('father', 'spouse')),
      ADD COLUMN IF NOT EXISTS marriage_date DATE,
      ADD COLUMN IF NOT EXISTS nationality TEXT,
      ADD COLUMN IF NOT EXISTS country_of_origin TEXT,
      ADD COLUMN IF NOT EXISTS religion TEXT,
      ADD COLUMN IF NOT EXISTS caste TEXT,
      ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1) CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250)),
      ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1) CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 300)),
      ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS disability_type TEXT,
      ADD COLUMN IF NOT EXISTS disability_pct NUMERIC(5,2) CHECK (disability_pct IS NULL OR (disability_pct >= 0 AND disability_pct <= 100)),
      ADD COLUMN IF NOT EXISTS identification_mark TEXT,
      ADD COLUMN IF NOT EXISTS passport_no TEXT,
      ADD COLUMN IF NOT EXISTS passport_valid_until DATE,
      ADD COLUMN IF NOT EXISTS driving_licence_no TEXT,
      ADD COLUMN IF NOT EXISTS driving_licence_valid_until DATE,
      ADD COLUMN IF NOT EXISTS name_as_per_aadhaar TEXT,
      ADD COLUMN IF NOT EXISTS aadhaar_linked_mobile BOOLEAN,
      ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_alt_phone TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_address TEXT,
      ADD COLUMN IF NOT EXISTS bank_branch TEXT,
      ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
      ADD COLUMN IF NOT EXISTS bank_account_type TEXT CHECK (bank_account_type IS NULL OR bank_account_type IN ('savings', 'current')),
      ADD COLUMN IF NOT EXISTS joining_form_date DATE,
      ADD COLUMN IF NOT EXISTS bgv_status TEXT CHECK (bgv_status IS NULL OR bgv_status IN ('not_started', 'initiated', 'cleared', 'failed', 'not_applicable')),
      ADD COLUMN IF NOT EXISTS induction_date DATE,
      ADD COLUMN IF NOT EXISTS joining_signed_off_by BIGINT REFERENCES core.users(id),
      ADD COLUMN IF NOT EXISTS joining_signed_off_at TIMESTAMPTZ,
      -- Shared with the payroll job (1752700000300_epf-form11-eps): same names and types.
      ADD COLUMN IF NOT EXISTS epf_member_before_sep2014 BOOLEAN,
      ADD COLUMN IF NOT EXISTS epf_first_enrolled_on DATE,
      ADD COLUMN IF NOT EXISTS epf_first_wages NUMERIC(12,2) CHECK (epf_first_wages IS NULL OR epf_first_wages >= 0),
      ADD COLUMN IF NOT EXISTS international_worker BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS eps_eligible BOOLEAN;
    COMMENT ON COLUMN core.employees.caste IS 'Sensitive (DPDP): optional, shown only to employee.statutory_ids.read holders';

    CREATE TABLE core.employee_addresses (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('present', 'permanent')),
      house TEXT NOT NULL,
      locality TEXT,
      city TEXT NOT NULL,
      post_office TEXT,
      police_station TEXT,
      sub_division TEXT,
      district TEXT NOT NULL,
      state_code TEXT NOT NULL,
      country_code TEXT NOT NULL DEFAULT 'IN',
      pin TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, kind),
      CONSTRAINT employee_addresses_country CHECK (country_code ~ '^[A-Z]{2}$'),
      CONSTRAINT employee_addresses_in_pin CHECK (country_code <> 'IN' OR pin ~ '^[1-9][0-9]{5}$')
    );
    CREATE TRIGGER employee_addresses_updated_at BEFORE UPDATE ON core.employee_addresses
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.employee_education (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
      qualification TEXT NOT NULL,
      institute TEXT NOT NULL,
      year_of_passing SMALLINT CHECK (year_of_passing IS NULL OR (year_of_passing BETWEEN 1950 AND 2100)),
      specialization TEXT,
      score NUMERIC(6,2) CHECK (score IS NULL OR score >= 0),
      score_type TEXT CHECK (score_type IS NULL OR score_type IN ('percent', 'cgpa')),
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT education_score_range CHECK (score IS NULL OR (score_type = 'percent' AND score <= 100) OR (score_type = 'cgpa' AND score <= 10))
    );
    CREATE INDEX employee_education_emp_idx ON core.employee_education (employee_id);

    CREATE TABLE core.employee_certifications (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      issuer TEXT NOT NULL,
      issued_on DATE,
      expires_on DATE,
      specialization TEXT,
      grade TEXT,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT certification_dates CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on > issued_on)
    );
    CREATE INDEX employee_certifications_emp_idx ON core.employee_certifications (employee_id);
    CREATE INDEX employee_certifications_expiry_idx ON core.employee_certifications (expires_on) WHERE expires_on IS NOT NULL;

    CREATE TABLE core.employee_experience (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
      employer TEXT NOT NULL,
      designation TEXT,
      from_date DATE NOT NULL,
      to_date DATE,
      reason_for_leaving TEXT,
      last_ctc NUMERIC(14,2) CHECK (last_ctc IS NULL OR last_ctc >= 0),
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT experience_dates CHECK (to_date IS NULL OR to_date >= from_date)
    );
    CREATE INDEX employee_experience_emp_idx ON core.employee_experience (employee_id);

    ALTER TABLE core.employee_family
      ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Transgender')),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS residing_with_employee BOOLEAN,
      ADD COLUMN IF NOT EXISTS residing_town TEXT,
      ADD COLUMN IF NOT EXISTS residing_state_code TEXT,
      ADD COLUMN IF NOT EXISTS occupation TEXT,
      ADD COLUMN IF NOT EXISTS is_dependent BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE core.employee_statutory_profile (
      employee_id BIGINT PRIMARY KEY REFERENCES core.employees(id) ON DELETE CASCADE,
      epf_prev_member BOOLEAN,
      eps_prev_member BOOLEAN,
      prev_pf_number TEXT,
      prev_exit_date DATE,
      scheme_certificate_no TEXT,
      ppo_no TEXT,
      epf_withdrawn BOOLEAN,
      eps_withdrawn BOOLEAN,
      eps_withdrawn_after_sep2014 BOOLEAN,
      kyc_status TEXT CHECK (kyc_status IS NULL OR kyc_status IN ('not_uploaded', 'uploaded_pending', 'approved', 'rejected')),
      transfer_request_status TEXT CHECK (transfer_request_status IS NULL OR transfer_request_status IN ('not_needed', 'pending', 'submitted', 'completed')),
      esic_prev_ip_number TEXT,
      esic_prev_employer_code TEXT,
      esic_prev_employer_name TEXT,
      esic_prev_employer_address TEXT,
      esic_branch_office TEXT,
      esic_dispensary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT statprof_esic_prev CHECK (esic_prev_ip_number IS NULL OR esic_prev_ip_number ~ '^[0-9]{10}$')
    );
    CREATE TRIGGER employee_statutory_profile_updated_at BEFORE UPDATE ON core.employee_statutory_profile
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.employee_nominations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
      scheme TEXT NOT NULL CHECK (scheme IN ('pf', 'eps', 'gratuity', 'esic', 'gpa', 'gmc', 'gtli')),
      version INT NOT NULL CHECK (version > 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
      family_member_id BIGINT REFERENCES core.employee_family(id) ON DELETE SET NULL,
      nominee_name TEXT NOT NULL,
      relation TEXT NOT NULL,
      dob DATE,
      gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Transgender')),
      address TEXT NOT NULL,
      share_pct NUMERIC(5,2) NOT NULL CHECK (share_pct > 0 AND share_pct <= 100),
      guardian_name TEXT,
      guardian_relation TEXT,
      guardian_address TEXT,
      created_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX employee_nominations_active_idx ON core.employee_nominations (employee_id, scheme) WHERE status = 'active';

    CREATE TABLE core.nomination_declarations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
      scheme TEXT NOT NULL CHECK (scheme IN ('pf', 'eps', 'gratuity', 'esic', 'gpa', 'gmc', 'gtli')),
      version INT NOT NULL CHECK (version > 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
      -- Form F statements 2-6 (family within s.2(h), no family, parents not dependent, husband excluded, invalidates previous).
      statements JSONB NOT NULL DEFAULT '{}'::jsonb,
      witness1_name TEXT,
      witness1_address TEXT,
      witness2_name TEXT,
      witness2_address TEXT,
      declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      declared_by BIGINT REFERENCES core.users(id),
      employer_verified_by BIGINT REFERENCES core.users(id),
      employer_verified_at TIMESTAMPTZ,
      employer_reference_no TEXT,
      employer_signatory_designation TEXT,
      employee_acknowledged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, scheme, version)
    );
    CREATE UNIQUE INDEX nomination_declarations_one_active ON core.nomination_declarations (employee_id, scheme) WHERE status = 'active';
    CREATE TRIGGER nomination_declarations_updated_at BEFORE UPDATE ON core.nomination_declarations
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- Pre-join: a draft the candidate can come back to before the single-use submit.
    ALTER TABLE core.onboarding_candidates
      ADD COLUMN IF NOT EXISTS prejoin_draft_data JSONB,
      ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Transgender'));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.onboarding_candidates DROP COLUMN IF EXISTS gender, DROP COLUMN IF EXISTS prejoin_draft_data;
    DROP TABLE IF EXISTS core.nomination_declarations;
    DROP TABLE IF EXISTS core.employee_nominations;
    DROP TABLE IF EXISTS core.employee_statutory_profile;
    ALTER TABLE core.employee_family
      DROP COLUMN IF EXISTS gender, DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS residing_with_employee,
      DROP COLUMN IF EXISTS residing_town, DROP COLUMN IF EXISTS residing_state_code, DROP COLUMN IF EXISTS occupation,
      DROP COLUMN IF EXISTS is_dependent;
    DROP TABLE IF EXISTS core.employee_experience;
    DROP TABLE IF EXISTS core.employee_certifications;
    DROP TABLE IF EXISTS core.employee_education;
    DROP TABLE IF EXISTS core.employee_addresses;
    ALTER TABLE core.employees
      DROP CONSTRAINT IF EXISTS employees_gender_check, DROP CONSTRAINT IF EXISTS employees_marital_status_check,
      DROP COLUMN IF EXISTS father_name, DROP COLUMN IF EXISTS spouse_name, DROP COLUMN IF EXISTS form11_relative,
      DROP COLUMN IF EXISTS marriage_date, DROP COLUMN IF EXISTS nationality, DROP COLUMN IF EXISTS country_of_origin,
      DROP COLUMN IF EXISTS religion, DROP COLUMN IF EXISTS caste, DROP COLUMN IF EXISTS height_cm, DROP COLUMN IF EXISTS weight_kg,
      DROP COLUMN IF EXISTS is_pwd, DROP COLUMN IF EXISTS disability_type, DROP COLUMN IF EXISTS disability_pct,
      DROP COLUMN IF EXISTS identification_mark, DROP COLUMN IF EXISTS passport_no, DROP COLUMN IF EXISTS passport_valid_until,
      DROP COLUMN IF EXISTS driving_licence_no, DROP COLUMN IF EXISTS driving_licence_valid_until, DROP COLUMN IF EXISTS name_as_per_aadhaar,
      DROP COLUMN IF EXISTS aadhaar_linked_mobile, DROP COLUMN IF EXISTS emergency_contact_relation,
      DROP COLUMN IF EXISTS emergency_contact_alt_phone, DROP COLUMN IF EXISTS emergency_contact_address,
      DROP COLUMN IF EXISTS bank_branch, DROP COLUMN IF EXISTS bank_account_holder, DROP COLUMN IF EXISTS bank_account_type,
      DROP COLUMN IF EXISTS joining_form_date, DROP COLUMN IF EXISTS bgv_status, DROP COLUMN IF EXISTS induction_date,
      DROP COLUMN IF EXISTS joining_signed_off_by, DROP COLUMN IF EXISTS joining_signed_off_at;
  `);
}
