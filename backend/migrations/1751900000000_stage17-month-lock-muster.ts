/**
 * Migration 0012 — Stage 1.7: month lock + muster snapshot (ATT-15, RPT-01).
 * Spec: docs/03 §4 month_locks · docs/06 R1 · docs/14 §8.5 watermark rule.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS reporting;

    CREATE TABLE att.month_locks (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      month DATE NOT NULL,              -- first of month
      locked_by BIGINT NOT NULL REFERENCES core.users(id),
      locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, month)
    );

    -- Precomputed muster row per employee × month (docs/13: no live 3k×31 agg on hot path)
    CREATE TABLE reporting.muster_month (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      month DATE NOT NULL,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      ecode TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      reporting_manager TEXT,
      functional_manager TEXT,
      department TEXT,
      designation TEXT,
      org_unit TEXT,
      cost_center TEXT,
      contact TEXT,
      category TEXT,
      day_statuses JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"01":"P","02":"A",...}
      present SMALLINT NOT NULL DEFAULT 0,
      absent SMALLINT NOT NULL DEFAULT 0,
      half_days SMALLINT NOT NULL DEFAULT 0,
      weekoffs SMALLINT NOT NULL DEFAULT 0,
      weekoffs_unpaid SMALLINT NOT NULL DEFAULT 0,
      holidays SMALLINT NOT NULL DEFAULT 0,
      leave_days NUMERIC(5,1) NOT NULL DEFAULT 0,
      od_days SMALLINT NOT NULL DEFAULT 0,
      co_days SMALLINT NOT NULL DEFAULT 0,
      uab_days SMALLINT NOT NULL DEFAULT 0,
      lop_days NUMERIC(5,1) NOT NULL DEFAULT 0,
      ot_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
      built_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, month, employee_id)
    );
    CREATE INDEX muster_month_lookup_idx ON reporting.muster_month (company_id, month);
    CREATE INDEX muster_month_rm_idx ON reporting.muster_month (month, reporting_manager);

    INSERT INTO core.settings (key, value, value_type, description) VALUES
      ('att.month_lock_pending_max_age_days', '7', 'number',
       'ATT-15: pending AR/OD/OT older than this block month lock unless carried'),
      ('att.manager_approval_required_for_lock', 'false', 'boolean',
       'ATT-12: when true, managers must mark team attendance approved before lock')
    ON CONFLICT (key) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS reporting.muster_month;
    DROP TABLE IF EXISTS att.month_locks;
    DROP SCHEMA IF EXISTS reporting;
    DELETE FROM core.settings WHERE key IN (
      'att.month_lock_pending_max_age_days',
      'att.manager_approval_required_for_lock'
    );
  `);
}
