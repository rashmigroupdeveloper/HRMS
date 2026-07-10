/**
 * Migration 0008 — Phase-1 code-review fixes (schema side).
 *  - att.holidays: dedup company-wide holidays (NULL location) — the default
 *    UNIQUE treats NULLs as distinct, so re-PUTs duplicated rows (review ing1).
 *  - wf.request_steps: at most ONE open step per request, enforced by the DB,
 *    so concurrent act()/advance() cannot fork the chain (review F4); plus an
 *    approver_spec snapshot so a step can be a ROLE QUEUE, actionable by any
 *    holder, not just the lowest-id user (review F8).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- Company-wide holidays (location_id NULL) must dedup on re-PUT.
    ALTER TABLE att.holidays DROP CONSTRAINT IF EXISTS holidays_location_id_holiday_date_key;
    ALTER TABLE att.holidays ADD CONSTRAINT holidays_location_date_uq
      UNIQUE NULLS NOT DISTINCT (location_id, holiday_date);

    -- The step's original approver spec (e.g. 'role:hr_ops'), so any holder of
    -- that role can act — the notified user is just the canonical recipient.
    ALTER TABLE wf.request_steps ADD COLUMN approver_spec TEXT;

    -- A request has at most one OPEN (un-acted) step at any time. Makes the
    -- double-approve / concurrent-advance race impossible at the DB layer.
    CREATE UNIQUE INDEX wf_one_open_step_per_request
      ON wf.request_steps (request_id) WHERE action IS NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS wf.wf_one_open_step_per_request;
    ALTER TABLE wf.request_steps DROP COLUMN IF EXISTS approver_spec;
    ALTER TABLE att.holidays DROP CONSTRAINT IF EXISTS holidays_location_date_uq;
    ALTER TABLE att.holidays ADD CONSTRAINT holidays_location_id_holiday_date_key
      UNIQUE (location_id, holiday_date);
  `);
}
