/** ATT-12 — completeness cursors can only move forward. */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE OR REPLACE FUNCTION att.device_watermark_monotonic() RETURNS trigger AS $$
    BEGIN
      IF NEW.device_id <> OLD.device_id THEN
        RAISE EXCEPTION 'device watermark ownership cannot change';
      END IF;
      IF NEW.watermark_ts < OLD.watermark_ts THEN
        RAISE EXCEPTION 'device watermark cannot regress (ATT-12)';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER device_watermark_monotonic
      BEFORE UPDATE ON att.device_watermarks
      FOR EACH ROW EXECUTE FUNCTION att.device_watermark_monotonic();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS device_watermark_monotonic ON att.device_watermarks;
    DROP FUNCTION IF EXISTS att.device_watermark_monotonic();
  `);
}
