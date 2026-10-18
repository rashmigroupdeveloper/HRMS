/**
 * C-35 / C-17 / handover item 4: holiday calendars per company and plant (as well as
 * group-wide and per location). Existing location rows are backfilled with
 * their company; group-wide rows (all scope columns NULL) are unchanged.
 * Month locks record the attendance window they froze (26th–25th cycle).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    SET lock_timeout = '5s';
    ALTER TABLE att.holidays
      ADD COLUMN company_id BIGINT REFERENCES core.companies(id),
      ADD COLUMN plant_id BIGINT REFERENCES core.plants(id);
    UPDATE att.holidays h SET company_id = l.company_id FROM core.locations l WHERE l.id = h.location_id;
    ALTER TABLE att.holidays DROP CONSTRAINT holidays_location_date_uq;
    ALTER TABLE att.holidays
      ADD CONSTRAINT holidays_scope_date_uq UNIQUE NULLS NOT DISTINCT (company_id, plant_id, location_id, holiday_date),
      ADD CONSTRAINT holidays_scope_needs_company CHECK ((plant_id IS NULL AND location_id IS NULL) OR company_id IS NOT NULL),
      ADD CONSTRAINT holidays_location_company_fk FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id),
      ADD CONSTRAINT holidays_plant_company_fk FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id);
    CREATE INDEX holidays_date_idx ON att.holidays (holiday_date);

    -- C-17: each month lock records the attendance window it froze, so a change
    -- of att.cycle_start_day continues from the previous window without gap or overlap.
    ALTER TABLE att.month_locks
      ADD COLUMN period_from DATE,
      ADD COLUMN period_until DATE,
      ADD CONSTRAINT month_locks_period_ck CHECK ((period_from IS NULL) = (period_until IS NULL) AND (period_from IS NULL OR period_from < period_until));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE att.month_locks DROP CONSTRAINT month_locks_period_ck, DROP COLUMN period_until, DROP COLUMN period_from;
    DROP INDEX IF EXISTS att.holidays_date_idx;
    ALTER TABLE att.holidays
      DROP CONSTRAINT holidays_plant_company_fk,
      DROP CONSTRAINT holidays_location_company_fk,
      DROP CONSTRAINT holidays_scope_needs_company,
      DROP CONSTRAINT holidays_scope_date_uq;
    DELETE FROM att.holidays WHERE plant_id IS NOT NULL OR (company_id IS NOT NULL AND location_id IS NULL);
    ALTER TABLE att.holidays ADD CONSTRAINT holidays_location_date_uq UNIQUE NULLS NOT DISTINCT (location_id, holiday_date);
    ALTER TABLE att.holidays DROP COLUMN plant_id, DROP COLUMN company_id;
  `);
}
