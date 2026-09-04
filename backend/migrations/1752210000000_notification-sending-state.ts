/**
 * The `sending` notification state (audit W0-T29, finding [E10]).
 *
 * The drain used to run a whole batch inside one transaction, so a failure late
 * in the batch rolled back the `markSent` of messages already delivered and the
 * retry sent them twice. Splitting claim from send needs a state that says
 * "this row is spoken for but not yet delivered" — otherwise a second worker
 * picks it up the moment the claim transaction commits.
 *
 * `stale_sending_minutes` exists because a worker can die mid-send. Without a
 * reclaim path those rows would sit in `sending` forever, which is silent loss —
 * precisely the failure this whole area is being fixed for (PP-14).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE wf.notifications
      DROP CONSTRAINT IF EXISTS notifications_status_check;
  `);
  pgm.sql(`
    ALTER TABLE wf.notifications
      ADD CONSTRAINT notifications_status_check
      CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'dead'));
  `);
  // The drain claims oldest-first and reclaims by age; both want this index.
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS notifications_status_created_idx
      ON wf.notifications (status, created_at);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`DROP INDEX IF EXISTS wf.notifications_status_created_idx;`);
  // Anything mid-flight must land somewhere legal before the old check returns.
  pgm.sql(`UPDATE wf.notifications SET status = 'queued' WHERE status = 'sending';`);
  pgm.sql(`ALTER TABLE wf.notifications DROP CONSTRAINT IF EXISTS notifications_status_check;`);
  pgm.sql(`
    ALTER TABLE wf.notifications
      ADD CONSTRAINT notifications_status_check
      CHECK (status IN ('queued', 'sent', 'failed', 'dead'));
  `);
}
