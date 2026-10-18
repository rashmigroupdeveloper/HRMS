/** RQ-CORE-025: ESS family / nominee changes route to HR ops before the master changes. */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    INSERT INTO wf.definitions (code, name, steps)
    VALUES ('family_update', 'Family / Nominee Update', '[{"step":1,"approver":"role:hr_ops","slaHours":72,"onBreach":"escalate"}]'::jsonb)
    ON CONFLICT (code) DO NOTHING;
    CREATE INDEX IF NOT EXISTS profile_change_requests_emp_status ON core.profile_change_requests (employee_id, field, status);
    CREATE UNIQUE INDEX IF NOT EXISTS profile_change_requests_wf_uq ON core.profile_change_requests (workflow_request_id) WHERE workflow_request_id IS NOT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS core.profile_change_requests_wf_uq;
    DROP INDEX IF EXISTS core.profile_change_requests_emp_status;
    DELETE FROM wf.definitions d WHERE d.code = 'family_update' AND NOT EXISTS (SELECT 1 FROM wf.requests r WHERE r.definition_code = d.code);
  `);
}
