/** ATT-05/06/07: authoritative first/second-half coverage; no duplicate ledger. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`ALTER TABLE att.regularizations ADD COLUMN day_portion TEXT NOT NULL DEFAULT 'full_day'
    CHECK (day_portion IN ('full_day','first_half','second_half'));
    CREATE INDEX regularizations_half_coverage_idx ON att.regularizations(employee_id, from_date, to_date)
      WHERE day_portion <> 'full_day' AND applied;
    ALTER TABLE att.day_records DROP CONSTRAINT day_records_session_statuses_valid;
    ALTER TABLE att.day_records ADD CONSTRAINT day_records_session_statuses_valid CHECK (
      CASE WHEN session_statuses IS NULL THEN true
        WHEN jsonb_typeof(session_statuses) <> 'array' THEN false ELSE COALESCE(
        jsonb_array_length(session_statuses)=2
        AND session_statuses->0->'session'='1'::jsonb AND session_statuses->1->'session'='2'::jsonb
        AND session_statuses->0->>'status' IN ('P','A','O','OD')
        AND session_statuses->1->>'status' IN ('P','A','O','OD'), false) END);`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM att.regularizations WHERE day_portion <> 'full_day')
      OR EXISTS(SELECT 1 FROM att.day_records WHERE jsonb_path_exists(session_statuses, '$[*] ? (@.status == "OD")'))
    THEN RAISE EXCEPTION 'Reconcile half-day requests before downgrade'; END IF;
    END $$;
    DROP INDEX att.regularizations_half_coverage_idx;
    ALTER TABLE att.regularizations DROP COLUMN day_portion;
    ALTER TABLE att.day_records DROP CONSTRAINT day_records_session_statuses_valid;
    ALTER TABLE att.day_records ADD CONSTRAINT day_records_session_statuses_valid CHECK (
      CASE WHEN session_statuses IS NULL THEN true
        WHEN jsonb_typeof(session_statuses) <> 'array' THEN false ELSE COALESCE(
        jsonb_array_length(session_statuses)=2
        AND session_statuses->0->'session'='1'::jsonb AND session_statuses->1->'session'='2'::jsonb
        AND session_statuses->0->>'status' IN ('P','A','O')
        AND session_statuses->1->>'status' IN ('P','A','O'), false) END);`);
}
