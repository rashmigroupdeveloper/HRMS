/**
 * EMS budget request fields on te.trips (TE-05, live Yatra Avedan budget document).
 * The trip row is the budget the employee submits. Cost lines are stored in paise.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE te.trips
      ADD COLUMN IF NOT EXISTS travel_month TEXT,
      ADD COLUMN IF NOT EXISTS origin_city TEXT,
      ADD COLUMN IF NOT EXISTS airfare_paise BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hotel_per_night_paise BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hotel_nights INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_allowance_per_day_paise BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS visa_cost_paise BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS over_limit_justification TEXT;

    ALTER TABLE te.trips DROP CONSTRAINT IF EXISTS te_trips_travel_month_check;
    ALTER TABLE te.trips ADD CONSTRAINT te_trips_travel_month_check
      CHECK (travel_month IS NULL OR travel_month ~ '^[0-9]{4}-[0-9]{2}$');

    ALTER TABLE te.trips DROP CONSTRAINT IF EXISTS te_trips_budget_lines_nonnegative;
    ALTER TABLE te.trips ADD CONSTRAINT te_trips_budget_lines_nonnegative
      CHECK (
        airfare_paise >= 0
        AND hotel_per_night_paise >= 0
        AND hotel_nights >= 0
        AND daily_allowance_per_day_paise >= 0
        AND visa_cost_paise >= 0
      );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE te.trips DROP CONSTRAINT IF EXISTS te_trips_budget_lines_nonnegative;
    ALTER TABLE te.trips DROP CONSTRAINT IF EXISTS te_trips_travel_month_check;
    ALTER TABLE te.trips
      DROP COLUMN IF EXISTS over_limit_justification,
      DROP COLUMN IF EXISTS visa_cost_paise,
      DROP COLUMN IF EXISTS daily_allowance_per_day_paise,
      DROP COLUMN IF EXISTS hotel_nights,
      DROP COLUMN IF EXISTS hotel_per_night_paise,
      DROP COLUMN IF EXISTS airfare_paise,
      DROP COLUMN IF EXISTS origin_city,
      DROP COLUMN IF EXISTS travel_month;
  `);
}
