/**
 * Stage 1.2 integrity follow-up (ATT-03/04/05/13/18).
 *
 * Existing unlocked auto rows may predate direction-aware FILO and split-shift
 * windows, so they are queued for deterministic recomputation. Locked or
 * regularized/manual rows are deliberately untouched.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE att.shifts
      ADD CONSTRAINT shifts_primary_window_valid CHECK (
        start_time <> end_time
        AND (
          (crosses_midnight AND end_time < start_time)
          OR (NOT crosses_midnight AND end_time > start_time)
        )
      ),
      ADD CONSTRAINT shifts_session_split_valid CHECK (
        session_split IS NULL
        OR (
          NOT crosses_midnight
          AND session2_start IS NULL
          AND session_split > start_time
          AND session_split < end_time
        )
      ),
      ADD CONSTRAINT shifts_second_session_valid CHECK (
        session2_start IS NULL
        OR (
          NOT crosses_midnight
          AND session_split IS NULL
          AND session2_start >= end_time
          AND session2_end > session2_start
        )
      ),
      ADD CONSTRAINT shifts_minutes_nonnegative CHECK (
        grace_in_minutes >= 0
        AND grace_out_minutes >= 0
        AND break_minutes >= 0
        AND min_half_day_hours >= 0
        AND min_full_day_hours >= min_half_day_hours
      );

    ALTER TABLE att.day_records
      ADD CONSTRAINT day_records_minutes_nonnegative CHECK (
        worked_minutes IS NULL OR worked_minutes >= 0
      ) NOT VALID,
      ADD CONSTRAINT day_records_session_statuses_valid CHECK (
        session_statuses IS NULL
        OR (
          jsonb_typeof(session_statuses) = 'array'
          AND jsonb_array_length(session_statuses) = 2
          AND jsonb_path_exists(session_statuses, '$[*] ? (@.session == 1 && (@.status == "P" || @.status == "A"))')
          AND jsonb_path_exists(session_statuses, '$[*] ? (@.session == 2 && (@.status == "P" || @.status == "A"))')
        )
      ) NOT VALID;

    INSERT INTO att.recompute_queue (employee_id, work_date)
    SELECT employee_id, work_date
      FROM att.day_records
     WHERE source = 'auto'
       AND is_locked = false
    ON CONFLICT (employee_id, work_date)
    DO UPDATE SET queued_at = now();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE att.day_records
      DROP CONSTRAINT IF EXISTS day_records_session_statuses_valid,
      DROP CONSTRAINT IF EXISTS day_records_minutes_nonnegative;
    ALTER TABLE att.shifts
      DROP CONSTRAINT IF EXISTS shifts_minutes_nonnegative,
      DROP CONSTRAINT IF EXISTS shifts_second_session_valid,
      DROP CONSTRAINT IF EXISTS shifts_session_split_valid,
      DROP CONSTRAINT IF EXISTS shifts_primary_window_valid;
  `);
}
