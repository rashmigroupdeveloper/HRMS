/**
 * Payroll engine data (P-01, P-05, P-06, P-08, P-09, P-14, P-16, P-17, P-18, P-20).
 *
 * - Seeds pay.statutory_rates (docs/10) and pay.pt_slabs for WB and Odisha so
 *   compute reads statutory parameters from data, not code.
 * - pt_slabs.basis: WB slabs apply to earned monthly gross; Odisha's are
 *   annual-income slabs expressed on contracted monthly gross.
 * - PF wage basis per company and per employee (NULL = inherit the
 *   pay.pf_wage_base setting, which defaults to ACTUAL).
 * - Adds the recovery/earning components runs need; statutory bonus is
 *   prorated on LOP (Payment of Bonus Act pays on wages actually earned).
 * - 'apprentice' contract type (Apprentices Act 1961).
 * - Carry-forward ledger for recoveries trimmed to keep net pay ≥ 0.
 * - payroll_items.employer_cost and a payslip-only exception to the
 *   finalized-items immutability trigger (attaching the archived payslip).
 * - One loan posting per loan per run.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

const RATES: [string, string, number, string][] = [
  ['PF', 'ee_rate_pct', 12, 'EPF Act 1952 s.6'],
  ['PF', 'er_rate_pct', 12, 'EPF Act 1952 s.6'],
  ['PF', 'eps_rate_pct', 8.33, 'EPS 1995 para 3'],
  ['PF', 'wage_ceiling', 15000, 'EPF Scheme para 2(f), from 01-09-2014'],
  ['PF', 'eps_cap', 1250, '8.33% of ₹15,000'],
  ['PF', 'edli_rate_pct', 0.5, 'EDLI Scheme 1976'],
  ['PF', 'edli_cap', 75, '0.5% of ₹15,000'],
  ['PF', 'admin_rate_pct', 0.5, 'EPFO admin charges from 01-06-2018'],
  ['PF', 'admin_min_establishment', 500, 'EPFO admin charges minimum per establishment'],
  ['ESIC', 'ee_rate_pct', 0.75, 'ESI (Central) Rules, from 01-07-2019'],
  ['ESIC', 'er_rate_pct', 3.25, 'ESI (Central) Rules, from 01-07-2019'],
  ['ESIC', 'wage_ceiling', 21000, 'ESIC notification, from 01-01-2017'],
  ['BONUS', 'min_rate_pct', 8.33, 'Payment of Bonus Act 1965 s.10'],
  ['OT', 'hour_divisor', 208, 'docs/10: 26 days × 8 hours'],
  ['OT', 'multiplier', 2, 'Factories Act 1948 s.59'],
];

// [state, min, max|null, amount, basis]
const PT: [string, number, number | null, number, string][] = [
  ['WB', 0, 10000, 0, 'earned_monthly'],
  ['WB', 10000.01, 15000, 110, 'earned_monthly'],
  ['WB', 15000.01, 25000, 130, 'earned_monthly'],
  ['WB', 25000.01, 40000, 150, 'earned_monthly'],
  ['WB', 40000.01, null, 200, 'earned_monthly'],
  ['OD', 0, 13333.33, 0, 'contracted_monthly'],
  ['OD', 13333.34, 25000, 125, 'contracted_monthly'],
  ['OD', 25000.01, null, 200, 'contracted_monthly'],
];

// code, name, kind, part_of_gross, part_of_pf_wages, prorate_on_lop, display_order, taxable
const COMPONENTS: [string, string, string, boolean, boolean, boolean, number, boolean][] = [
  ['STIPEND', 'Stipend', 'earning', true, false, true, 15, false],
  ['PROJECT_ALLOW', 'Project Allowance', 'earning', true, false, true, 45, true],
  ['INCENTIVE', 'Incentive', 'earning', true, false, false, 80, true],
  ['ARREARS', 'Arrears', 'earning', true, false, false, 85, true],
  ['OTHER_EARNINGS', 'Other Earnings', 'earning', true, false, false, 90, true],
  ['CANTEEN', 'Canteen Recovery', 'deduction', false, false, false, 170, false],
  ['LOAN_EMI', 'Loan EMI', 'deduction', false, false, false, 175, false],
  ['MISC_RECOVERY', 'Miscellaneous Recovery', 'deduction', false, false, false, 180, false],
  ['TRAVEL_ADV_RECOVERY', 'Travel Advance Recovery', 'deduction', false, false, false, 185, false],
  ['NOTICE_RECOVERY', 'Notice Period Recovery', 'deduction', false, false, false, 190, false],
];

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  for (const [scheme, param, value, note] of RATES) {
    pgm.sql(`INSERT INTO pay.statutory_rates (scheme, param, value, effective_from, source_note)
      SELECT '${scheme}', '${param}', ${String(value)}, DATE '2014-09-01', '${note.replace(/'/g, "''")}'
      WHERE NOT EXISTS (SELECT 1 FROM pay.statutory_rates WHERE scheme = '${scheme}' AND param = '${param}');`);
  }
  pgm.sql(`CREATE UNIQUE INDEX statutory_rates_unique ON pay.statutory_rates (scheme, param, effective_from);`);

  pgm.sql(`ALTER TABLE pay.pt_slabs ADD COLUMN basis TEXT NOT NULL DEFAULT 'earned_monthly'
    CHECK (basis IN ('earned_monthly', 'contracted_monthly'));`);
  for (const [state, lo, hi, amount, basis] of PT) {
    pgm.sql(`INSERT INTO pay.pt_slabs (state_code, min_monthly, max_monthly, amount, effective_from, basis)
      SELECT '${state}', ${String(lo)}, ${hi === null ? 'NULL' : String(hi)}, ${String(amount)}, DATE '2014-04-01', '${basis}'
      WHERE NOT EXISTS (SELECT 1 FROM pay.pt_slabs WHERE state_code = '${state}' AND min_monthly = ${String(lo)});`);
  }

  for (const [code, name, kind, gross, pfw, prorate, order, taxable] of COMPONENTS) {
    pgm.sql(`INSERT INTO pay.salary_components (code, name, kind, part_of_gross, part_of_pf_wages, prorate_on_lop, display_order, taxable)
      VALUES ('${code}', '${name}', '${kind}', ${String(gross)}, ${String(pfw)}, ${String(prorate)}, ${String(order)}, ${String(taxable)})
      ON CONFLICT (code) DO NOTHING;`);
  }
  pgm.sql(`UPDATE pay.salary_components SET prorate_on_lop = true WHERE code = 'STATUTORY_BONUS';`);

  pgm.sql(`ALTER TYPE core.contract_type ADD VALUE IF NOT EXISTS 'apprentice';`);

  pgm.sql(`
    ALTER TABLE core.companies ADD COLUMN pf_wage_basis TEXT CHECK (pf_wage_basis IN ('ACTUAL', 'CEILING_15000'));
    ALTER TABLE core.employees ADD COLUMN pf_wage_basis TEXT CHECK (pf_wage_basis IN ('ACTUAL', 'CEILING_15000'));
    COMMENT ON COLUMN core.employees.pf_wage_basis IS 'NULL inherits the company basis, then the pay.pf_wage_base setting';

    ALTER TABLE pay.payroll_items ADD COLUMN employer_cost NUMERIC(14,2) NOT NULL DEFAULT 0;

    CREATE TABLE pay.recovery_carry_forwards (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      from_run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id) ON DELETE CASCADE,
      consumed_run_id BIGINT REFERENCES pay.payroll_runs(id) ON DELETE SET NULL,
      note TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (from_run_id, employee_id, component_code)
    );
    CREATE INDEX recovery_carry_forwards_open_idx ON pay.recovery_carry_forwards (employee_id) WHERE consumed_run_id IS NULL;

    CREATE UNIQUE INDEX loan_postings_loan_run_unique ON pay.loan_postings (loan_id, run_id);
    ALTER TABLE pay.payroll_item_lines ADD COLUMN loan_id BIGINT REFERENCES pay.loans(id);
    ALTER TABLE pay.payroll_item_lines ADD COLUMN carry_forward_id BIGINT REFERENCES pay.recovery_carry_forwards(id) ON DELETE SET NULL;

    CREATE OR REPLACE FUNCTION pay.enforce_finalized_items_immutability() RETURNS trigger LANGUAGE plpgsql AS $fn$
    DECLARE
      run_status TEXT;
    BEGIN
      SELECT status INTO run_status FROM pay.payroll_runs WHERE id = COALESCE(OLD.run_id, NEW.run_id);
      IF run_status = 'finalized' OR run_status = 'paid' THEN
        -- P-09: the only post-finalize write is attaching the archived payslip once.
        IF TG_OP = 'UPDATE' AND OLD.payslip_document_id IS NULL AND NEW.payslip_document_id IS NOT NULL
           AND (to_jsonb(NEW) - 'payslip_document_id') = (to_jsonb(OLD) - 'payslip_document_id') THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Cannot update or delete payroll items of a finalized payroll run';
      END IF;
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $fn$;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION pay.enforce_finalized_items_immutability() RETURNS trigger LANGUAGE plpgsql AS $fn$
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
    $fn$;
    ALTER TABLE pay.payroll_item_lines DROP COLUMN IF EXISTS carry_forward_id;
    ALTER TABLE pay.payroll_item_lines DROP COLUMN IF EXISTS loan_id;
    DROP INDEX IF EXISTS pay.loan_postings_loan_run_unique;
    DROP TABLE IF EXISTS pay.recovery_carry_forwards;
    ALTER TABLE pay.payroll_items DROP COLUMN IF EXISTS employer_cost;
    ALTER TABLE core.employees DROP COLUMN IF EXISTS pf_wage_basis;
    ALTER TABLE core.companies DROP COLUMN IF EXISTS pf_wage_basis;
    UPDATE pay.salary_components SET prorate_on_lop = false WHERE code = 'STATUTORY_BONUS';
    ALTER TABLE pay.pt_slabs DROP COLUMN IF EXISTS basis;
    DROP INDEX IF EXISTS pay.statutory_rates_unique;
  `);
  // Seeded statutory rows, PT slabs and catalog components stay: payroll lines
  // may reference them, and they are reference data. Postgres cannot drop an
  // enum value, so 'apprentice' also stays (unused values are harmless).
  pgm.sql(`DELETE FROM pay.pt_slabs WHERE state_code = 'OD' AND effective_from = DATE '2014-04-01';`);
}
