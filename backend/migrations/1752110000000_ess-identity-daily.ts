/**
 * Stage 5.8 — forgot-password tokens + profile-change requests (ESS-01/02).
 * Spec: plans/phase-5-compliance-and-trust.md Stage 5.8.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE TABLE core.password_reset_tokens (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES core.users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX password_reset_tokens_user ON core.password_reset_tokens (user_id, created_at DESC);

    CREATE TABLE core.profile_change_requests (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected')),
      workflow_request_id BIGINT REFERENCES wf.requests(id),
      decided_by BIGINT REFERENCES core.users(id),
      decided_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS core.profile_change_requests;
    DROP TABLE IF EXISTS core.password_reset_tokens;
  `);
}
