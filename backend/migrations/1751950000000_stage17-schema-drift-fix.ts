/**
 * Stage 1.7 hygiene — close schema drift that broke Stage 1.6 integration tests:
 * 1. `core.policies.created_by` is in types + policies.service but never migrated.
 * 2. Live `letter_templates` merge_fields for show_cause/warning diverged from the
 *    seeded bodies + absence.service extraFields (absence_start_date / warning_reason).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE core.policies
      ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES core.users(id);

    UPDATE core.letter_templates
       SET body_template = $tpl$Dear {{employee_name}} ({{ecode}}),

You have been absent from duty without authorisation since {{absence_start_date}} ({{days_absent}} days). You are directed to explain in writing within {{response_days}} days why disciplinary action should not be taken against you.

Failing a satisfactory reply, the management will proceed as per the standing orders.$tpl$,
           merge_fields = '["employee_name","ecode","absence_start_date","days_absent","response_days"]'::jsonb,
           updated_at = now()
     WHERE code = 'show_cause';

    UPDATE core.letter_templates
       SET body_template = $tpl$Dear {{employee_name}} ({{ecode}}),

This letter serves as a formal warning regarding: {{warning_reason}}.

Any recurrence will invite stricter disciplinary action.$tpl$,
           merge_fields = '["employee_name","ecode","warning_reason"]'::jsonb,
           updated_at = now()
     WHERE code = 'warning';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.policies DROP COLUMN IF EXISTS created_by;
  `);
}
