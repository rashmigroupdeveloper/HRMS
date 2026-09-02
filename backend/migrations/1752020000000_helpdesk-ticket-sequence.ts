/**
 * Ticket numbers must come from a SEQUENCE, not from COUNT(*).
 *
 * The first implementation derived the next number from `COUNT(*)` of that
 * year's tickets. That is wrong in two ways that both produce a duplicate-key
 * failure on a UNIQUE column:
 *   - delete any ticket and the count goes BACKWARDS, so the next insert
 *     re-issues a number that already exists;
 *   - two concurrent inserts read the same count and race.
 *
 * A sequence is atomic, gap-tolerant and never reused — which is exactly what
 * a human-quotable reference ("I raised HD-2026-000014") needs to be.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE SEQUENCE IF NOT EXISTS hd.ticket_no_seq AS BIGINT START 1;

    -- Start above any number already issued so existing tickets keep theirs.
    SELECT setval(
      'hd.ticket_no_seq',
      GREATEST(
        (SELECT COALESCE(MAX(NULLIF(regexp_replace(ticket_no, '^HD-\\d{4}-', ''), '')::BIGINT), 0)
           FROM hd.tickets),
        1
      )
    );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP SEQUENCE IF EXISTS hd.ticket_no_seq;`);
}
