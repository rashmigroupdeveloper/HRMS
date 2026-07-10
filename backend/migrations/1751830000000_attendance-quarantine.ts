/**
 * Migration 0005 — Stage 1.1: clock-drift quarantine + silent-alert state.
 * Spec: doc 14 §8.4 (devices drift / reset to epoch — quarantine implausible
 * timestamps, never let them poison FILO) · ATT-02 (alerting, not just data).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- Swipes whose timestamps fail the plausibility window. They NEVER enter
    -- att.swipe_events (device clock resets would corrupt attendance); HR/IT
    -- review them here and re-ingest after fixing the device clock.
    CREATE TABLE att.quarantined_swipes (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_no  TEXT NOT NULL,
      swipe_ts     TIMESTAMPTZ NOT NULL,
      door_code    TEXT,
      direction    TEXT,
      swipe_type   TEXT,
      received_at  TIMESTAMPTZ NOT NULL,
      source       TEXT NOT NULL,
      reason       TEXT NOT NULL,            -- 'future_timestamp' | 'too_old' | ...
      reviewed     BOOLEAN NOT NULL DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_no, swipe_ts, door_code, source)
    );
    CREATE INDEX quarantined_swipes_review_idx ON att.quarantined_swipes (reviewed, created_at);

    -- Silent-device alerting is TRANSITION-based (alert once when a door goes
    -- quiet, not every 5-minute cycle): remember when we last alerted.
    ALTER TABLE att.devices ADD COLUMN alerted_silent_at TIMESTAMPTZ;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE att.devices DROP COLUMN IF EXISTS alerted_silent_at;
    DROP TABLE IF EXISTS att.quarantined_swipes;
  `);
}
