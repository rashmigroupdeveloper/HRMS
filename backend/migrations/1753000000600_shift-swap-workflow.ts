/** SHF-07: default manager chain; preserve runtime edits and vacancy holds. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    INSERT INTO wf.definitions(code,name,steps) VALUES
      ('shift_swap','Shift swap / bid',
       '[{"step":1,"approver":"reporting_manager","slaHours":48,"onBreach":"escalate"}]'::jsonb)
      ON CONFLICT(code) DO NOTHING;
  `);
}
export function down(pgm: MigrationBuilder): void {
  // Retain runtime configuration/history; older builds simply expose no swap API.
  pgm.sql(`SET lock_timeout = '5s';`);
}
