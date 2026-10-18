/**
 * Kent CamAttendance webhook (KENT_RESEARCH §5.1): every POST is stored raw before it is
 * processed, and unknown-face events (type 0) are kept apart from swipes.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE att.kent_webhook_batches (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      remote_ip TEXT,
      raw_body TEXT NOT NULL,
      records INT NOT NULL DEFAULT 0,
      accepted INT NOT NULL DEFAULT 0,
      inserted INT NOT NULL DEFAULT 0,
      unknown_faces INT NOT NULL DEFAULT 0,
      rejected INT NOT NULL DEFAULT 0,
      processed_at TIMESTAMPTZ,
      error TEXT
    );
    CREATE INDEX kent_webhook_batches_received_idx ON att.kent_webhook_batches (received_at DESC);
    CREATE TABLE att.kent_unknown_faces (
      id BIGSERIAL PRIMARY KEY,
      batch_id BIGINT NOT NULL REFERENCES att.kent_webhook_batches(id) ON DELETE CASCADE,
      event_ts TIMESTAMPTZ,
      device_id TEXT,
      device_name TEXT,
      location_name TEXT,
      image_url TEXT,
      raw JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX kent_unknown_faces_event_idx ON att.kent_unknown_faces (event_ts DESC);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql('DROP TABLE att.kent_unknown_faces; DROP TABLE att.kent_webhook_batches;');
}
