/**
 * Migration 0011 — Stage 1.6: absenteeism cases, letters, policy repository
 * (docs/03 §3/§4, ATT-10/11, CORE-09, CORE-13).
 *
 * Delta vs docs/03 (surfaced in plans/): letter templates carry an inline
 * `body_template` TEXT with {{merge_fields}} for now — the real HR docx
 * templates are an external input (like Kent access); the schema keeps
 * `body_docx_document_id` so they swap in without a further migration.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- CORE-09: templates are runtime DATA (editable via the letters.issue API)
    CREATE TABLE core.letter_templates (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      body_template TEXT NOT NULL,           -- {{merge_field}} placeholders
      body_docx_document_id BIGINT REFERENCES core.documents(id), -- real HR docx lands here
      merge_fields JSONB NOT NULL,           -- declared fields, validated at render time
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER letter_templates_updated_at BEFORE UPDATE ON core.letter_templates
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- Issued letters: NULL issued_at = draft awaiting the signature chain (PP-14)
    CREATE TABLE core.letters (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      template_code TEXT NOT NULL,
      document_id BIGINT NOT NULL REFERENCES core.documents(id),
      issued_by BIGINT REFERENCES core.users(id),
      issued_at TIMESTAMPTZ,
      workflow_request_id BIGINT REFERENCES wf.requests(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER letters_updated_at BEFORE UPDATE ON core.letters
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX letters_emp_idx ON core.letters (employee_id);
    CREATE UNIQUE INDEX letters_wf_idx ON core.letters (workflow_request_id)
      WHERE workflow_request_id IS NOT NULL;

    -- ATT-10: the continuous-absence engine. ONE open case per employee.
    CREATE TABLE att.absence_cases (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      start_date DATE NOT NULL,
      days_absent SMALLINT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'watch'
        CHECK (stage IN ('watch','show_cause','warning','termination_review')),
      letter_id BIGINT REFERENCES core.letters(id),
      hr_owner_id BIGINT REFERENCES core.users(id),
      resolution TEXT CHECK (resolution IN ('returned','regularized','exited')),
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK ((resolution IS NULL) = (closed_at IS NULL))
    );
    CREATE TRIGGER absence_cases_updated_at BEFORE UPDATE ON att.absence_cases
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE UNIQUE INDEX absence_cases_one_open ON att.absence_cases (employee_id)
      WHERE closed_at IS NULL;

    -- CORE-13: policy repository + real-time acknowledgment tracking
    CREATE TABLE core.policies (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL,
      document_id BIGINT NOT NULL REFERENCES core.documents(id),
      effective_date DATE NOT NULL,
      requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
      audience JSONB,                        -- optional {categories, departmentIds, locationIds}
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by BIGINT REFERENCES core.users(id),
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
      UNIQUE (policy_id, employee_id)
    );

    -- CORE-09 template seed — starter bodies; HR edits them at runtime.
    INSERT INTO core.letter_templates (code, name, body_template, merge_fields) VALUES
      ('appointment', 'Appointment Letter', $tpl$Dear {{employee_name}},

We are pleased to appoint you as {{designation}} at {{company}} effective {{doj}}. Your employee code is {{ecode}}.

Terms and conditions of employment are enclosed.$tpl$,
       '["employee_name","ecode","designation","company","doj"]'),
      ('confirmation', 'Confirmation Letter', $tpl$Dear {{employee_name}} ({{ecode}}),

Further to your probation review, we are pleased to confirm your services as {{designation}} with effect from {{confirmation_date}}.$tpl$,
       '["employee_name","ecode","designation","confirmation_date"]'),
      ('experience', 'Experience Certificate', $tpl$TO WHOMSOEVER IT MAY CONCERN

This is to certify that {{employee_name}} ({{ecode}}) was employed with us as {{designation}} from {{doj}} to {{dol}}.$tpl$,
       '["employee_name","ecode","designation","doj","dol"]'),
      ('relieving', 'Relieving Letter', $tpl$Dear {{employee_name}} ({{ecode}}),

This is to confirm that you have been relieved from your duties as {{designation}} at the close of business on {{dol}}.$tpl$,
       '["employee_name","ecode","designation","dol"]'),
      ('salary_certificate', 'Salary Certificate', $tpl$TO WHOMSOEVER IT MAY CONCERN

This is to certify that {{employee_name}} ({{ecode}}), {{designation}}, draws a gross monthly salary of {{monthly_gross}}.$tpl$,
       '["employee_name","ecode","designation","monthly_gross"]'),
      ('show_cause', 'Show-Cause Notice (Continuous Absence)', $tpl$Dear {{employee_name}} ({{ecode}}),

You have been absent from duty without authorisation since {{absence_start_date}} ({{days_absent}} days). You are directed to explain in writing within {{response_days}} days why disciplinary action should not be taken against you.

Failing a satisfactory reply, the management will proceed as per the standing orders.$tpl$,
       '["employee_name","ecode","absence_start_date","days_absent","response_days"]'),
      ('warning', 'Warning Letter', $tpl$Dear {{employee_name}} ({{ecode}}),

This letter serves as a formal warning regarding: {{warning_reason}}.

Any recurrence will invite stricter disciplinary action.$tpl$,
       '["employee_name","ecode","warning_reason"]');
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS core.policy_acknowledgments;
    DROP TABLE IF EXISTS core.policies;
    DROP TABLE IF EXISTS att.absence_cases;
    DROP TABLE IF EXISTS core.letters;
    DROP TABLE IF EXISTS core.letter_templates;
  `);
}
