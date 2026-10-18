/**
 * Migration — Travel Claim Commitment Ledger & Strict Budget Validations (Phase 3.5 Stage B).
 *
 * Implements:
 * 1. te.claims columns for summary documents (summary_document_id, summary_document_url)
 *    and explicit claim date bounds (period_from, period_to).
 * 2. te.budget_reservations: Immutable commitment ledger tracking budget allocations
 *    ('reserve' on claim submission, 'release' on rejection / send-back / settlement).
 * 3. Append-only trigger enforcing immutability on te.budget_reservations.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE te.claims
      ADD COLUMN IF NOT EXISTS summary_document_id BIGINT REFERENCES core.documents(id),
      ADD COLUMN IF NOT EXISTS summary_document_url TEXT,
      ADD COLUMN IF NOT EXISTS period_from DATE,
      ADD COLUMN IF NOT EXISTS period_to DATE;

    CREATE TABLE IF NOT EXISTS te.budget_reservations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      trip_id BIGINT NOT NULL REFERENCES te.trips(id),
      claim_id BIGINT NOT NULL REFERENCES te.claims(id),
      movement TEXT NOT NULL CHECK (movement IN ('reserve', 'release')),
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      reason TEXT NOT NULL,
      actor_user_id BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_budget_reservations_trip ON te.budget_reservations(trip_id);
    CREATE INDEX IF NOT EXISTS idx_te_budget_reservations_claim ON te.budget_reservations(claim_id);

    CREATE OR REPLACE FUNCTION te.reject_budget_reservation_mutation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'te.budget_reservations is an immutable ledger; updates and deletes are prohibited';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_no_update_delete_budget_reservations ON te.budget_reservations;
    CREATE TRIGGER trg_no_update_delete_budget_reservations
      BEFORE UPDATE OR DELETE ON te.budget_reservations
      FOR EACH ROW EXECUTE FUNCTION te.reject_budget_reservation_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_no_update_delete_budget_reservations ON te.budget_reservations;
    DROP FUNCTION IF EXISTS te.reject_budget_reservation_mutation();
    DROP TABLE IF EXISTS te.budget_reservations CASCADE;

    ALTER TABLE te.claims
      DROP COLUMN IF EXISTS summary_document_id,
      DROP COLUMN IF EXISTS summary_document_url,
      DROP COLUMN IF EXISTS period_from,
      DROP COLUMN IF EXISTS period_to;
  `);
}
