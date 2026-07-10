/**
 * Migration 0007 — Stage 1.3: the generic workflow engine (WF-01..04).
 * Spec: docs/03 §8 · docs/08 §4 (chain catalog) · doc 11 §4b (send_back).
 *
 * The PP-14 rule is structural here: request_steps.notified_at is NOT NULL —
 * a step row cannot exist without its notification receipt.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- Approval chains as DATA (sponsor centralization rule): editable at
    -- runtime via the definitions API, versioned by updated_at + audit.
    CREATE TABLE wf.definitions (
      code TEXT PRIMARY KEY,             -- 'leave' | 'overtime' | 'resignation' | ...
      name TEXT NOT NULL,
      steps JSONB NOT NULL,              -- [{step, approver, slaHours, onBreach, escalateTo?}]
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER wf_definitions_updated_at BEFORE UPDATE ON wf.definitions
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE wf.requests (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      definition_code TEXT NOT NULL REFERENCES wf.definitions(code),
      subject_employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      requested_by BIGINT NOT NULL REFERENCES core.users(id),
      payload JSONB NOT NULL,            -- snapshot shown to approvers
      current_step SMALLINT NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','cancelled','lapsed','sent_back')),
      decided_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER wf_requests_updated_at BEFORE UPDATE ON wf.requests
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX wf_requests_subject_idx ON wf.requests (subject_employee_id, status);

    -- The visible timeline (WF-04): one row per approver touch, receipts included.
    CREATE TABLE wf.request_steps (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      request_id BIGINT NOT NULL REFERENCES wf.requests(id),
      step_no SMALLINT NOT NULL,
      approver_user_id BIGINT NOT NULL REFERENCES core.users(id),
      delegated_from BIGINT REFERENCES core.users(id),
      action TEXT CHECK (action IN ('approved','rejected','sent_back','escalated','skipped')),
      comment TEXT,
      notified_at TIMESTAMPTZ NOT NULL,  -- the PP-14 receipt: no step without it
      acted_at TIMESTAMPTZ,
      sla_due_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX wf_request_steps_inbox_idx ON wf.request_steps (approver_user_id)
      WHERE action IS NULL;
    CREATE INDEX wf_request_steps_sla_idx ON wf.request_steps (sla_due_at)
      WHERE action IS NULL;
    CREATE INDEX wf_request_steps_request_idx ON wf.request_steps (request_id, id);

    -- Out-of-office delegation (WF-01).
    CREATE TABLE wf.delegations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      from_user_id BIGINT NOT NULL REFERENCES core.users(id),
      to_user_id BIGINT NOT NULL REFERENCES core.users(id),
      from_date DATE NOT NULL,
      to_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (from_date <= to_date),
      CHECK (from_user_id <> to_user_id)
    );
    CREATE TRIGGER wf_delegations_updated_at BEFORE UPDATE ON wf.delegations
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS wf.delegations;
    DROP TABLE IF EXISTS wf.request_steps;
    DROP TABLE IF EXISTS wf.requests;
    DROP TABLE IF EXISTS wf.definitions;
  `);
}
