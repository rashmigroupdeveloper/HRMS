/**
 * P-08 / S-18 / S-22: a loan is 'pending' until its approval chain completes;
 * rejected/cancelled are terminal. Legacy imports keep their source reference
 * in its own column (the old 'sap_legacy:<ref>' value violated loans_source_check).
 * Money sanity CHECKs are added NOT VALID (enforced for every new/updated row)
 * and validated immediately when the existing data already complies.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

const CHECKS: [string, string][] = [
  ['loans_principal_positive', 'principal > 0'],
  ['loans_emi_positive', 'emi > 0'],
  ['loans_outstanding_range', 'outstanding >= 0 AND outstanding <= principal'],
  ['loans_tenure_positive', 'tenure_months > 0'],
  ['loans_interest_range', 'interest_rate >= 0 AND interest_rate <= 100'],
];

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE pay.loans DROP CONSTRAINT loans_status_check;
    ALTER TABLE pay.loans ADD CONSTRAINT loans_status_check
      CHECK (status = ANY (ARRAY['pending','active','closed','written_off','rejected','cancelled']));
    ALTER TABLE pay.loans ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE pay.loans ADD COLUMN source_reference TEXT;
    CREATE UNIQUE INDEX loans_source_reference_unique ON pay.loans (employee_id, source_reference) WHERE source_reference IS NOT NULL;
    CREATE UNIQUE INDEX loans_workflow_request_unique ON pay.loans (workflow_request_id) WHERE workflow_request_id IS NOT NULL;
  `);
  for (const [name, expr] of CHECKS) {
    pgm.sql(`ALTER TABLE pay.loans ADD CONSTRAINT ${name} CHECK (${expr}) NOT VALID;`);
    pgm.sql(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pay.loans WHERE NOT (${expr})) THEN
        ALTER TABLE pay.loans VALIDATE CONSTRAINT ${name};
      END IF; END $$;`);
  }
}

export function down(pgm: MigrationBuilder): void {
  for (const [name] of CHECKS) pgm.sql(`ALTER TABLE pay.loans DROP CONSTRAINT IF EXISTS ${name};`);
  pgm.sql(`
    DROP INDEX IF EXISTS pay.loans_workflow_request_unique;
    DROP INDEX IF EXISTS pay.loans_source_reference_unique;
    ALTER TABLE pay.loans DROP COLUMN source_reference;
    ALTER TABLE pay.loans ALTER COLUMN status SET DEFAULT 'active';
    UPDATE pay.loans SET status = 'closed' WHERE status IN ('pending','rejected','cancelled');
    ALTER TABLE pay.loans DROP CONSTRAINT loans_status_check;
    ALTER TABLE pay.loans ADD CONSTRAINT loans_status_check CHECK (status = ANY (ARRAY['active','closed','written_off']));
  `);
}
