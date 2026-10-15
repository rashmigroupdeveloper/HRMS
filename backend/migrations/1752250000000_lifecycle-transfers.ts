import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration: Lifecycle Transfers, Promotions & Career History
 * Requirements: LC-05, SOW crosswalk, SOW crosswalk
 */
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  // 1. core.transfers (LC-05)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS core.transfers (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      transfer_type TEXT NOT NULL CHECK (transfer_type IN ('department', 'location', 'inter_entity', 'promotion')),
      effective_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),

      -- Current state snapshot
      current_company_id BIGINT NOT NULL REFERENCES core.companies(id),
      current_department_id BIGINT REFERENCES core.departments(id),
      current_location_id BIGINT REFERENCES core.locations(id),
      current_designation_id BIGINT REFERENCES core.designations(id),
      current_grade_id BIGINT REFERENCES core.grades(id),
      current_reporting_manager_id BIGINT REFERENCES core.employees(id),
      current_ecode TEXT NOT NULL,

      -- Target state
      target_company_id BIGINT REFERENCES core.companies(id),
      target_department_id BIGINT REFERENCES core.departments(id),
      target_location_id BIGINT REFERENCES core.locations(id),
      target_designation_id BIGINT REFERENCES core.designations(id),
      target_grade_id BIGINT REFERENCES core.grades(id),
      target_reporting_manager_id BIGINT REFERENCES core.employees(id),
      target_ecode TEXT,

      -- Compensation & leave adjustments
      salary_revision_amount NUMERIC(12, 2),
      leave_treatment TEXT NOT NULL DEFAULT 'transfer' CHECK (leave_treatment IN ('transfer', 'encash')),

      reason TEXT NOT NULL,
      remarks TEXT,

      -- Workflow & audit metadata
      approved_by BIGINT REFERENCES core.users(id),
      approved_at TIMESTAMPTZ,
      notified_at TIMESTAMPTZ,
      created_by BIGINT NOT NULL REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_employee ON core.transfers(employee_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_status ON core.transfers(status);
    CREATE INDEX IF NOT EXISTS idx_transfers_effective_date ON core.transfers(effective_date);
    CREATE INDEX IF NOT EXISTS idx_employee_history_lookup ON core.employee_history(employee_id, effective_date);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    DROP INDEX IF EXISTS idx_employee_history_lookup;
    DROP TABLE IF EXISTS core.transfers;
  `);
}
