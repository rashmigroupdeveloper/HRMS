/**
 * Stage 3.4 — Helpdesk & Workplace Engagement (Cards W02, W03; HD-01, EN-01..04, C26, C27, C34).
 *
 * 1. Helpdesk:
 *    - `hd.categories.escalate_to_role_code`: higher management role for SLA auto-escalation (fixing C27).
 *    - `hd.tickets.first_response_at`: timestamp of first agent response for R29 SLA analytics.
 *    - `hd.tickets.reopen_count`: tracks reopen cycles without losing initial ticket lifecycle.
 *    - `hd.tickets.escalated_to_user_id`: designated management hierarchy user notified on breach.
 *    - Ensures category 'admin' exists for general workplace/admin queries.
 *
 * 2. Engagement Announcements:
 *    - `eng.announcements.attachment_document_id`: optional document attachment via StorageAdapter.
 *
 * 3. Multi-Question Structured Surveys (C34, docs/03 §9):
 *    - `eng.surveys`: multi-question pulse surveys with rating, choice, and text questions.
 *    - `eng.survey_responses`: responses with salted HMAC respondent hashing for anonymous ballots.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    -- ── 1. Helpdesk category escalation routing (C27) ─────────────────────────
    ALTER TABLE hd.categories
      ADD COLUMN IF NOT EXISTS escalate_to_role_code TEXT DEFAULT 'hr_head';

    -- Seed administrative / plant category if missing
    INSERT INTO hd.categories (code, name, assignee_role_code, sla_hours, escalate_after_hours, escalate_to_role_code)
    VALUES ('admin', 'General Administration', 'hr_ops', 24, 48, 'hr_head')
    ON CONFLICT (code) DO UPDATE
      SET escalate_to_role_code = EXCLUDED.escalate_to_role_code;

    -- Update escalation targets for default categories
    UPDATE hd.categories SET escalate_to_role_code = 'hr_head' WHERE code IN ('attendance', 'facilities', 'admin', 'payroll');
    UPDATE hd.categories SET escalate_to_role_code = 'super_admin' WHERE code IN ('it', 'hrms');

    -- ── 2. Helpdesk ticket SLA and response tracking ──────────────────────────
    ALTER TABLE hd.tickets
      ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS escalated_to_user_id BIGINT REFERENCES core.users(id);

    CREATE INDEX IF NOT EXISTS tickets_first_response_idx ON hd.tickets (first_response_at) WHERE first_response_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS tickets_escalated_to_idx ON hd.tickets (escalated_to_user_id) WHERE escalated_to_user_id IS NOT NULL;

    -- ── 3. Engagement Announcements attachment ────────────────────────────────
    ALTER TABLE eng.announcements
      ADD COLUMN IF NOT EXISTS attachment_document_id BIGINT REFERENCES core.documents(id);

    -- ── 4. Structured Multi-Question Surveys (EN-03, C34, docs/03 §9) ─────────
    CREATE TABLE IF NOT EXISTS eng.surveys (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      questions JSONB NOT NULL,
      audience JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by BIGINT NOT NULL REFERENCES core.users(id),
      open_from TIMESTAMPTZ NOT NULL DEFAULT now(),
      open_till TIMESTAMPTZ,
      is_anonymous BOOLEAN NOT NULL DEFAULT true,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS surveys_active_idx ON eng.surveys (open_from, open_till) WHERE is_active;

    CREATE TABLE IF NOT EXISTS eng.survey_responses (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      survey_id BIGINT NOT NULL REFERENCES eng.surveys(id) ON DELETE CASCADE,
      respondent_user_id BIGINT REFERENCES core.users(id),
      respondent_hash TEXT,
      answers JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT survey_responses_respondent_check CHECK (
        (respondent_user_id IS NULL) <> (respondent_hash IS NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_one_per_user
      ON eng.survey_responses (survey_id, respondent_user_id)
      WHERE respondent_user_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_one_per_hash
      ON eng.survey_responses (survey_id, respondent_hash)
      WHERE respondent_hash IS NOT NULL;

    COMMENT ON TABLE eng.surveys IS 'EN-03 multi-question pulse surveys (C34, docs/03 §9)';
    COMMENT ON TABLE eng.survey_responses IS 'Survey responses with salted HMAC dedupe for anonymous ballots';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS eng.survey_responses;
    DROP TABLE IF EXISTS eng.surveys;
    ALTER TABLE eng.announcements DROP COLUMN IF EXISTS attachment_document_id;
    ALTER TABLE hd.tickets DROP COLUMN IF EXISTS escalated_to_user_id;
    ALTER TABLE hd.tickets DROP COLUMN IF EXISTS reopen_count;
    ALTER TABLE hd.tickets DROP COLUMN IF EXISTS first_response_at;
    ALTER TABLE hd.categories DROP COLUMN IF EXISTS escalate_to_role_code;
  `);
}
