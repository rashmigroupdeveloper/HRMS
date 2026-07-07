/**
 * Migration 0002 — workflow schema: notification queue + event subscriptions.
 * Spec: docs/03 §8 (wf.notifications, wf.event_subscriptions) · WF-02.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS wf;

    CREATE TABLE wf.notifications (
      id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      recipient_user_id BIGINT REFERENCES core.users(id),
      recipient_email   TEXT,               -- external recipients (pre-join links etc.)
      channel           TEXT NOT NULL CHECK (channel IN ('in_app','email')),
      template_code     TEXT NOT NULL,
      payload           JSONB NOT NULL,
      status            TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','sent','failed','dead')),
      attempts          SMALLINT NOT NULL DEFAULT 0,
      last_error        TEXT,
      sent_at           TIMESTAMPTZ,
      read_at           TIMESTAMPTZ,        -- in-app read receipt
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (recipient_user_id IS NOT NULL OR recipient_email IS NOT NULL)
    );
    CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON wf.notifications
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX notifications_queue_idx ON wf.notifications (status, created_at)
      WHERE status IN ('queued','failed');
    CREATE INDEX notifications_inbox_idx ON wf.notifications (recipient_user_id, read_at)
      WHERE channel = 'in_app';

    -- Per-event recipient matrix (PP-26): who gets told about what, as DATA.
    CREATE TABLE wf.event_subscriptions (
      id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_code     TEXT NOT NULL,        -- 'employee.joined'|'daily.boarding_report'|...
      recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('role','user','email')),
      recipient_ref  TEXT NOT NULL,        -- role code | user id | email address
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (event_code, recipient_kind, recipient_ref)
    );
    CREATE TRIGGER event_subscriptions_updated_at BEFORE UPDATE ON wf.event_subscriptions
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS wf.event_subscriptions;
    DROP TABLE IF EXISTS wf.notifications;
    DROP SCHEMA IF EXISTS wf;
  `);
}
