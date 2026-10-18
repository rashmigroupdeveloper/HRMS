/**
 * Domain approval chains that the services now route through (P-23, SOW ATS):
 * trip, travel claim, manpower requisition and offer/LOI approval. Inserted
 * only when absent so runtime edits made through the definitions API win.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

const CHAINS = [
  ['travel_trip', 'Travel Trip Approval', [{ step: 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'escalate' }]],
  ['travel_claim', 'Travel Expense Claim', [{ step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' }]],
  ['requisition_approval', 'Manpower Requisition', [
    { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
    { step: 2, approver: 'role:hr_head', slaHours: 72, onBreach: 'escalate' },
  ]],
  ['offer_approval', 'Offer / LOI Approval', [
    { step: 1, approver: 'role:hr_head', slaHours: 48, onBreach: 'escalate' },
    { step: 2, approver: 'role:ceo_cell', slaHours: 72, onBreach: 'escalate' },
  ]],
] as const;

export function up(pgm: MigrationBuilder): void {
  for (const [code, name, steps] of CHAINS) {
    pgm.sql(`INSERT INTO wf.definitions (code, name, steps) VALUES ('${code}', '${name.replace(/'/g, "''")}', '${JSON.stringify(steps)}'::jsonb) ON CONFLICT (code) DO NOTHING`);
  }
}

export function down(pgm: MigrationBuilder): void {
  const codes = CHAINS.map(([code]) => `'${code}'`).join(', ');
  pgm.sql(`DELETE FROM wf.definitions d WHERE d.code IN (${codes}) AND NOT EXISTS (SELECT 1 FROM wf.requests r WHERE r.definition_code = d.code)`);
}
