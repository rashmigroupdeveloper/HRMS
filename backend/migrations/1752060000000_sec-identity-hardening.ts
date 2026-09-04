/**
 * Migration — `sec` schema: identity hardening (Phase 5, Stage 5.2 · SEC-01..11).
 * Spec: plans/phase-5-compliance-and-trust.md · docs/15 GAP-C01/C03/C04/C07, A17.
 *
 * Four facts this schema makes true that were not true before:
 *  1. A session is a ROW, not just a signed token — so "sign out everywhere"
 *     and an admin revoke take effect on the very next request (GAP-C04).
 *  2. Privileged roles carry a second factor (GAP-C03).
 *  3. Reading a masked column (salary, PAN, Aadhaar, bank) is an EVENT with a
 *     stated purpose, visible to the person whose record it was (GAP-A17).
 *  4. Password reuse is refusable, because history is kept (GAP-C07).
 *
 * Conventions: lock_timeout first · append-only enforced by trigger, not by
 * grants · access_events monthly-partitioned from day one (it is the highest
 * volume table in the schema and CLAUDE.md §9 forbids retrofitting that).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS sec;

    ------------------------------------------------------------------
    -- Sessions (SEC-05) — the token carries a sid claim; this row is the truth.
    ------------------------------------------------------------------
    CREATE TABLE sec.sessions (
      id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      sid               UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      user_id           BIGINT NOT NULL REFERENCES core.users(id),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at        TIMESTAMPTZ NOT NULL,
      revoked_at        TIMESTAMPTZ,
      revoked_by_user_id BIGINT REFERENCES core.users(id),
      revoke_reason     TEXT,
      ip                INET,
      user_agent        TEXT,
      device_label      TEXT,
      -- SEC-04: a successful step-up elevates THIS session for a short window.
      stepped_up_at     TIMESTAMPTZ,
      stepped_up_until  TIMESTAMPTZ,
      CONSTRAINT sessions_expiry_after_start CHECK (expires_at > created_at),
      CONSTRAINT sessions_revoke_pairs CHECK (
        (revoked_at IS NULL AND revoke_reason IS NULL)
        OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL)
      ),
      CONSTRAINT sessions_stepup_pairs CHECK (
        (stepped_up_at IS NULL AND stepped_up_until IS NULL)
        OR (stepped_up_at IS NOT NULL AND stepped_up_until IS NOT NULL
            AND stepped_up_until > stepped_up_at)
      )
    );
    -- The hot path: "is this sid live?" on every authenticated request.
    CREATE INDEX sessions_sid_live_idx ON sec.sessions (sid) WHERE revoked_at IS NULL;
    CREATE INDEX sessions_user_idx ON sec.sessions (user_id, last_seen_at DESC);

    ------------------------------------------------------------------
    -- MFA enrolment (SEC-02/03) — one live enrolment per user.
    ------------------------------------------------------------------
    CREATE TABLE sec.mfa_enrolments (
      id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id        BIGINT NOT NULL REFERENCES core.users(id),
      secret         TEXT NOT NULL,          -- base32; encrypted at rest by the app layer
      confirmed_at   TIMESTAMPTZ,            -- NULL = started but never proven
      disabled_at    TIMESTAMPTZ,
      disabled_by_user_id BIGINT REFERENCES core.users(id),
      last_used_step BIGINT,                 -- replay guard: a step is single-use
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- At most ONE active enrolment per user; superseded rows stay for the audit.
    CREATE UNIQUE INDEX mfa_one_active_per_user
      ON sec.mfa_enrolments (user_id) WHERE disabled_at IS NULL;
    CREATE TRIGGER mfa_enrolments_updated_at BEFORE UPDATE ON sec.mfa_enrolments
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- Recovery codes: hashed like passwords, single-use, never shown twice.
    CREATE TABLE sec.mfa_recovery_codes (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      enrolment_id BIGINT NOT NULL REFERENCES sec.mfa_enrolments(id) ON DELETE CASCADE,
      code_hash    TEXT NOT NULL,
      used_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX mfa_recovery_enrolment_idx ON sec.mfa_recovery_codes (enrolment_id);

    ------------------------------------------------------------------
    -- Password history (SEC-01) — hashes only, depth trimmed by the service.
    ------------------------------------------------------------------
    CREATE TABLE sec.password_history (
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id       BIGINT NOT NULL REFERENCES core.users(id),
      password_hash TEXT NOT NULL,
      changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      changed_by_user_id BIGINT REFERENCES core.users(id)
    );
    CREATE INDEX password_history_user_idx ON sec.password_history (user_id, changed_at DESC);

    ------------------------------------------------------------------
    -- Access events (SEC-10/11) — WHO read WHOSE sensitive data, and WHY.
    -- Append-only + monthly partitions (CLAUDE.md §9 — never retrofit these).
    ------------------------------------------------------------------
    CREATE TABLE sec.access_events (
      id                  BIGINT GENERATED ALWAYS AS IDENTITY,
      occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      actor_user_id       BIGINT NOT NULL REFERENCES core.users(id),
      session_sid         UUID,
      subject_employee_id BIGINT,          -- whose record was read
      resource            TEXT NOT NULL,   -- 'employee.statutory_ids' | 'employee.compensation' | ...
      field_class         TEXT NOT NULL,   -- 'statutory_id' | 'compensation' | 'bank' | 'health'
      purpose             TEXT NOT NULL,   -- SEC-10: stated, never inferred
      record_count        INTEGER NOT NULL DEFAULT 1,
      ip                  INET,
      PRIMARY KEY (id, occurred_at),
      CONSTRAINT access_events_count_positive CHECK (record_count > 0),
      CONSTRAINT access_events_purpose_stated CHECK (length(btrim(purpose)) >= 3)
    ) PARTITION BY RANGE (occurred_at);

    CREATE INDEX access_events_subject_idx
      ON sec.access_events (subject_employee_id, occurred_at DESC);
    CREATE INDEX access_events_actor_idx
      ON sec.access_events (actor_user_id, occurred_at DESC);

    CREATE OR REPLACE FUNCTION sec.access_events_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'sec.access_events is append-only (SEC-10 / DPDP access log)';
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER access_events_immutable BEFORE UPDATE OR DELETE ON sec.access_events
      FOR EACH ROW EXECUTE FUNCTION sec.access_events_immutable();

    CREATE OR REPLACE FUNCTION sec.ensure_access_partition(p_any_day DATE) RETURNS void AS $$
    DECLARE
      v_start DATE := date_trunc('month', p_any_day)::date;
      v_end   DATE := (v_start + interval '1 month')::date;
      v_name  TEXT := 'access_events_' || to_char(v_start, 'YYYYMM');
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'sec' AND c.relname = v_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE sec.%I PARTITION OF sec.access_events FOR VALUES FROM (%L) TO (%L)',
          v_name, v_start, v_end
        );
      END IF;
    END $$ LANGUAGE plpgsql;

    SELECT sec.ensure_access_partition(now()::date);
    SELECT sec.ensure_access_partition((now() + interval '1 month')::date);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS sec.access_events;
    DROP FUNCTION IF EXISTS sec.ensure_access_partition(DATE);
    DROP FUNCTION IF EXISTS sec.access_events_immutable();
    DROP TABLE IF EXISTS sec.password_history;
    DROP TABLE IF EXISTS sec.mfa_recovery_codes;
    DROP TABLE IF EXISTS sec.mfa_enrolments;
    DROP TABLE IF EXISTS sec.sessions;
    DROP SCHEMA IF EXISTS sec;
  `);
}
