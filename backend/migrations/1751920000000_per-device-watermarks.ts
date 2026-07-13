/**
 * ATT-12 / P1-T07 — per-device completeness watermarks.
 * A watermark means the connector has proved that the door is synchronized
 * through that instant. Swipe arrival alone must never advance this table.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE TABLE att.device_watermarks (
      device_id BIGINT PRIMARY KEY REFERENCES att.devices(id) ON DELETE CASCADE,
      watermark_ts TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX device_watermarks_ts_idx
      ON att.device_watermarks (watermark_ts);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS att.device_watermarks;`);
}
