/**
 * Migration 0003 — organization structure + employee master.
 * Spec: docs/03 §2–3 · doc 11 §0.2 (14-entity master) · CORE-02..08.
 *
 * NULLABILITY NOTE: docs/03 marks dob/doj/category/org-links NOT NULL as the
 * END-STATE. The confirmed import strategy is two-source (EMS seed → greytHR
 * enrich, doc 11 §0.1), so rows are legitimately incomplete between the two
 * steps. Those columns start NULLable; they are tightened to NOT NULL as a
 * Phase-2 precondition (payroll must never see an incomplete row — the run
 * pipeline additionally validates).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ------------------------------------------------------------------
    -- Organization (docs/03 §2)
    ------------------------------------------------------------------
    CREATE TABLE core.companies (
      id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code             TEXT UNIQUE NOT NULL,     -- canonical short code: 'RML'
      name             TEXT UNIQUE NOT NULL,     -- canonical legal name (deduped on import)
      ecode_prefix     TEXT UNIQUE NOT NULL,     -- e-code series prefix as used in real codes ('RML', 'EIPL')
      ecode_next_seq   INTEGER NOT NULL DEFAULT 1,
      is_india_payroll BOOLEAN NOT NULL DEFAULT true, -- 5 foreign entities = false (doc 00 D3)
      gstin TEXT, pan TEXT,
      pf_establishment_code TEXT, esic_code TEXT, pt_registration_no TEXT, tan TEXT,
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER companies_updated_at BEFORE UPDATE ON core.companies
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.locations (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      name       TEXT NOT NULL,
      state_code TEXT NOT NULL,                  -- 'WB' → PT slab + LWF selection
      timezone   TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, name)
    );
    CREATE TRIGGER locations_updated_at BEFORE UPDATE ON core.locations
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.cost_centers (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      code       TEXT NOT NULL,                  -- '1701' — SAP cost center (PP-8)
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, code)
    );
    CREATE TRIGGER cost_centers_updated_at BEFORE UPDATE ON core.cost_centers
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.departments (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,           -- normalized on import (112 raw values)
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER departments_updated_at BEFORE UPDATE ON core.departments
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.org_units (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      parent_id  BIGINT REFERENCES core.org_units(id),
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER org_units_updated_at BEFORE UPDATE ON core.org_units
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.designations (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,           -- normalized on import (176 raw values)
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER designations_updated_at BEFORE UPDATE ON core.designations
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.grades (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code       TEXT UNIQUE NOT NULL,
      name       TEXT NOT NULL,
      rank       SMALLINT NOT NULL,              -- leadership-% KPI cutoff
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER grades_updated_at BEFORE UPDATE ON core.grades
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Employee master (docs/03 §3)
    ------------------------------------------------------------------
    CREATE TYPE core.employment_category AS ENUM
      ('white_collar','blue_collar','trainee','consultant','contract');
    CREATE TYPE core.employee_status AS ENUM
      ('onboarding','active','on_notice','exited');
    CREATE TYPE core.contract_type AS ENUM
      ('permanent','temporary','probationary','consultant','fixed_term');

    CREATE TABLE core.employees (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ecode        TEXT UNIQUE NOT NULL,          -- 'RML035384' — THE identifier (CORE-02)
      company_id   BIGINT NOT NULL REFERENCES core.companies(id),
      first_name   TEXT NOT NULL,
      last_name    TEXT,
      photo_path   TEXT,
      gender       TEXT,
      dob          DATE,                          -- greytHR enrich; NOT NULL before Phase 2
      marital_status TEXT,
      blood_group  TEXT,
      personal_email TEXT,
      work_email   CITEXT UNIQUE,
      mobile       TEXT,                          -- EMS phone (94% filled); exceptions reported
      emergency_contact_name TEXT, emergency_contact_phone TEXT,
      present_address TEXT, permanent_address TEXT,
      category     core.employment_category,      -- greytHR enrich; NOT NULL before Phase 2
      contract_type core.contract_type,
      contract_end_date DATE,
      doj          DATE,                          -- greytHR enrich; NOT NULL before Phase 2
      dol          DATE,
      status       core.employee_status NOT NULL DEFAULT 'onboarding',
      exit_reason  TEXT,
      designation_id BIGINT REFERENCES core.designations(id),
      department_id  BIGINT REFERENCES core.departments(id),
      org_unit_id    BIGINT REFERENCES core.org_units(id),
      location_id    BIGINT REFERENCES core.locations(id),
      cost_center_id BIGINT REFERENCES core.cost_centers(id),
      grade_id       BIGINT REFERENCES core.grades(id),
      reporting_manager_id  BIGINT REFERENCES core.employees(id),
      functional_manager_id BIGINT REFERENCES core.employees(id),  -- EMS hod_id (CORE-03)
      probation_months SMALLINT,
      probation_salary_pct SMALLINT,
      probation_due_date DATE,
      confirmation_date DATE,
      pan TEXT, aadhaar TEXT, uan TEXT, pf_number TEXT, esic_ip_number TEXT,
      pf_applicable  BOOLEAN NOT NULL DEFAULT true,
      esic_applicable BOOLEAN NOT NULL DEFAULT false,
      pt_applicable  BOOLEAN NOT NULL DEFAULT true,
      lwf_applicable BOOLEAN NOT NULL DEFAULT true,
      tax_regime TEXT NOT NULL DEFAULT 'new' CHECK (tax_regime IN ('old','new')),
      bank_name TEXT, bank_account TEXT, bank_ifsc TEXT,
      payment_mode TEXT NOT NULL DEFAULT 'bank' CHECK (payment_mode IN ('bank','cheque','hold')),
      access_card_no TEXT,
      biometric_registered BOOLEAN NOT NULL DEFAULT false,
      attendance_mode TEXT NOT NULL DEFAULT 'biometric'
        CHECK (attendance_mode IN ('biometric','mobile','manual')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- PP-17 can never recur: exited requires a date-of-leaving.
      CHECK (status <> 'exited' OR dol IS NOT NULL)
    );
    CREATE TRIGGER employees_updated_at BEFORE UPDATE ON core.employees
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX employees_status_company_idx ON core.employees (status, company_id);
    CREATE INDEX employees_rm_idx ON core.employees (reporting_manager_id);

    -- Late FKs into auth tables (deferred from migration 0001).
    ALTER TABLE core.users
      ADD CONSTRAINT users_employee_fk FOREIGN KEY (employee_id) REFERENCES core.employees(id);
    ALTER TABLE core.user_roles
      ADD CONSTRAINT user_roles_scope_fk FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id);

    ------------------------------------------------------------------
    -- Reporting-tree closure (CORE-10, KQ) — company-agnostic
    ------------------------------------------------------------------
    CREATE TABLE core.reporting_tree (
      manager_id  BIGINT NOT NULL,
      employee_id BIGINT NOT NULL,
      depth       SMALLINT NOT NULL,
      PRIMARY KEY (manager_id, employee_id)
    );

    CREATE OR REPLACE FUNCTION core.rebuild_reporting_tree() RETURNS trigger AS $$
    BEGIN
      -- Full rebuild: O(n) recursive walk — milliseconds at 3k–10k employees,
      -- statement-level so bulk imports rebuild ONCE. Depth cap kills cycles.
      TRUNCATE core.reporting_tree;
      INSERT INTO core.reporting_tree (manager_id, employee_id, depth)
      WITH RECURSIVE chain AS (
        SELECT e.reporting_manager_id AS manager_id, e.id AS employee_id, 1 AS depth
        FROM core.employees e
        WHERE e.reporting_manager_id IS NOT NULL
        UNION ALL
        SELECT e.reporting_manager_id, c.employee_id, (c.depth + 1)::smallint
        FROM chain c
        JOIN core.employees e ON e.id = c.manager_id
        WHERE e.reporting_manager_id IS NOT NULL AND c.depth < 50
      )
      SELECT manager_id, employee_id, MIN(depth)
      FROM chain
      GROUP BY manager_id, employee_id;
      RETURN NULL;
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER employees_reporting_tree
      AFTER INSERT OR DELETE OR UPDATE OF reporting_manager_id ON core.employees
      FOR EACH STATEMENT EXECUTE FUNCTION core.rebuild_reporting_tree();

    ------------------------------------------------------------------
    -- E-code generator (CORE-02): atomic per-company sequence
    ------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION core.next_ecode(p_company_id BIGINT) RETURNS TEXT AS $$
    DECLARE
      v_seq INTEGER;
      v_prefix TEXT;
    BEGIN
      UPDATE core.companies
      SET ecode_next_seq = ecode_next_seq + 1
      WHERE id = p_company_id
      RETURNING ecode_next_seq - 1, ecode_prefix INTO v_seq, v_prefix;
      IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'Unknown company id %', p_company_id;
      END IF;
      RETURN v_prefix || lpad(v_seq::text, 6, '0');
    END $$ LANGUAGE plpgsql;

    ------------------------------------------------------------------
    -- History / family / documents (docs/03 §3)
    ------------------------------------------------------------------
    CREATE TABLE core.employee_history (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      effective_date DATE NOT NULL,
      change_type TEXT NOT NULL,
      field TEXT NOT NULL, old_value TEXT, new_value TEXT,
      reference_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER employee_history_updated_at BEFORE UPDATE ON core.employee_history
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.employee_family (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      name TEXT NOT NULL, relation TEXT NOT NULL, dob DATE,
      aadhaar TEXT,
      is_esic_dependent BOOLEAN NOT NULL DEFAULT false,
      is_nominee BOOLEAN NOT NULL DEFAULT false,
      nominee_share_pct NUMERIC(5,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER employee_family_updated_at BEFORE UPDATE ON core.employee_family
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.documents (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      owner_employee_id BIGINT REFERENCES core.employees(id),
      kind TEXT NOT NULL,
      path TEXT NOT NULL,                        -- object-store key (storage adapter → SeaweedFS)
      original_name TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL,
      uploaded_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER documents_updated_at BEFORE UPDATE ON core.documents
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Canonical 14-entity company seed (doc 11 §0.2 + §6.3; P0-T08 confirms
    -- RPL's legal name + the RMT/RMB/RBS/RAS mappings)
    ------------------------------------------------------------------
    INSERT INTO core.companies (code, name, ecode_prefix, is_india_payroll) VALUES
      ('RML',  'Rashmi Metaliks Limited',              'RML',  true),
      ('RGH',  'Rashmi Green Hydrogen Steel Ltd',      'RGH',  true),
      ('RDL',  'Reach Dredging Limited',               'RDL',  true),
      ('RPL',  'Rashmi Paradigm Limited',              'RPL',  true),
      ('EIPL', 'eHoome iOT Pvt. Limited',              'EIPL', true),
      ('KIO',  'Koove iOT Pvt. Limited',               'KIO',  true),
      ('KOL',  'Koove Organic Chemical Pvt. Limited',  'KOL',  true),
      ('RRE',  'Rashmi Rare Earth Limited',            'RRE',  true),
      ('RPF',  'Rashmi Pipes And Fittings FZCO Dubai', 'RPF',  false),
      ('RMT',  'Rashmi Metaliks UK Limited',           'RMT',  false),
      ('RMB',  'Rashmi Metaliks Bahrain W.L.L',        'RMB',  false),
      ('RBS',  'Reach Mining Tz Limited',              'RBS',  false),
      ('RAS',  'Rashmi Group',                         'RAS',  false);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS core.documents;
    DROP TABLE IF EXISTS core.employee_family;
    DROP TABLE IF EXISTS core.employee_history;
    DROP FUNCTION IF EXISTS core.next_ecode(BIGINT);
    DROP TRIGGER IF EXISTS employees_reporting_tree ON core.employees;
    DROP FUNCTION IF EXISTS core.rebuild_reporting_tree();
    DROP TABLE IF EXISTS core.reporting_tree;
    ALTER TABLE core.user_roles DROP CONSTRAINT IF EXISTS user_roles_scope_fk;
    ALTER TABLE core.users DROP CONSTRAINT IF EXISTS users_employee_fk;
    DROP TABLE IF EXISTS core.employees;
    DROP TYPE IF EXISTS core.contract_type;
    DROP TYPE IF EXISTS core.employee_status;
    DROP TYPE IF EXISTS core.employment_category;
    DROP TABLE IF EXISTS core.grades;
    DROP TABLE IF EXISTS core.designations;
    DROP TABLE IF EXISTS core.org_units;
    DROP TABLE IF EXISTS core.departments;
    DROP TABLE IF EXISTS core.cost_centers;
    DROP TABLE IF EXISTS core.locations;
    DROP TABLE IF EXISTS core.companies;
  `);
}
