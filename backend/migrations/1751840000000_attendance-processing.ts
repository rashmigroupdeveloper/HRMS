/**
 * Migration 0006 — Stage 1.2: shifts, schemes, rosters, holidays, processed
 * day records, recompute queue. Spec: docs/03 §4 · docs/04 §1.1 · 09 §4
 * (two-session days + Saturday scheme are LIVE RML reality).
 *
 * Centralization (sponsor rule): every shift time/threshold is a ROW here —
 * editable at runtime through permission-gated APIs, never code.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE TABLE att.shifts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,            -- 'GEN','G5','GCS','NIGHT'
      name TEXT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      crosses_midnight BOOLEAN NOT NULL DEFAULT false,
      session_split TIME,                   -- two-session days (09 §4: G5 splits 13:30) — NULL = single session
      grace_in_minutes SMALLINT NOT NULL DEFAULT 0,
      grace_out_minutes SMALLINT NOT NULL DEFAULT 0,
      min_half_day_hours NUMERIC(4,2) NOT NULL,
      min_full_day_hours NUMERIC(4,2) NOT NULL,
      break_minutes SMALLINT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON att.shifts
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- Per-employee scheme: weekday vs Saturday shifts differ at RML (09 §4 GCS).
    CREATE TABLE att.employee_shifts (
      employee_id BIGINT PRIMARY KEY REFERENCES core.employees(id),
      weekday_shift_id BIGINT NOT NULL REFERENCES att.shifts(id),
      saturday_shift_id BIGINT REFERENCES att.shifts(id),  -- NULL = same as weekday
      updated_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER employee_shifts_updated_at BEFORE UPDATE ON att.employee_shifts
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- Manager-maintained month roster: per-date override of the scheme (ATT-04).
    CREATE TABLE att.rosters (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      work_date DATE NOT NULL,
      shift_id BIGINT REFERENCES att.shifts(id),           -- NULL + is_week_off = week-off day
      is_week_off BOOLEAN NOT NULL DEFAULT false,
      set_by BIGINT REFERENCES core.users(id),             -- manager accountability
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, work_date),
      CHECK (is_week_off OR shift_id IS NOT NULL)
    );
    CREATE TRIGGER rosters_updated_at BEFORE UPDATE ON att.rosters
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE att.holidays (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      location_id BIGINT REFERENCES core.locations(id),    -- NULL = all locations
      holiday_date DATE NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (location_id, holiday_date)
    );
    CREATE TRIGGER holidays_updated_at BEFORE UPDATE ON att.holidays
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TYPE att.day_status AS ENUM ('P','A','HD','WO','H','L','OD','CO','UAB');

    -- PROCESSED attendance — recomputable from raw until locked (ATT-03/05/15).
    CREATE TABLE att.day_records (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      work_date DATE NOT NULL,
      shift_id BIGINT REFERENCES att.shifts(id),
      status att.day_status NOT NULL,
      leave_type_id BIGINT,                 -- FK added with lv schema (Stage 1.5)
      first_in TIMESTAMPTZ,
      last_out TIMESTAMPTZ,
      worked_minutes INTEGER,
      late_minutes SMALLINT NOT NULL DEFAULT 0,
      early_exit_minutes SMALLINT NOT NULL DEFAULT 0,
      ot_minutes SMALLINT NOT NULL DEFAULT 0,
      weekoff_paid BOOLEAN,                 -- ATT-09 outcome, set at week close
      session_statuses JSONB,               -- dual-session breakdown (09 §4), NULL = single-status day
      scheme_code TEXT,                     -- effective shift code that day
      penalty_flag BOOLEAN NOT NULL DEFAULT false,
      source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','regularized','manual')),
      override_reason TEXT,                 -- mandatory when source='manual' (ATT-17)
      is_locked BOOLEAN NOT NULL DEFAULT false,
      computed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, work_date),
      CHECK (source <> 'manual' OR override_reason IS NOT NULL)
    );
    CREATE TRIGGER day_records_updated_at BEFORE UPDATE ON att.day_records
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX day_records_date_status_idx ON att.day_records (work_date, status);

    -- Locked months are immutable at the DB (ATT-15; unlock ceremony = Stage 1.7).
    CREATE OR REPLACE FUNCTION att.day_records_lock_guard() RETURNS trigger AS $$
    BEGIN
      IF OLD.is_locked THEN
        RAISE EXCEPTION 'att.day_records row % is locked (ATT-15: post-lock changes only via the audited unlock)', OLD.id;
      END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER day_records_lock_guard BEFORE UPDATE OR DELETE ON att.day_records
      FOR EACH ROW EXECUTE FUNCTION att.day_records_lock_guard();

    -- Dirty-flag queue: swipe arrivals mark employee-dates for recompute (ATT-03).
    CREATE TABLE att.recompute_queue (
      employee_id BIGINT NOT NULL,
      work_date DATE NOT NULL,
      queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (employee_id, work_date)
    );

    -- New raw swipes dirty their (IST) date AND the previous date (night shifts).
    CREATE OR REPLACE FUNCTION att.enqueue_recompute() RETURNS trigger AS $$
    DECLARE
      d DATE;
    BEGIN
      IF NEW.employee_id IS NULL THEN RETURN NULL; END IF;
      d := (NEW.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date;
      INSERT INTO att.recompute_queue (employee_id, work_date)
      VALUES (NEW.employee_id, d), (NEW.employee_id, d - 1)
      ON CONFLICT DO NOTHING;
      RETURN NULL;
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER swipe_events_enqueue_recompute AFTER INSERT ON att.swipe_events
      FOR EACH ROW EXECUTE FUNCTION att.enqueue_recompute();

    -- Live RML shift seed (09 §4) — rows are DATA, editable via the shifts API.
    INSERT INTO att.shifts
      (code, name, start_time, end_time, crosses_midnight, session_split,
       grace_in_minutes, grace_out_minutes, min_half_day_hours, min_full_day_hours, break_minutes)
    VALUES
      ('GEN',   'General 09:00–18:00',        '09:00','18:00', false, NULL,    10, 10, 4.0, 7.0, 30),
      ('G5',    'G5 two-session 09:00–18:00', '09:00','18:00', false, '13:30', 10, 10, 4.0, 7.0, 30),
      ('GCS',   'GCS Saturday 09:00–13:30',   '09:00','13:30', false, NULL,    10, 10, 2.0, 4.0, 0),
      ('NIGHT', 'Night 22:00–06:00',          '22:00','06:00', true,  NULL,    15, 15, 4.0, 7.0, 30);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS swipe_events_enqueue_recompute ON att.swipe_events;
    DROP FUNCTION IF EXISTS att.enqueue_recompute();
    DROP TABLE IF EXISTS att.recompute_queue;
    DROP TRIGGER IF EXISTS day_records_lock_guard ON att.day_records;
    DROP FUNCTION IF EXISTS att.day_records_lock_guard();
    DROP TABLE IF EXISTS att.day_records;
    DROP TYPE IF EXISTS att.day_status;
    DROP TABLE IF EXISTS att.holidays;
    DROP TABLE IF EXISTS att.rosters;
    DROP TABLE IF EXISTS att.employee_shifts;
    DROP TABLE IF EXISTS att.shifts;
  `);
}
