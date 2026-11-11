/** CLM-04/PAY-03: one reimbursement reservation maps to one payroll input. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
 ALTER TABLE pay.inputs ADD COLUMN claim_id BIGINT REFERENCES pay.claims(id);
 CREATE UNIQUE INDEX inputs_claim_unique ON pay.inputs(claim_id) WHERE claim_id IS NOT NULL;`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
}
