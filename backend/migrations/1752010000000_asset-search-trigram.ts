/**
 * Make the asset register's search scale (AST-01, CLAUDE.md §1.9).
 *
 * The search is a leading-wildcard `LIKE '%term%'` across asset number, serial,
 * description, category AND the current holder's name — which no B-tree index
 * can serve, so it degraded into a sequential scan over `ast.assets` joined
 * against every employee. It was fast on a handful of rows and measurably slow
 * once the suite's 3,000-employee fixture existed; at 3k employees and a real
 * register it would be a support ticket.
 *
 * `pg_trgm` GIN indexes make leading-wildcard LIKE indexable. The employee-name
 * index is on the same lower(...) expression the query builds, so the planner
 * can actually use it.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE INDEX IF NOT EXISTS assets_asset_no_trgm
      ON ast.assets USING gin (lower(asset_no) gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS assets_serial_trgm
      ON ast.assets USING gin (lower(coalesce(serial_no, '')) gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS assets_description_trgm
      ON ast.assets USING gin (lower(coalesce(description, '')) gin_trgm_ops);

    -- Matches the exact expression the holder search builds.
    CREATE INDEX IF NOT EXISTS employees_fullname_trgm
      ON core.employees USING gin (
        lower(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) gin_trgm_ops
      );
    CREATE INDEX IF NOT EXISTS employees_ecode_trgm
      ON core.employees USING gin (lower(ecode) gin_trgm_ops);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS ast.assets_asset_no_trgm;
    DROP INDEX IF EXISTS ast.assets_serial_trgm;
    DROP INDEX IF EXISTS ast.assets_description_trgm;
    DROP INDEX IF EXISTS core.employees_fullname_trgm;
    DROP INDEX IF EXISTS core.employees_ecode_trgm;
  `);
}
