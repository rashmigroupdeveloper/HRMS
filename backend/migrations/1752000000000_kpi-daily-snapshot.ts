/**
 * RPT-03 — `reporting.kpi_daily`, the CEO dashboard's precomputed snapshot.
 *
 * docs/06 §4 is explicit: "nightly materialized snapshots so the dashboard
 * reads precomputed rows — no live heavy aggregation at CEO open time", which
 * is also CLAUDE.md §1.9 ("never ship a full-table live aggregation on a hot
 * path"). The CEO opening a page must never trigger a scan of att.day_records.
 *
 * Shape: one row per (snapshot_date, company, category, metric). Long-and-thin
 * rather than a wide column per KPI, so adding a metric is an INSERT rather
 * than a migration — the metric catalogue lives in code next to its formula.
 *
 * `value` is NULLABLE on purpose: a metric that cannot be computed yet (every
 * cost metric, until the Phase-2 payroll tables exist) must be recorded as
 * ABSENT, never as zero. Zero is a measurement; absence is not.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE TABLE reporting.kpi_daily (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      snapshot_date DATE NOT NULL,
      company_id BIGINT REFERENCES core.companies(id),   -- NULL = whole group
      category TEXT NOT NULL DEFAULT 'total',            -- 'total' | employment category
      metric TEXT NOT NULL,
      value NUMERIC(18,4),                               -- NULL = not computable yet
      /** Why a value is absent, so the UI can say so instead of guessing. */
      unavailable_reason TEXT,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (snapshot_date, company_id, category, metric)
    );
    CREATE INDEX kpi_daily_lookup_idx
      ON reporting.kpi_daily (snapshot_date DESC, company_id, metric);

    COMMENT ON TABLE reporting.kpi_daily IS
      'RPT-03 nightly KPI snapshot; NULL value = not computable (reason in unavailable_reason)';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS reporting.kpi_daily;`);
}
