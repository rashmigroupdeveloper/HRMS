/** Performance index hardening: eliminate full table scans across hot paths. */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    CREATE INDEX IF NOT EXISTS idx_recompute_queue_queued_at ON att.recompute_queue (queued_at ASC);
    CREATE INDEX IF NOT EXISTS idx_fnf_settlements_emp_date ON pay.fnf_settlements (employee_id, last_working_day);
    CREATE INDEX IF NOT EXISTS idx_fnf_settlements_run ON pay.fnf_settlements (run_id);
    CREATE INDEX IF NOT EXISTS idx_claim_bills_claim_id ON pay.claim_bills (claim_id);
    CREATE INDEX IF NOT EXISTS idx_claim_entitlements_lookup ON pay.claim_entitlements (claim_type_id, grade_id, effective_from DESC);
    CREATE INDEX IF NOT EXISTS idx_wf_delegations_lookup ON wf.delegations (from_user_id, from_date, to_date);
    CREATE INDEX IF NOT EXISTS idx_ot_payroll_item ON att.overtime_entries (payroll_item_id);
    CREATE INDEX IF NOT EXISTS idx_salary_holds_active ON pay.salary_holds (employee_id, start_month);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    DROP INDEX IF EXISTS att.idx_recompute_queue_queued_at;
    DROP INDEX IF EXISTS pay.idx_fnf_settlements_emp_date;
    DROP INDEX IF EXISTS pay.idx_fnf_settlements_run;
    DROP INDEX IF EXISTS pay.idx_claim_bills_claim_id;
    DROP INDEX IF EXISTS pay.idx_claim_entitlements_lookup;
    DROP INDEX IF EXISTS wf.idx_wf_delegations_lookup;
    DROP INDEX IF EXISTS att.idx_ot_payroll_item;
    DROP INDEX IF EXISTS pay.idx_salary_holds_active;
  `);
}

