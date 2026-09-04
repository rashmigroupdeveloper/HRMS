/**
 * Migration — `ird` schema: POSH / grievance / whistleblower skeleton
 * (Phase 5, Stage 5.5 · PSH-01.., GRV-01..).
 * Spec: plans/phase-5-compliance-and-trust.md · docs/15 GAP-A19/A20/A21.
 *
 * This is an honest skeleton. The Internal Committee (IC) is NOT seeded —
 * appointing members is a sponsor decision. Until at least one row exists in
 * `ird.ic_members`, every UI surface must say so plainly rather than invent
 * names. Case content for v1 is plain text; encryption of the summary column
 * is a Phase 5 follow-up (column name documents the intent).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS ird;

    ------------------------------------------------------------------
    -- IC constitution — ZERO seed rows. Empty = not constituted.
    ------------------------------------------------------------------
    CREATE TABLE ird.ic_members (
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id   BIGINT NOT NULL REFERENCES core.employees(id),
      role          TEXT NOT NULL
                      CHECK (role IN ('presiding_officer','member','external')),
      active        BOOLEAN NOT NULL DEFAULT true,
      appointed_on  DATE NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX ic_members_active_idx ON ird.ic_members (active) WHERE active;
    COMMENT ON TABLE ird.ic_members IS
      'POSH Internal Committee. Seed ZERO members — sponsor appoints (do not invent).';

    ------------------------------------------------------------------
    -- POSH cases — confidential intake. summary is plain text for v1.
    ------------------------------------------------------------------
    CREATE TABLE ird.posh_cases (
      id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      case_ref                  TEXT NOT NULL,
      status                    TEXT NOT NULL DEFAULT 'submitted'
                                  CHECK (status IN (
                                    'submitted','under_inquiry','closed','withdrawn'
                                  )),
      filed_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- NULL when is_anonymous: the anonymous path must not leave a user FK.
      filed_by_user_id          BIGINT REFERENCES core.users(id),
      is_anonymous              BOOLEAN NOT NULL DEFAULT false,
      -- Phase 5 follow-up: encrypt at rest. v1 stores plain text; access is
      -- gated by withPermission('ird.posh.handle') + withStepUp.
      summary_encrypted_or_text TEXT NOT NULL,
      -- Hash of a one-time claim token for anonymous follow-up (nullable when
      -- the filer is authenticated and non-anonymous).
      anonymous_token_hash      TEXT,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT posh_cases_anonymous_pair CHECK (
        (is_anonymous = false AND filed_by_user_id IS NOT NULL)
        OR (is_anonymous = true AND filed_by_user_id IS NULL
            AND anonymous_token_hash IS NOT NULL)
      ),
      CONSTRAINT posh_cases_summary_present
        CHECK (length(btrim(summary_encrypted_or_text)) >= 10),
      CONSTRAINT posh_cases_ref_present
        CHECK (length(btrim(case_ref)) > 0)
    );
    CREATE UNIQUE INDEX posh_cases_ref_uq ON ird.posh_cases (case_ref);
    CREATE UNIQUE INDEX posh_cases_anon_token_uq
      ON ird.posh_cases (anonymous_token_hash)
      WHERE anonymous_token_hash IS NOT NULL;
    COMMENT ON COLUMN ird.posh_cases.summary_encrypted_or_text IS
      'v1: plain text. Encryption at rest is a Phase 5 follow-up — do not log this column.';

    ------------------------------------------------------------------
    -- Append-only access log — every POSH case OPEN is recorded here.
    ------------------------------------------------------------------
    CREATE TABLE ird.posh_case_access_log (
      id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      case_id        BIGINT NOT NULL REFERENCES ird.posh_cases(id),
      actor_user_id  BIGINT NOT NULL REFERENCES core.users(id),
      opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip             TEXT,
      outcome        TEXT NOT NULL DEFAULT 'opened'
                       CHECK (outcome IN ('opened','refused'))
    );
    CREATE OR REPLACE FUNCTION ird.posh_access_log_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'ird.posh_case_access_log is append-only (PSH access logging)';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER posh_access_log_immutable
      BEFORE UPDATE OR DELETE ON ird.posh_case_access_log
      FOR EACH ROW EXECUTE FUNCTION ird.posh_access_log_immutable();

    ------------------------------------------------------------------
    -- Grievances (IR Code redressal) — separate from POSH by design.
    ------------------------------------------------------------------
    CREATE TABLE ird.grievances (
      id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      case_ref          TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'submitted'
                          CHECK (status IN (
                            'submitted','under_review','escalated','resolved','closed'
                          )),
      filed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      filed_by_user_id  BIGINT NOT NULL REFERENCES core.users(id),
      summary           TEXT NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT grievances_summary_present CHECK (length(btrim(summary)) >= 10),
      CONSTRAINT grievances_ref_present CHECK (length(btrim(case_ref)) > 0)
    );
    CREATE UNIQUE INDEX grievances_ref_uq ON ird.grievances (case_ref);

    ------------------------------------------------------------------
    -- Whistleblower — no PII columns. Claim code = token returned once;
    -- only the hash is stored.
    ------------------------------------------------------------------
    CREATE TABLE ird.whistleblower_reports (
      id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      anonymous_token_hash TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'submitted'
                             CHECK (status IN (
                               'submitted','triaged','investigating','closed'
                             )),
      filed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      summary              TEXT NOT NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT whistle_summary_present CHECK (length(btrim(summary)) >= 10),
      CONSTRAINT whistle_token_present CHECK (length(btrim(anonymous_token_hash)) = 64)
    );
    CREATE UNIQUE INDEX whistle_token_uq
      ON ird.whistleblower_reports (anonymous_token_hash);
    COMMENT ON TABLE ird.whistleblower_reports IS
      'Anonymous whistleblower intake. No PII columns — only a token hash for claim-code follow-up.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    DROP TRIGGER IF EXISTS posh_access_log_immutable ON ird.posh_case_access_log;
    DROP FUNCTION IF EXISTS ird.posh_access_log_immutable();
    DROP TABLE IF EXISTS ird.posh_case_access_log;
    DROP TABLE IF EXISTS ird.whistleblower_reports;
    DROP TABLE IF EXISTS ird.grievances;
    DROP TABLE IF EXISTS ird.posh_cases;
    DROP TABLE IF EXISTS ird.ic_members;
    DROP SCHEMA IF EXISTS ird;
  `);
}
