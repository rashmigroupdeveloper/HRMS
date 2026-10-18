/**
 * C-17 / B-18: transfers go through their approval chain (RM → HR Ops) and a
 * future-dated transfer is applied on its effective date. Links the transfer
 * to its workflow request.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.transfers ADD COLUMN workflow_request_id BIGINT REFERENCES wf.requests(id);
    CREATE UNIQUE INDEX transfers_workflow_request_uq ON core.transfers (workflow_request_id) WHERE workflow_request_id IS NOT NULL;
    CREATE INDEX transfers_due_idx ON core.transfers (effective_date) WHERE status = 'approved';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS core.transfers_due_idx;
    DROP INDEX IF EXISTS core.transfers_workflow_request_uq;
    ALTER TABLE core.transfers DROP COLUMN workflow_request_id;
  `);
}
