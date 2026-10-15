/**
 * Migration — Head of Department on the employee record (Phase 3.5 Stage T2).
 *
 * CORE-03 already carries a reporting manager and a functional reporting
 * manager. Neither is the HOD: a functional manager is a dotted line, while the
 * HOD is the person who owns the department's budget — and in the live EMS the
 * HOD is the SECOND approver on every claim, budget and advance.
 *
 * Stored per employee rather than derived from the department, matching the
 * live system, because real organisations carry exceptions: someone seconded to
 * a project reports their spend to a different head than their department's.
 * A department-level default can be layered on later without moving this column.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE core.employees
      ADD COLUMN IF NOT EXISTS hod_employee_id BIGINT REFERENCES core.employees(id);

    -- Nobody is their own head of department; the approval chain would have to
    -- drop the step anyway, so the database refuses the state outright.
    ALTER TABLE core.employees
      DROP CONSTRAINT IF EXISTS employees_hod_not_self;
    ALTER TABLE core.employees
      ADD CONSTRAINT employees_hod_not_self
      CHECK (hod_employee_id IS NULL OR hod_employee_id <> id);

    CREATE INDEX IF NOT EXISTS employees_hod_idx
      ON core.employees (hod_employee_id) WHERE hod_employee_id IS NOT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS core.employees_hod_idx;
    ALTER TABLE core.employees DROP CONSTRAINT IF EXISTS employees_hod_not_self;
    ALTER TABLE core.employees DROP COLUMN IF EXISTS hod_employee_id;
  `);
}
