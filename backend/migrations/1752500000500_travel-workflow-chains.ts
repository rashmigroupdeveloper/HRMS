/**
 * Migration — Travel & Expense Approval Chains Parity (TE-01..12, Live EMS alignment).
 *
 * Implements:
 * 1. te.trips.destination_region column ('domestic', 'sea', 'africa', etc.)
 * 2. Updates travel_trip, travel_claim, travel_advance_domestic approval chains
 *    to reflect the multi-stage EMS routing:
 *    - SEA Manager (conditional step 1 for South-East Asia)
 *    - Reporting Manager (step 2)
 *    - Head of Department (step 3)
 *    - Africa Reviewer (conditional step 4 for Africa)
 *    - Travel/Org Admin (step 5 settlement/final approval)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE te.trips ADD COLUMN IF NOT EXISTS destination_region TEXT NOT NULL DEFAULT 'domestic'
      CHECK (destination_region IN ('domestic', 'sea', 'africa', 'middle_east', 'europe', 'americas', 'other'));

    UPDATE wf.definitions
       SET steps = '[{"step":1,"approver":"travel_sea_manager","slaHours":48,"onBreach":"escalate"},{"step":2,"approver":"reporting_manager","slaHours":48,"onBreach":"escalate"},{"step":3,"approver":"department_head","slaHours":48,"onBreach":"escalate"},{"step":4,"approver":"travel_africa_reviewer","slaHours":48,"onBreach":"escalate"},{"step":5,"approver":"travel_admin","slaHours":48,"onBreach":"escalate"}]'::jsonb
     WHERE code = 'travel_trip';

    UPDATE wf.definitions
       SET steps = '[{"step":1,"approver":"travel_sea_manager","slaHours":48,"onBreach":"escalate"},{"step":2,"approver":"reporting_manager","slaHours":48,"onBreach":"escalate"},{"step":3,"approver":"department_head","slaHours":48,"onBreach":"escalate"},{"step":4,"approver":"travel_africa_reviewer","slaHours":48,"onBreach":"escalate"},{"step":5,"approver":"travel_admin","slaHours":48,"onBreach":"escalate"}]'::jsonb
     WHERE code = 'travel_claim';

    UPDATE wf.definitions
       SET steps = '[{"step":1,"approver":"reporting_manager","slaHours":48,"onBreach":"escalate"},{"step":2,"approver":"department_head","slaHours":48,"onBreach":"escalate"},{"step":3,"approver":"travel_admin","slaHours":48,"onBreach":"escalate"}]'::jsonb
     WHERE code = 'travel_advance_domestic';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE te.trips DROP COLUMN IF EXISTS destination_region;

    UPDATE wf.definitions
       SET steps = '[{"step":1,"approver":"reporting_manager","slaHours":48,"onBreach":"escalate"}]'::jsonb
     WHERE code = 'travel_trip';

    UPDATE wf.definitions
       SET steps = '[{"step":1,"approver":"reporting_manager","slaHours":72,"onBreach":"escalate"}]'::jsonb
     WHERE code = 'travel_claim';

    UPDATE wf.definitions
       SET steps = '[{"step":1,"approver":"reporting_manager","slaHours":48,"onBreach":"escalate"},{"step":2,"approver":"department_head","slaHours":48,"onBreach":"escalate"}]'::jsonb
     WHERE code = 'travel_advance_domestic';
  `);
}
