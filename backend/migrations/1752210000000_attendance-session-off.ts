/** ATT-05 / docs 09 §4: retain P:O without changing the daily/payable summary. */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE att.day_records DROP CONSTRAINT IF EXISTS day_records_session_statuses_valid;
    ALTER TABLE att.day_records ADD CONSTRAINT day_records_session_statuses_valid CHECK (
      CASE
        WHEN session_statuses IS NULL THEN true
        WHEN jsonb_typeof(session_statuses) <> 'array' THEN false
        ELSE COALESCE(
          jsonb_array_length(session_statuses) = 2
          AND session_statuses->0->'session' = '1'::jsonb
          AND session_statuses->1->'session' = '2'::jsonb
          AND session_statuses->0->>'status' IN ('P', 'A', 'O')
          AND session_statuses->1->>'status' IN ('P', 'A', 'O'), false
        )
      END
    ) NOT VALID;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  // Refuse a downgrade that would strand off-session records.
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM att.day_records WHERE jsonb_path_exists(session_statuses, '$[*] ? (@.status == "O")')) THEN
        RAISE EXCEPTION 'Cannot remove off-session support while O session records exist';
      END IF;
    END $$;
    ALTER TABLE att.day_records DROP CONSTRAINT day_records_session_statuses_valid;
    ALTER TABLE att.day_records ADD CONSTRAINT day_records_session_statuses_valid CHECK (
      session_statuses IS NULL OR (
        jsonb_typeof(session_statuses) = 'array' AND jsonb_array_length(session_statuses) = 2
        AND jsonb_path_exists(session_statuses, '$[*] ? (@.session == 1 && (@.status == "P" || @.status == "A"))')
        AND jsonb_path_exists(session_statuses, '$[*] ? (@.session == 2 && (@.status == "P" || @.status == "A"))')
      )
    ) NOT VALID;
  `);
}
