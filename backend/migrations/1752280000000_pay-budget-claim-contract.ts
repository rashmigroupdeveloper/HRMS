/**
 * CORE-12, CLM-02, NFR-04: reproduce the existing budget/claim contract.
 * Source: reviewed local catalog + docs/11 budget ownership + SOW pack P06/T01.
 * Historical recovered migration sources remain unchanged.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE pay.budgets
      ADD COLUMN IF NOT EXISTS overspend_allowed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE pay.claims
      ADD COLUMN IF NOT EXISTS funding_kind TEXT NOT NULL DEFAULT 'budget';

    -- Never guess funding ownership for an existing standalone claim.
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pay.claims WHERE funding_kind = 'budget' AND budget_id IS NULL) THEN
        RAISE EXCEPTION 'Claims have unresolved funding ownership; reconcile their source before migration';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid = 'pay.claims'::regclass AND conname = 'claims_funding_kind_check') THEN
        ALTER TABLE pay.claims ADD CONSTRAINT claims_funding_kind_check
          CHECK (funding_kind IN ('budget', 'entitlement'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid = 'pay.claims'::regclass AND conname = 'claims_budget_present') THEN
        ALTER TABLE pay.claims ADD CONSTRAINT claims_budget_present
          CHECK (funding_kind <> 'budget' OR budget_id IS NOT NULL);
      END IF;
    END $$;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  // Expand-only compatibility: these columns predate this migration in the
  // existing database. A one-step rollback retains them and their data.
  // A full rollback drops the tables through their historical owning migration.
}
