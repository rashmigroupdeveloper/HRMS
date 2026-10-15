/**
 * M6 & M11/M12 — Payroll & Statutory (pay schema), per docs/03 §6, docs/04 §3/§6, docs/10, docs/14 §6.
 *
 * Implements:
 * - pay.salary_components (PAY-01): master catalog of earning, deduction, employer contribution components.
 * - pay.salary_structures (PAY-01, SOW-2.2a): templates per grade/category/location with DAG formula rules.
 * - pay.employee_salaries (PAY-02, PAY-16): effective-dated salary records with temporal EXCLUDE USING gist constraint
 *   prohibiting overlapping revisions.
 * - pay.payroll_runs, pay.payroll_items, pay.payroll_item_lines, pay.inputs, pay.salary_holds, pay.arrears.
 * - pay.statutory_rates, pay.pt_slabs, pay.it_slabs, pay.investment_declarations, pay.tds_challans.
 * - pay.gl_accounts, pay.bank_batches, pay.fnf_settlements.
 * - pay.loans, pay.loan_postings, pay.claim_types, pay.claim_entitlements, pay.claims, pay.claim_bills.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS pay;

    -- Temporal range exclusion requires btree_gist extension
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    -- 1. Salary components master catalog
    CREATE TABLE IF NOT EXISTS pay.salary_components (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('earning', 'deduction', 'employer_contribution')),
      formula TEXT,
      rounding TEXT NOT NULL DEFAULT 'round' CHECK (rounding IN ('round', 'floor', 'ceil', 'nearest_10')),
      taxable BOOLEAN NOT NULL DEFAULT true,
      part_of_gross BOOLEAN NOT NULL DEFAULT true,
      part_of_pf_wages BOOLEAN NOT NULL DEFAULT false,
      prorate_on_lop BOOLEAN NOT NULL DEFAULT true,
      display_order SMALLINT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 2. Salary structures (template per grade/category/location)
    CREATE TABLE IF NOT EXISTS pay.salary_structures (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      description TEXT,
      components JSONB NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS salary_structures_company_idx ON pay.salary_structures (company_id, is_active);

    -- 3. Effective-dated employee salary assignments
    CREATE TABLE IF NOT EXISTS pay.employee_salaries (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      structure_id BIGINT NOT NULL REFERENCES pay.salary_structures(id),
      effective_from DATE NOT NULL,
      effective_to DATE NOT NULL DEFAULT '9999-12-31',
      annual_ctc NUMERIC(14,2) NOT NULL,
      phase TEXT NOT NULL DEFAULT 'confirmed' CHECK (phase IN ('probation', 'confirmed')),
      component_amounts JSONB NOT NULL,
      probation_percent NUMERIC(5,2),
      revision_reason TEXT CHECK (revision_reason IN ('joining', 'annual_increment', 'promotion', 'confirmation', 'correction', 'probation_start')),
      approved_by BIGINT REFERENCES core.users(id),
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT valid_salary_dates CHECK (effective_from < effective_to),
      CONSTRAINT no_overlapping_salaries EXCLUDE USING gist (
        employee_id WITH =,
        daterange(effective_from, effective_to, '[)') WITH &&
      )
    );
    CREATE INDEX IF NOT EXISTS employee_salaries_emp_idx ON pay.employee_salaries (employee_id, effective_from DESC);

    -- 4. Payroll runs pipeline state machine
    CREATE TABLE IF NOT EXISTS pay.payroll_runs (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      month DATE NOT NULL,
      run_type TEXT NOT NULL DEFAULT 'regular' CHECK (run_type IN ('regular', 'off_cycle', 'fnf', 'bonus', 'arrears')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'inputs_locked', 'computed', 'under_review', 'approved', 'finalized', 'reopened', 'paid')),
      attendance_lock_id BIGINT REFERENCES att.month_locks(id),
      computed_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      approved_by BIGINT REFERENCES core.users(id),
      finalized_at TIMESTAMPTZ,
      finalized_by BIGINT REFERENCES core.users(id),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(company_id, month, run_type),
      CONSTRAINT check_attendance_lock_when_computed CHECK (status IN ('draft', 'inputs_locked') OR attendance_lock_id IS NOT NULL)
    );
    CREATE INDEX IF NOT EXISTS payroll_runs_company_month_idx ON pay.payroll_runs (company_id, month);

    -- 5. Payroll items (employee payslip header per run)
    CREATE TABLE IF NOT EXISTS pay.payroll_items (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id) ON DELETE CASCADE,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      days_in_month NUMERIC(4,1) NOT NULL,
      payable_days NUMERIC(4,1) NOT NULL,
      lop_days NUMERIC(4,1) NOT NULL DEFAULT 0,
      lop_reversal_days NUMERIC(4,1) NOT NULL DEFAULT 0,
      ot_minutes INTEGER NOT NULL DEFAULT 0,
      gross NUMERIC(14,2) NOT NULL,
      total_deductions NUMERIC(14,2) NOT NULL,
      net_pay NUMERIC(14,2) NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'payable' CHECK (payment_status IN ('payable', 'hold_payment', 'hold_process')),
      payslip_document_id BIGINT REFERENCES core.documents(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(run_id, employee_id)
    );
    CREATE INDEX IF NOT EXISTS payroll_items_run_idx ON pay.payroll_items (run_id);
    CREATE INDEX IF NOT EXISTS payroll_items_emp_idx ON pay.payroll_items (employee_id);

    -- 6. Payroll item lines (item_id × component × amount)
    CREATE TABLE IF NOT EXISTS pay.payroll_item_lines (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      item_id BIGINT NOT NULL REFERENCES pay.payroll_items(id) ON DELETE CASCADE,
      component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
      amount NUMERIC(14,2) NOT NULL,
      calc_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS payroll_item_lines_item_idx ON pay.payroll_item_lines (item_id);

    -- Immutability triggers for finalized payroll runs and items (PAY-03, C13)
    CREATE OR REPLACE FUNCTION pay.enforce_finalized_run_immutability()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'finalized' OR OLD.status = 'paid' THEN
          RAISE EXCEPTION 'Cannot delete finalized or paid payroll run';
        END IF;
        RETURN OLD;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'finalized' AND NEW.status != 'reopened' AND NEW.status != 'paid' THEN
          RAISE EXCEPTION 'Finalized payroll runs are immutable and cannot be updated except to reopen or mark paid';
        END IF;
        RETURN NEW;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_payroll_runs_immutability
    BEFORE UPDATE OR DELETE ON pay.payroll_runs
    FOR EACH ROW EXECUTE FUNCTION pay.enforce_finalized_run_immutability();

    CREATE OR REPLACE FUNCTION pay.enforce_finalized_items_immutability()
    RETURNS TRIGGER AS $$
    DECLARE
      run_status TEXT;
    BEGIN
      SELECT status INTO run_status FROM pay.payroll_runs WHERE id = COALESCE(OLD.run_id, NEW.run_id);
      IF run_status = 'finalized' OR run_status = 'paid' THEN
        RAISE EXCEPTION 'Cannot update or delete payroll items of a finalized payroll run';
      END IF;
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_payroll_items_immutability
    BEFORE UPDATE OR DELETE ON pay.payroll_items
    FOR EACH ROW EXECUTE FUNCTION pay.enforce_finalized_items_immutability();

    -- 7. Monthly variable inputs
    CREATE TABLE IF NOT EXISTS pay.inputs (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id),
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
      amount NUMERIC(14,2) NOT NULL,
      note TEXT NOT NULL,
      entered_by BIGINT NOT NULL REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS payroll_inputs_run_emp_idx ON pay.inputs (run_id, employee_id);

    -- 8. Salary holds (PAY-08)
    CREATE TABLE IF NOT EXISTS pay.salary_holds (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      hold_type TEXT NOT NULL CHECK (hold_type IN ('payment', 'process')),
      reason TEXT NOT NULL,
      start_month DATE NOT NULL,
      released_month DATE,
      created_by BIGINT NOT NULL REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS salary_holds_emp_idx ON pay.salary_holds (employee_id);

    -- 9. Arrears (PAY-16)
    CREATE TABLE IF NOT EXISTS pay.arrears (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      source_salary_id BIGINT NOT NULL REFERENCES pay.employee_salaries(id),
      for_month DATE NOT NULL,
      paid_in_run_id BIGINT REFERENCES pay.payroll_runs(id),
      component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
      amount NUMERIC(14,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS arrears_emp_month_idx ON pay.arrears (employee_id, for_month);

    -- 10. Statutory rates table
    CREATE TABLE IF NOT EXISTS pay.statutory_rates (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      scheme TEXT NOT NULL,
      param TEXT NOT NULL,
      value NUMERIC(14,4) NOT NULL,
      effective_from DATE NOT NULL,
      source_note TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 11. PT Slabs (PAY-11)
    CREATE TABLE IF NOT EXISTS pay.pt_slabs (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      state_code TEXT NOT NULL,
      min_monthly NUMERIC(14,2) NOT NULL,
      max_monthly NUMERIC(14,2),
      amount NUMERIC(8,2) NOT NULL,
      effective_from DATE NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pt_slabs_lookup_idx ON pay.pt_slabs (state_code, effective_from DESC);

    -- 12. Income Tax slabs (PAY-13)
    CREATE TABLE IF NOT EXISTS pay.it_slabs (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      fy TEXT NOT NULL,
      regime TEXT NOT NULL CHECK (regime IN ('old', 'new')),
      slab_from NUMERIC(14,2) NOT NULL,
      slab_to NUMERIC(14,2),
      rate NUMERIC(6,4) NOT NULL,
      surcharge_rules JSONB,
      cess_rate NUMERIC(6,4) NOT NULL DEFAULT 0.04,
      standard_deduction NUMERIC(14,2) NOT NULL,
      rebate_87a JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 13. Investment declarations (PAY-13)
    CREATE TABLE IF NOT EXISTS pay.investment_declarations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      fy TEXT NOT NULL,
      section TEXT NOT NULL,
      declared_amount NUMERIC(14,2) NOT NULL,
      proof_document_id BIGINT REFERENCES core.documents(id),
      verified_amount NUMERIC(14,2),
      verified_by BIGINT REFERENCES core.users(id),
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(employee_id, fy, section)
    );

    -- 14. TDS Challans (PAY-13)
    CREATE TABLE IF NOT EXISTS pay.tds_challans (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      month DATE NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      challan_no TEXT NOT NULL,
      bsr_code TEXT,
      paid_on DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 15. General Ledger Accounts (SAP JV mapping)
    CREATE TABLE IF NOT EXISTS pay.gl_accounts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
      cost_center_id BIGINT REFERENCES core.cost_centers(id),
      gl_code TEXT NOT NULL,
      gl_description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 16. Bank Batches (PAY-05)
    CREATE TABLE IF NOT EXISTS pay.bank_batches (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id),
      file_document_id BIGINT NOT NULL REFERENCES core.documents(id),
      total_amount NUMERIC(16,2) NOT NULL,
      record_count INTEGER NOT NULL,
      generated_by BIGINT NOT NULL REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 17. F&F Settlements (PAY-15, SOW-10)
    CREATE TABLE IF NOT EXISTS pay.fnf_settlements (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      separation_id BIGINT NOT NULL,
      run_id BIGINT REFERENCES pay.payroll_runs(id),
      last_working_day DATE NOT NULL,
      days_payable NUMERIC(4,1) NOT NULL,
      leave_encash_days NUMERIC(5,2) NOT NULL DEFAULT 0,
      notice_recovery_days NUMERIC(4,1) NOT NULL DEFAULT 0,
      gratuity_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      other_payments NUMERIC(14,2) NOT NULL DEFAULT 0,
      other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
      held_salary_released NUMERIC(14,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'clearances_pending', 'computed', 'approved', 'paid')),
      tat_due_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 18. Loans & Advances (M11, LN-01..04)
    CREATE TABLE IF NOT EXISTS pay.loans (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      loan_type TEXT NOT NULL CHECK (loan_type IN ('loan_diminishing', 'loan_flat', 'emi_no_interest', 'salary_advance', 'travel_advance')),
      principal NUMERIC(14,2) NOT NULL,
      interest_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
      emi NUMERIC(14,2) NOT NULL,
      start_month DATE NOT NULL,
      tenure_months SMALLINT NOT NULL,
      outstanding NUMERIC(14,2) NOT NULL,
      perquisite_applicable BOOLEAN NOT NULL DEFAULT false,
      source TEXT NOT NULL DEFAULT 'hrms' CHECK (source IN ('hrms', 'sap_legacy')),
      workflow_request_id BIGINT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'written_off')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS loans_emp_idx ON pay.loans (employee_id, status);

    -- 19. Loan Postings
    CREATE TABLE IF NOT EXISTS pay.loan_postings (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      loan_id BIGINT NOT NULL REFERENCES pay.loans(id),
      run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id),
      principal_part NUMERIC(14,2) NOT NULL,
      interest_part NUMERIC(14,2) NOT NULL,
      perquisite_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 20. Claim Types (M12, CLM-01..07)
    CREATE TABLE IF NOT EXISTS pay.claim_types (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      entitlement_basis TEXT NOT NULL CHECK (entitlement_basis IN ('annual', 'monthly', 'per_event')),
      bill_required BOOLEAN NOT NULL DEFAULT true,
      taxable_if_unsubstantiated BOOLEAN NOT NULL DEFAULT true,
      payout_component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 21. Claim Entitlements
    CREATE TABLE IF NOT EXISTS pay.claim_entitlements (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types(id),
      grade_id BIGINT REFERENCES core.grades(id),
      amount NUMERIC(14,2) NOT NULL,
      effective_from DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 22. Claims
    CREATE TABLE IF NOT EXISTS pay.claims (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types(id),
      period_from DATE NOT NULL,
      period_to DATE NOT NULL,
      claimed_amount NUMERIC(14,2) NOT NULL,
      approved_amount NUMERIC(14,2),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'approved', 'rejected', 'paid')),
      workflow_request_id BIGINT,
      rejection_reason TEXT,
      advance_loan_id BIGINT REFERENCES pay.loans(id),
      paid_in_run_id BIGINT REFERENCES pay.payroll_runs(id),
      paid_in_batch_id BIGINT REFERENCES pay.bank_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT claims_single_payout CHECK (NOT (paid_in_run_id IS NOT NULL AND paid_in_batch_id IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS claims_emp_idx ON pay.claims (employee_id, status);

    -- 23. Claim Bills
    CREATE TABLE IF NOT EXISTS pay.claim_bills (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      claim_id BIGINT NOT NULL REFERENCES pay.claims(id) ON DELETE CASCADE,
      document_id BIGINT NOT NULL REFERENCES core.documents(id),
      bill_no TEXT,
      bill_date DATE,
      amount NUMERIC(14,2) NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT false,
      verified_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 24. Seed live RML salary components (P2-T01, 09-RECON §2)
    INSERT INTO pay.salary_components
      (code, name, kind, formula, rounding, taxable, part_of_gross, part_of_pf_wages, prorate_on_lop, display_order)
    VALUES
      ('BASIC', 'Basic Salary', 'earning', NULL, 'round', true, true, true, true, 10),
      ('HRA', 'House Rent Allowance', 'earning', 'BASIC * 0.50', 'round', true, true, false, true, 20),
      ('MEDICAL_ALLOW', 'Medical Allowance', 'earning', NULL, 'round', true, true, false, true, 30),
      ('SPECIAL_ALLOW', 'Special Allowance', 'earning', NULL, 'round', true, true, false, true, 40),
      ('EDUCATION_ALLOW', 'Children Education Allowance', 'earning', NULL, 'round', true, true, false, true, 50),
      ('STATUTORY_BONUS', 'Statutory Bonus Advance', 'earning', 'BASIC * 0.0833', 'round', true, true, false, false, 60),
      ('OT', 'Overtime Allowance', 'earning', NULL, 'round', true, true, false, false, 70),
      ('PF_EE', 'Provident Fund (Employee)', 'deduction', 'PF_WAGES * 0.12', 'round', false, false, false, false, 110),
      ('PT', 'Professional Tax', 'deduction', NULL, 'round', false, false, false, false, 120),
      ('TDS', 'Income Tax (TDS)', 'deduction', NULL, 'round', false, false, false, false, 130),
      ('ESI_EE', 'ESIC (Employee)', 'deduction', 'GROSS * 0.0075', 'ceil', false, false, false, false, 140),
      ('GUEST_HOUSE', 'Guest House Recovery', 'deduction', NULL, 'round', false, false, false, false, 150),
      ('LWF_EE', 'Labour Welfare Fund (Employee)', 'deduction', NULL, 'round', false, false, false, false, 160),
      ('PF_ER', 'PF (Employer - EPF)', 'employer_contribution', 'PF_WAGES * 0.0367', 'round', false, false, false, false, 210),
      ('EPS_ER', 'EPS (Employer - Pension)', 'employer_contribution', 'PF_WAGES_CAPPED * 0.0833', 'round', false, false, false, false, 220),
      ('EDLI', 'EDLI (Employer)', 'employer_contribution', 'PF_WAGES_CAPPED * 0.0050', 'round', false, false, false, false, 230),
      ('PF_ADMIN', 'PF Admin Charges', 'employer_contribution', 'PF_WAGES * 0.0050', 'round', false, false, false, false, 240),
      ('ESI_ER', 'ESIC (Employer)', 'employer_contribution', 'GROSS * 0.0325', 'ceil', false, false, false, false, 250),
      ('LWF_ER', 'Labour Welfare Fund (Employer)', 'employer_contribution', NULL, 'round', false, false, false, false, 260),
      ('GRATUITY_ACCRUAL', 'Gratuity Accrual (Employer)', 'employer_contribution', 'BASIC * 0.0481', 'round', false, false, false, false, 270)
    ON CONFLICT (code) DO NOTHING;

    -- 25. Seed West Bengal PT slabs (P2-T01, 10 §4, G4)
    INSERT INTO pay.pt_slabs (state_code, min_monthly, max_monthly, amount, effective_from)
    VALUES
      ('WB', 0.00, 10000.00, 0.00, '2020-01-01'),
      ('WB', 10000.01, 15000.00, 110.00, '2020-01-01'),
      ('WB', 15000.01, 25000.00, 130.00, '2020-01-01'),
      ('WB', 25000.01, 40000.00, 150.00, '2020-01-01'),
      ('WB', 40000.01, NULL, 200.00, '2020-01-01');

    -- 26. Seed IT Slabs for FY 2025-26 and 2026-27 New Regime default (10 §6, 09 §3)
    INSERT INTO pay.it_slabs
      (fy, regime, slab_from, slab_to, rate, standard_deduction, rebate_87a)
    VALUES
      ('2025-26', 'new', 0.00, 300000.00, 0.0000, 75000.00, '{"threshold": 700000, "max_rebate": 25000}'::jsonb),
      ('2025-26', 'new', 300000.01, 700000.00, 0.0500, 75000.00, NULL),
      ('2025-26', 'new', 700000.01, 1000000.00, 0.1000, 75000.00, NULL),
      ('2025-26', 'new', 1000000.01, 1200000.00, 0.1500, 75000.00, NULL),
      ('2025-26', 'new', 1200000.01, 1500000.00, 0.2000, 75000.00, NULL),
      ('2025-26', 'new', 1500000.01, NULL, 0.3000, 75000.00, NULL);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS pay.claim_bills;
    DROP TABLE IF EXISTS pay.claim_entitlements;
    DROP TABLE IF EXISTS pay.loan_postings;
    DROP TABLE IF EXISTS pay.loans;
    DROP TABLE IF EXISTS pay.fnf_settlements;
    DROP TABLE IF EXISTS pay.bank_batches;
    DROP TABLE IF EXISTS pay.tds_challans;
    DROP TABLE IF EXISTS pay.investment_declarations;
    DROP TABLE IF EXISTS pay.it_slabs;
    DROP TABLE IF EXISTS pay.pt_slabs;
    DROP TABLE IF EXISTS pay.statutory_rates;
    DROP TABLE IF EXISTS pay.arrears;
    DROP TABLE IF EXISTS pay.salary_holds;
    DROP TABLE IF EXISTS pay.inputs;
    DROP TABLE IF EXISTS pay.payroll_item_lines;
    DROP TABLE IF EXISTS pay.payroll_items;
    DROP TABLE IF EXISTS pay.payroll_runs;
    DROP TABLE IF EXISTS pay.employee_salaries;
    DROP TABLE IF EXISTS pay.salary_structures;
    DROP TABLE IF EXISTS pay.salary_components;
    -- pay.claims, claim_types and gl_accounts belong to historical migrations.
    DROP FUNCTION IF EXISTS pay.enforce_finalized_items_immutability();
    DROP FUNCTION IF EXISTS pay.enforce_finalized_run_immutability();
  `);
}
