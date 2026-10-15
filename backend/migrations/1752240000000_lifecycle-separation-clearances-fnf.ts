import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration: Lifecycle Separations, Multi-Department Clearances & F&F Settlement Enhancements
 * Requirements: LC-06, LC-07, PAY-15, AST-04, SOW crosswalk, SOW crosswalk
 */
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  // 1. core.separations (LC-06, SOW crosswalk)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS core.separations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      initiated_by TEXT NOT NULL CHECK (initiated_by IN ('employee', 'hr')),
      reason TEXT NOT NULL,
      resignation_date DATE NOT NULL,
      notice_period_days SMALLINT NOT NULL,
      requested_lwd DATE NOT NULL,
      approved_lwd DATE,
      shortfall_days NUMERIC(4,1) NOT NULL DEFAULT 0,
      workflow_request_id BIGINT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'withdrawn', 'rejected', 'completed')),
      fnf_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_separations_employee ON core.separations(employee_id);
    CREATE INDEX IF NOT EXISTS idx_separations_status ON core.separations(status);
  `);

  // 2. core.clearances (LC-06, AST-04, SOW crosswalk)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS core.clearances (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      separation_id BIGINT NOT NULL REFERENCES core.separations(id) ON DELETE CASCADE,
      department TEXT NOT NULL CHECK (department IN ('IT', 'Admin', 'Finance', 'HR')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'flagged')),
      remarks TEXT,
      unreturned_assets JSONB,
      recovery_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      cleared_by BIGINT REFERENCES core.users(id),
      cleared_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_separation_department UNIQUE(separation_id, department)
    );

    CREATE INDEX IF NOT EXISTS idx_clearances_separation ON core.clearances(separation_id);
  `);

  // 3. pay.fnf_settlements enhancements (PAY-15, SOW crosswalk)
  pgm.sql(`
    ALTER TABLE pay.fnf_settlements
      ADD COLUMN IF NOT EXISTS leave_encash_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notice_recovery_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gross_payable NUMERIC(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_payable NUMERIC(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS relieving_letter_id BIGINT REFERENCES core.letters(id),
      ADD COLUMN IF NOT EXISTS service_certificate_id BIGINT REFERENCES core.letters(id),
      ADD COLUMN IF NOT EXISTS calc_breakdown JSONB;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE pay.fnf_settlements
      DROP COLUMN IF EXISTS calc_breakdown,
      DROP COLUMN IF EXISTS service_certificate_id,
      DROP COLUMN IF EXISTS relieving_letter_id,
      DROP COLUMN IF EXISTS paid_at,
      DROP COLUMN IF EXISTS net_payable,
      DROP COLUMN IF EXISTS total_deductions,
      DROP COLUMN IF EXISTS gross_payable,
      DROP COLUMN IF EXISTS notice_recovery_amount,
      DROP COLUMN IF EXISTS leave_encash_amount;

    DROP TABLE IF EXISTS core.clearances;
    DROP TABLE IF EXISTS core.separations;
  `);
}
