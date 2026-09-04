/**
 * Migration — Stage 1.11: shift micro-policy, roster publish, cyclic
 * templates, coverage targets, leave blackouts, shift-swap (SHF-01..16).
 *
 * Spec: plans/phase-1 Stage 1.11 · plans/coverage-closeout.md
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE att.shifts
      ADD COLUMN break_paid BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN ot_start_offset_minutes SMALLINT NOT NULL DEFAULT 0,
      ADD COLUMN late_slabs JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN early_exit_slabs JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN allowance_component_code TEXT,
      ADD COLUMN session2_start TIME,
      ADD COLUMN session2_end TIME,
      ADD CONSTRAINT shifts_hours_order CHECK (min_full_day_hours >= min_half_day_hours),
      ADD CONSTRAINT shifts_ot_offset CHECK (ot_start_offset_minutes BETWEEN 0 AND 240),
      ADD CONSTRAINT shifts_session2_pair CHECK (
        (session2_start IS NULL) = (session2_end IS NULL)
      );

    CREATE TABLE att.shift_patterns (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      cycle JSONB NOT NULL,
      created_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT shift_patterns_cycle_array CHECK (jsonb_typeof(cycle) = 'array')
    );
    CREATE TRIGGER shift_patterns_updated_at BEFORE UPDATE ON att.shift_patterns
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE att.roster_publications (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      manager_employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      period_from DATE NOT NULL,
      period_to DATE NOT NULL,
      published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_by BIGINT NOT NULL REFERENCES core.users(id),
      revision INT NOT NULL DEFAULT 1,
      reason TEXT,
      CHECK (period_to >= period_from)
    );
    CREATE UNIQUE INDEX roster_publications_range
      ON att.roster_publications (manager_employee_id, period_from, period_to);

    CREATE TABLE att.roster_revisions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      work_date DATE NOT NULL,
      old_shift_id BIGINT REFERENCES att.shifts(id),
      new_shift_id BIGINT REFERENCES att.shifts(id),
      old_week_off BOOLEAN NOT NULL,
      new_week_off BOOLEAN NOT NULL,
      reason TEXT NOT NULL,
      changed_by BIGINT NOT NULL REFERENCES core.users(id),
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION att.roster_revisions_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'att.roster_revisions is append-only (SHF-05)';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER roster_revisions_immutable
      BEFORE UPDATE OR DELETE ON att.roster_revisions
      FOR EACH ROW EXECUTE FUNCTION att.roster_revisions_immutable();

    CREATE TABLE att.coverage_targets (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      location_id BIGINT NOT NULL REFERENCES core.locations(id),
      department_id BIGINT REFERENCES core.departments(id),
      shift_id BIGINT NOT NULL REFERENCES att.shifts(id),
      weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      sanctioned INT NOT NULL CHECK (sanctioned >= 0),
      updated_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX coverage_targets_scope
      ON att.coverage_targets (location_id, weekday, shift_id, (COALESCE(department_id, 0)));
    CREATE TRIGGER coverage_targets_updated_at BEFORE UPDATE ON att.coverage_targets
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE att.leave_blackouts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      blackout_date DATE NOT NULL,
      location_id BIGINT REFERENCES core.locations(id),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (location_id, blackout_date)
    );
    CREATE TRIGGER leave_blackouts_updated_at BEFORE UPDATE ON att.leave_blackouts
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE att.shift_swaps (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      requester_employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      counterpart_employee_id BIGINT REFERENCES core.employees(id),
      work_date DATE NOT NULL,
      requester_shift_id BIGINT REFERENCES att.shifts(id),
      counterpart_shift_id BIGINT REFERENCES att.shifts(id),
      kind TEXT NOT NULL CHECK (kind IN ('swap', 'bid')),
      workflow_request_id BIGINT NOT NULL REFERENCES wf.requests(id),
      applied BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX shift_swaps_requester ON att.shift_swaps (requester_employee_id, work_date);

    INSERT INTO wf.definitions (code, name, steps)
    VALUES (
      'shift_swap',
      'Shift swap / bid',
      '[{"step":1,"approver":"reporting_manager","slaHours":48,"onBreach":"escalate"}]'::jsonb
    )
    ON CONFLICT (code) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    DELETE FROM wf.definitions WHERE code = 'shift_swap';
    DROP TABLE IF EXISTS att.shift_swaps;
    DROP TABLE IF EXISTS att.leave_blackouts;
    DROP TABLE IF EXISTS att.coverage_targets;
    DROP TRIGGER IF EXISTS roster_revisions_immutable ON att.roster_revisions;
    DROP FUNCTION IF EXISTS att.roster_revisions_immutable();
    DROP TABLE IF EXISTS att.roster_revisions;
    DROP TABLE IF EXISTS att.roster_publications;
    DROP TABLE IF EXISTS att.shift_patterns;
    ALTER TABLE att.shifts
      DROP CONSTRAINT IF EXISTS shifts_session2_pair,
      DROP CONSTRAINT IF EXISTS shifts_ot_offset,
      DROP CONSTRAINT IF EXISTS shifts_hours_order,
      DROP COLUMN IF EXISTS session2_end,
      DROP COLUMN IF EXISTS session2_start,
      DROP COLUMN IF EXISTS allowance_component_code,
      DROP COLUMN IF EXISTS early_exit_slabs,
      DROP COLUMN IF EXISTS late_slabs,
      DROP COLUMN IF EXISTS ot_start_offset_minutes,
      DROP COLUMN IF EXISTS break_paid;
  `);
}
