/**
 * Stage 1.7 — manager attendance-approval ledger (ATT-12 / P1-T07 / P1-T42).
 * When `att.manager_approval_required_for_lock` is true, every manager with
 * active reports in the entity×month must record an approval before month lock.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE TABLE att.manager_month_approvals (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      month DATE NOT NULL,                          -- first of month
      manager_employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      approved_by_user_id BIGINT NOT NULL REFERENCES core.users(id),
      approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, month, manager_employee_id)
    );
    CREATE INDEX manager_month_approvals_lookup_idx
      ON att.manager_month_approvals (company_id, month);

    -- Append-ish discipline: once approved, only super_admin-style reopen via delete
    -- is not exposed; HR can re-approve (upsert) with a new note if needed.
    COMMENT ON TABLE att.manager_month_approvals IS
      'ATT-12 manager attendance approval ledger — prerequisite for month lock when policy enabled';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS att.manager_month_approvals;`);
}
