/**
 * Migration 0011 — Stage 1.6: absenteeism, letters, policies (ATT-10/11, CORE-09/13, LC-03 settings).
 * Spec: docs/03 §3 letters/policies · §4 absence_cases · docs/04 §1.5 · plans Stage 1.6.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- CORE-09 letters
    CREATE TABLE core.letter_templates (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      body_template TEXT NOT NULL,           -- merge fields as {{field_name}}
      merge_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER letter_templates_updated_at BEFORE UPDATE ON core.letter_templates
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.letters (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      template_code TEXT NOT NULL REFERENCES core.letter_templates(code),
      document_id BIGINT REFERENCES core.documents(id),
      body_rendered TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued'
        CHECK (status IN ('draft','pending_signature','issued')),
      issued_by BIGINT REFERENCES core.users(id),
      issued_at TIMESTAMPTZ,
      workflow_request_id BIGINT REFERENCES wf.requests(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER letters_updated_at BEFORE UPDATE ON core.letters
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX letters_emp_idx ON core.letters (employee_id, issued_at DESC);

    -- CORE-13 policies
    CREATE TABLE core.policies (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL,
      document_id BIGINT REFERENCES core.documents(id),
      body_summary TEXT,                    -- short text when no document yet
      effective_date DATE NOT NULL,
      requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
      is_active BOOLEAN NOT NULL DEFAULT true,
      audience JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER policies_updated_at BEFORE UPDATE ON core.policies
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.policy_acknowledgments (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      policy_id BIGINT NOT NULL REFERENCES core.policies(id),
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (policy_id, employee_id)
    );
    CREATE INDEX policy_ack_emp_idx ON core.policy_acknowledgments (employee_id);

    -- ATT-10 absence cases
    CREATE TABLE att.absence_cases (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      start_date DATE NOT NULL,
      days_absent SMALLINT NOT NULL DEFAULT 1,
      stage TEXT NOT NULL DEFAULT 'watch'
        CHECK (stage IN ('watch','show_cause','warning','termination_review','closed')),
      letter_id BIGINT REFERENCES core.letters(id),
      hr_owner_id BIGINT REFERENCES core.users(id),
      resolution TEXT CHECK (resolution IS NULL OR resolution IN ('returned','regularized','exited')),
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER absence_cases_updated_at BEFORE UPDATE ON att.absence_cases
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX absence_cases_open_idx ON att.absence_cases (stage, start_date)
      WHERE closed_at IS NULL;
    CREATE UNIQUE INDEX absence_cases_open_emp_uq ON att.absence_cases (employee_id)
      WHERE closed_at IS NULL;

    -- Seed letter templates (show_cause / warning for ATT-10)
    INSERT INTO core.letter_templates (code, name, body_template, merge_fields) VALUES
      ('show_cause', 'Show-cause notice',
       E'Dear {{employee_name}} ({{ecode}}),\\n\\nYou have been continuously absent without authorization from {{start_date}} ({{days_absent}} day(s)).\\nPlease submit a written explanation within 48 hours.\\n\\nHR — Rashmi Group',
       '["employee_name","ecode","start_date","days_absent"]'::jsonb),
      ('warning', 'Warning letter',
       E'Dear {{employee_name}} ({{ecode}}),\\n\\nThis is a formal warning regarding unauthorized absence from {{start_date}} ({{days_absent}} day(s)).\\nFurther absence may lead to disciplinary action.\\n\\nHR — Rashmi Group',
       '["employee_name","ecode","start_date","days_absent"]'::jsonb);

    -- Policy settings (docs/04 §8)
    INSERT INTO core.settings (key, value, value_type, description) VALUES
      ('att.absence_watch_days', '4', 'number', 'ATT-10: open absence_cases.watch after this many consecutive UAB days'),
      ('att.show_cause_days', '7', 'number', 'ATT-10: escalate case to show_cause after this many consecutive UAB days'),
      ('att.late_alert_minutes', '30', 'number', 'ATT-11: late alert threshold beyond grace (minutes)')
    ON CONFLICT (key) DO NOTHING;

    -- Default subscription matrix (data, not code — PP-26)
    INSERT INTO wf.event_subscriptions (event_code, recipient_kind, recipient_ref) VALUES
      ('daily.boarding_report', 'role', 'hr_ops'),
      ('daily.boarding_report', 'role', 'plant_head'),
      ('daily.boarding_report', 'role', 'ceo_cell'),
      ('attendance.uab', 'role', 'hr_ops'),
      ('attendance.absence_show_cause', 'role', 'hr_ops'),
      ('attendance.absence_show_cause', 'role', 'hr_head'),
      ('policy.ack_nag', 'role', 'hr_ops')
    ON CONFLICT DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS att.absence_cases;
    DROP TABLE IF EXISTS core.policy_acknowledgments;
    DROP TABLE IF EXISTS core.policies;
    DROP TABLE IF EXISTS core.letters;
    DROP TABLE IF EXISTS core.letter_templates;
    DELETE FROM core.settings WHERE key IN ('att.absence_watch_days','att.show_cause_days','att.late_alert_minutes');
    DELETE FROM wf.event_subscriptions WHERE event_code IN (
      'daily.boarding_report','attendance.uab','attendance.absence_show_cause','policy.ack_nag'
    );
  `);
}
