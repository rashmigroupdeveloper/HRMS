/**
 * Migration 0004 — attendance ingestion foundation (Stage 0.6 spike; ATT-01/02).
 * Spec: docs/03 §4 · docs/13 §0 (monthly partitioning from day one) · doc 14 §8.
 *
 * att.swipe_events is RAW and IMMUTABLE: rows mirror the device export
 * losslessly and are never updated/deleted — processed attendance (Phase 1)
 * derives from them and can always be recomputed.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS att;

    CREATE TABLE att.devices (
      id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      source      TEXT NOT NULL DEFAULT 'kent',   -- 'kent' | 'mobile' | 'mock'
      door_code   TEXT UNIQUE NOT NULL,
      location_id BIGINT REFERENCES core.locations(id),
      last_seen_at TIMESTAMPTZ,                   -- gap detection input (ATT-02)
      expected_hourly_swipes NUMERIC(8,2),
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER devices_updated_at BEFORE UPDATE ON att.devices
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- Per-source ingestion watermark: advance ONLY after commit (docs/02 §4).
    CREATE TABLE att.ingest_watermarks (
      source       TEXT PRIMARY KEY,
      watermark_ts TIMESTAMPTZ NOT NULL,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- RAW swipes, monthly range-partitioned (docs/13 §0: retrofit is painful — day one).
    CREATE TABLE att.swipe_events (
      id           BIGINT GENERATED ALWAYS AS IDENTITY,
      employee_id  BIGINT,                        -- resolved from employee_no; NULL = exception queue
      employee_no  TEXT NOT NULL,                 -- verbatim from device ('RML035384')
      access_card  TEXT,
      shift_label  TEXT,
      swipe_ts     TIMESTAMPTZ NOT NULL,
      door_code    TEXT,
      longitude    NUMERIC(9,6), latitude NUMERIC(9,6), location_type TEXT,
      mobile_device_name TEXT, mobile_device_id TEXT,
      swipe_type   TEXT,
      direction    TEXT,                          -- 'in'|'out'|NULL (infer FILO)
      remarks TEXT, permission_reason TEXT, signed_by TEXT,
      received_at  TIMESTAMPTZ NOT NULL,          -- device→cloud lag signal (PP-9)
      source       TEXT NOT NULL DEFAULT 'kent',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (id, swipe_ts),
      UNIQUE (employee_no, swipe_ts, door_code)   -- the idempotency key (includes partition col)
    ) PARTITION BY RANGE (swipe_ts);

    CREATE INDEX swipe_events_emp_ts_idx ON att.swipe_events (employee_id, swipe_ts);
    CREATE INDEX swipe_events_ts_brin ON att.swipe_events USING BRIN (swipe_ts);

    -- Raw swipes are immutable (same guarantee as the audit log).
    CREATE OR REPLACE FUNCTION att.swipe_events_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'att.swipe_events is append-only (ATT-01: raw swipes are never edited)';
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER swipe_events_immutable BEFORE UPDATE OR DELETE ON att.swipe_events
      FOR EACH ROW EXECUTE FUNCTION att.swipe_events_immutable();

    -- Partition maintenance: callable by ingestion for any month it encounters.
    CREATE OR REPLACE FUNCTION att.ensure_swipe_partition(p_any_day DATE) RETURNS void AS $$
    DECLARE
      v_start DATE := date_trunc('month', p_any_day)::date;
      v_end   DATE := (v_start + interval '1 month')::date;
      v_name  TEXT := 'swipe_events_' || to_char(v_start, 'YYYYMM');
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'att' AND c.relname = v_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE att.%I PARTITION OF att.swipe_events FOR VALUES FROM (%L) TO (%L)',
          v_name, v_start, v_end
        );
      END IF;
    END $$ LANGUAGE plpgsql;

    -- Current + next month ready immediately.
    SELECT att.ensure_swipe_partition(now()::date);
    SELECT att.ensure_swipe_partition((now() + interval '1 month')::date);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS att.swipe_events;
    DROP FUNCTION IF EXISTS att.ensure_swipe_partition(DATE);
    DROP FUNCTION IF EXISTS att.swipe_events_immutable();
    DROP TABLE IF EXISTS att.ingest_watermarks;
    DROP TABLE IF EXISTS att.devices;
    DROP SCHEMA IF EXISTS att;
  `);
}
