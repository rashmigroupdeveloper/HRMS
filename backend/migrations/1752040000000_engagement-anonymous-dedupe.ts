/**
 * EN-02/03 — anonymous polls need ballot-stuffing protection.
 *
 * The shipped `eng.poll_responses` deduped with a partial unique index on
 * `respondent_user_id`, which is NULL for anonymous polls — so an anonymous
 * poll could be voted in an unlimited number of times and its result was
 * worthless. docs/03 §9 specifies the fix for exactly this: a SALTED
 * `respondent_hash` that dedupes WITHOUT storing identity.
 *
 * The app derives the hash with an HMAC keyed on the application secret, so a
 * reader of the database alone cannot map a response back to a person.
 * The CHECK below makes the two modes mutually exclusive and mandatory, so a
 * response can never be written with neither (undedupable) or both (a
 * de-anonymisation side channel).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE eng.poll_responses ADD COLUMN respondent_hash TEXT;

    -- Exactly one identity mode per response: named XOR anonymous-hash.
    ALTER TABLE eng.poll_responses
      ADD CONSTRAINT poll_responses_identity_mode
      CHECK ((respondent_user_id IS NULL) <> (respondent_hash IS NULL));

    -- One response per person on an anonymous poll, without knowing who.
    CREATE UNIQUE INDEX poll_responses_one_per_anon
      ON eng.poll_responses (poll_id, respondent_hash)
      WHERE respondent_hash IS NOT NULL;

    COMMENT ON COLUMN eng.poll_responses.respondent_hash IS
      'EN-02/03 salted HMAC of (poll, user) — dedupes anonymous responses without storing identity (docs/03 §9)';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    DROP INDEX IF EXISTS eng.poll_responses_one_per_anon;
    ALTER TABLE eng.poll_responses DROP CONSTRAINT IF EXISTS poll_responses_identity_mode;
    ALTER TABLE eng.poll_responses DROP COLUMN IF EXISTS respondent_hash;
  `);
}
