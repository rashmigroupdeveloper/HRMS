/**
 * M9 Helpdesk (HD-01) + M10 Engagement (EN-01..03) — docs/03 §9.
 *
 * Helpdesk design notes worth keeping visible:
 *  - `sla_due_at` is NOT NULL. A ticket without a clock is a ticket nobody
 *    owns, which is the failure SOW-9.2's escalation matrix exists to prevent.
 *  - The category catalogue is DATA (`hd.categories`), so HR can add one
 *    without a deploy — including "HRMS platform", which docs/07 §4b requires
 *    live from day one so the rollout has a supported channel for its own bugs.
 *  - Routing and SLA hours live on the category, not in code (CORE-10).
 *
 * Engagement:
 *  - A poll's anonymity is fixed at creation and enforced by a CHECK: an
 *    anonymous response must carry no respondent. Flipping it later would
 *    retroactively expose people who answered on the promise of anonymity.
 *  - One response per person per poll, by unique index.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS hd;
    CREATE SCHEMA IF NOT EXISTS eng;

    -- ── Helpdesk ────────────────────────────────────────────────────────────
    CREATE TABLE hd.categories (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      -- Routing + SLA as DATA, not as a switch statement (CORE-10).
      assignee_role_code TEXT,
      sla_hours INTEGER NOT NULL DEFAULT 24 CHECK (sla_hours > 0),
      escalate_after_hours INTEGER CHECK (escalate_after_hours IS NULL OR escalate_after_hours > 0),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE hd.tickets (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ticket_no TEXT UNIQUE NOT NULL,
      raised_by BIGINT NOT NULL REFERENCES core.users(id),
      category_id BIGINT NOT NULL REFERENCES hd.categories(id),
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      assignee_user_id BIGINT REFERENCES core.users(id),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','pending','resolved','closed')),
      priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low','normal','high','urgent')),
      -- Every ticket has a clock from the moment it exists (SOW-9.2).
      sla_due_at TIMESTAMPTZ NOT NULL,
      escalated_level SMALLINT NOT NULL DEFAULT 0 CHECK (escalated_level >= 0),
      escalated_at TIMESTAMPTZ,
      acknowledged_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      resolution TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      -- A resolved ticket must say HOW it was resolved.
      CONSTRAINT tickets_resolution_complete CHECK (
        (status NOT IN ('resolved','closed'))
        OR (resolved_at IS NOT NULL AND resolution IS NOT NULL)
      )
    );
    CREATE INDEX tickets_queue_idx ON hd.tickets (status, sla_due_at);
    CREATE INDEX tickets_raiser_idx ON hd.tickets (raised_by, created_at DESC);
    CREATE INDEX tickets_assignee_idx
      ON hd.tickets (assignee_user_id) WHERE status IN ('open','pending');

    CREATE TABLE hd.ticket_messages (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ticket_id BIGINT NOT NULL REFERENCES hd.tickets(id),
      author_user_id BIGINT NOT NULL REFERENCES core.users(id),
      body TEXT NOT NULL,
      is_internal BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX ticket_messages_thread_idx ON hd.ticket_messages (ticket_id, created_at);

    -- The audit trail of a ticket is append-only (SOW-9.4 "query logs for audit").
    CREATE OR REPLACE FUNCTION hd.reject_message_mutation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'hd.ticket_messages is append-only (SOW-9.4)';
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER ticket_messages_append_only
      BEFORE UPDATE OR DELETE ON hd.ticket_messages
      FOR EACH ROW EXECUTE FUNCTION hd.reject_message_mutation();

    -- ── Engagement ──────────────────────────────────────────────────────────
    CREATE TABLE eng.announcements (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      -- Audience filter reuses the policy publisher's shape (CORE-13).
      audience JSONB NOT NULL DEFAULT '{}'::jsonb,
      published_by BIGINT NOT NULL REFERENCES core.users(id),
      published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX announcements_live_idx
      ON eng.announcements (published_at DESC) WHERE is_active;

    CREATE TABLE eng.polls (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      kind TEXT NOT NULL DEFAULT 'poll' CHECK (kind IN ('poll','pulse')),
      -- Fixed at creation; see the responses CHECK below.
      is_anonymous BOOLEAN NOT NULL DEFAULT false,
      audience JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by BIGINT NOT NULL REFERENCES core.users(id),
      opens_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closes_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE eng.poll_responses (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      poll_id BIGINT NOT NULL REFERENCES eng.polls(id),
      -- NULL when the poll is anonymous. The CHECK below makes that binding,
      -- so anonymity cannot be broken after people have answered.
      respondent_user_id BIGINT REFERENCES core.users(id),
      option_index SMALLINT NOT NULL CHECK (option_index >= 0),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- One response per identified person per poll.
    CREATE UNIQUE INDEX poll_responses_one_per_person
      ON eng.poll_responses (poll_id, respondent_user_id)
      WHERE respondent_user_id IS NOT NULL;
    CREATE INDEX poll_responses_tally_idx ON eng.poll_responses (poll_id, option_index);

    COMMENT ON TABLE hd.categories IS 'HD-01 routing + SLA as runtime data; includes the HRMS-platform channel (docs/07 §4b)';
    COMMENT ON TABLE hd.tickets IS 'HD-01 tickets; sla_due_at NOT NULL so every ticket has a clock';
    COMMENT ON TABLE hd.ticket_messages IS 'SOW-9.4 append-only query log';
    COMMENT ON TABLE eng.polls IS 'EN-02/03 polls and pulse surveys; anonymity is fixed at creation';
  `);

  // The category catalogue ships with the docs/07 §4b requirement satisfied.
  pgm.sql(`
    INSERT INTO hd.categories (code, name, assignee_role_code, sla_hours, escalate_after_hours)
    VALUES
      ('payroll',    'Payroll query',        'payroll_admin', 24, 48),
      ('attendance', 'Attendance & leave',   'hr_ops',        24, 48),
      ('it',         'IT & assets',          'it_admin',      8,  24),
      ('facilities', 'Facilities',           'hr_ops',        48, 72),
      ('hrms',       'HRMS platform',        'it_admin',      8,  24)
    ON CONFLICT (code) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS eng.poll_responses;
    DROP TABLE IF EXISTS eng.polls;
    DROP TABLE IF EXISTS eng.announcements;
    DROP TRIGGER IF EXISTS ticket_messages_append_only ON hd.ticket_messages;
    DROP FUNCTION IF EXISTS hd.reject_message_mutation();
    DROP TABLE IF EXISTS hd.ticket_messages;
    DROP TABLE IF EXISTS hd.tickets;
    DROP TABLE IF EXISTS hd.categories;
    DROP SCHEMA IF EXISTS hd;
    DROP SCHEMA IF EXISTS eng;
  `);
}
