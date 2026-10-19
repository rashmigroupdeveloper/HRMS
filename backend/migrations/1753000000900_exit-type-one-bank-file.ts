/** LC-06 exit type (retirement, death, contract end) and one active bank file per run (PAY-05). */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    ALTER TABLE core.separations
      ADD COLUMN IF NOT EXISTS exit_type TEXT NOT NULL DEFAULT 'resignation';
    ALTER TABLE core.separations DROP CONSTRAINT IF EXISTS separations_exit_type_check;
    ALTER TABLE core.separations
      ADD CONSTRAINT separations_exit_type_check
      CHECK (exit_type IN ('resignation', 'retirement', 'death', 'contract_end', 'termination'));

    ALTER TABLE pay.bank_batches ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
    UPDATE pay.bank_batches AS older
       SET superseded_at = now()
     WHERE superseded_at IS NULL
       AND EXISTS (
         SELECT 1 FROM pay.bank_batches AS newer
          WHERE newer.run_id = older.run_id AND newer.id > older.id
       );
    CREATE UNIQUE INDEX IF NOT EXISTS bank_batches_one_active
      ON pay.bank_batches (run_id) WHERE superseded_at IS NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS pay.bank_batches_one_active;
    ALTER TABLE pay.bank_batches DROP COLUMN IF EXISTS superseded_at;
    ALTER TABLE core.separations DROP CONSTRAINT IF EXISTS separations_exit_type_check;
    ALTER TABLE core.separations DROP COLUMN IF EXISTS exit_type;
  `);
}
