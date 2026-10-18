/**
 * Owner bar #3 (migrations from an empty DB): stage-17 inserted
 * att.manager_approval_required_for_lock = false before the settings seed, whose
 * insert is ON CONFLICT DO NOTHING, so a fresh install kept `false`. The month-lock
 * checklist treats `false` as an invalid policy ("Mandatory manager approval is
 * disabled; repair the policy configuration"), so no month could ever be locked and
 * payroll could never run on a new install. `true` is the only valid value.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE core.settings
    SET value = 'true'::jsonb,
        description = 'ATT-12: managers must approve team attendance before month lock'
    WHERE key = 'att.manager_approval_required_for_lock' AND value <> 'true'::jsonb;
  `);
}

export function down(): void {
  // Intentionally irreversible: `false` blocks every month lock.
}
