/**
 * Migration — Reconcile Reimbursement Claims & Taxonomy (Stage 3.5, CLM-01..07, R31).
 *
 * Ensures backward-compatibility between Yatra Avedan (Phase 3.5 travel expense ledger)
 * and General Reimbursement Claims (Phase 2 employee claims).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- 1. pay.claim_types compatibility columns
    ALTER TABLE pay.claim_types
      ADD COLUMN IF NOT EXISTS entitlement_basis TEXT NOT NULL DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS bill_required BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS taxable_if_unsubstantiated BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS payout_component_code TEXT NOT NULL DEFAULT 'REIMB';

    -- 2. pay.claims compatibility columns
    ALTER TABLE pay.claims
      ADD COLUMN IF NOT EXISTS claim_type_id BIGINT REFERENCES pay.claim_types(id),
      ADD COLUMN IF NOT EXISTS advance_loan_id BIGINT REFERENCES pay.loans(id),
      ADD COLUMN IF NOT EXISTS paid_in_run_id BIGINT REFERENCES pay.payroll_runs(id),
      ADD COLUMN IF NOT EXISTS paid_in_batch_id BIGINT REFERENCES pay.bank_batches(id);

    -- Allow standalone general claims without mandatory travel budget
    ALTER TABLE pay.claims
      ALTER COLUMN budget_id DROP NOT NULL,
      ALTER COLUMN reference DROP NOT NULL;

    -- Ensure claims status permits lifecycle states
    ALTER TABLE pay.claims DROP CONSTRAINT IF EXISTS claims_status_check;
    ALTER TABLE pay.claims
      ADD CONSTRAINT claims_status_check
      CHECK (status IN ('draft', 'submitted', 'sent_back', 'pending', 'verified', 'approved', 'rejected', 'paid', 'settled'));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Reversible rollback
    ALTER TABLE pay.claims
      DROP COLUMN IF EXISTS paid_in_batch_id,
      DROP COLUMN IF EXISTS paid_in_run_id,
      DROP COLUMN IF EXISTS advance_loan_id,
      DROP COLUMN IF EXISTS claim_type_id;

    ALTER TABLE pay.claim_types
      DROP COLUMN IF EXISTS payout_component_code,
      DROP COLUMN IF EXISTS taxable_if_unsubstantiated,
      DROP COLUMN IF EXISTS bill_required,
      DROP COLUMN IF EXISTS entitlement_basis;
  `);
}
