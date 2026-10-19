/** ATT-04/C-35: consistent null-aware scope uniqueness on PG14 and PG16.
 * Earlier local PG14 deployments retained a location-only index, preventing
 * two companies from having a holiday on the same date. No rows are deleted.
 */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    LOCK TABLE att.holidays IN SHARE ROW EXCLUSIVE MODE;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM att.holidays GROUP BY company_id, plant_id, location_id, holiday_date HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Duplicate holiday scopes require HR reconciliation before this migration';
      END IF;
    END $$;
    DROP INDEX IF EXISTS att.holidays_company_wide_date_uq;
    ALTER TABLE att.holidays DROP CONSTRAINT IF EXISTS holidays_scope_date_uq;
    DROP INDEX IF EXISTS att.holidays_scope_date_uq;
    CREATE UNIQUE INDEX IF NOT EXISTS holidays_scope_identity_uq ON att.holidays
      (COALESCE(company_id, 0), COALESCE(plant_id, 0), COALESCE(location_id, 0), holiday_date);
  `);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    DROP INDEX IF EXISTS att.holidays_scope_identity_uq;
    CREATE UNIQUE INDEX holidays_scope_date_uq ON att.holidays
      (COALESCE(company_id, 0), COALESCE(plant_id, 0), COALESCE(location_id, 0), holiday_date);
  `);
}
