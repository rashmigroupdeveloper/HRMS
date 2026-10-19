/** SHF-01/CORE-08: empty legacy objects mean no rules; new writes must be arrays. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    LOCK TABLE att.shifts IN SHARE ROW EXCLUSIVE MODE;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM att.shifts
        WHERE (jsonb_typeof(late_slabs)<>'array' AND late_slabs<>'{}'::jsonb)
          OR (jsonb_typeof(early_exit_slabs)<>'array' AND early_exit_slabs<>'{}'::jsonb)) THEN
        RAISE EXCEPTION 'Nonempty malformed shift rules require policy reconciliation';
      END IF;
    END $$;
    UPDATE att.shifts SET
      late_slabs=CASE WHEN late_slabs='{}'::jsonb THEN '[]'::jsonb ELSE late_slabs END,
      early_exit_slabs=CASE WHEN early_exit_slabs='{}'::jsonb THEN '[]'::jsonb ELSE early_exit_slabs END
      WHERE late_slabs='{}'::jsonb OR early_exit_slabs='{}'::jsonb;
    ALTER TABLE att.shifts ADD CONSTRAINT shifts_policy_arrays
      CHECK (jsonb_typeof(late_slabs)='array' AND jsonb_typeof(early_exit_slabs)='array');
  `);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    ALTER TABLE att.shifts DROP CONSTRAINT IF EXISTS shifts_policy_arrays;
  `);
}
