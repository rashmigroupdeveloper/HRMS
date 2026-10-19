/**
 * REQ-003 / RQ-JF-014: EPF Form 11 facts the PF engine needs for EPS membership.
 * The joining job captures them (form / API); payroll reads them (statutory/eps-eligibility.ts).
 * All columns default to "not captured": an employee without Form 11 data keeps EPS exactly as before
 * (the client register shows EPS for the whole current cohort). HR corrects individuals from Form 11 /
 * previous PF records (client decision CD-P8).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    SET lock_timeout = '5s';
    ALTER TABLE core.employees
      ADD COLUMN epf_member_before_sep2014 boolean,
      ADD COLUMN epf_first_enrolled_on date,
      ADD COLUMN epf_first_wages numeric(12,2) CHECK (epf_first_wages IS NULL OR epf_first_wages >= 0),
      ADD COLUMN international_worker boolean NOT NULL DEFAULT false,
      ADD COLUMN eps_eligible boolean;
    COMMENT ON COLUMN core.employees.eps_eligible IS 'HR-confirmed EPS membership (Form 11); NULL = derive from enrolment date and first PF wages';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.employees
      DROP COLUMN eps_eligible, DROP COLUMN international_worker, DROP COLUMN epf_first_wages,
      DROP COLUMN epf_first_enrolled_on, DROP COLUMN epf_member_before_sep2014;
  `);
}
