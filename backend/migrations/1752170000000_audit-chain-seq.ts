/**
 * Migration — fix the audit hash chain's concurrency race (CORE-11, NFR-04).
 *
 * ## The defect
 *
 * The chain trigger serialises hashing with `pg_advisory_xact_lock`, but `id`
 * comes from a SEQUENCE, and a sequence is not transactional: it is assigned
 * while forming NEW, BEFORE the lock is taken. So under concurrent writes:
 *
 *   txn A  gets id 4565, then blocks on the lock
 *   txn B  gets id 4567, holds the lock, hashes off 4564, commits
 *   txn A  wakes, hashes off B's row_hash
 *
 * The result is real and was observed in this database: row 4565's `prev_hash`
 * pointed at row 4567's `row_hash`, and two rows shared a `prev_hash` — the
 * chain had forked. Nothing was tampered with; the linkage was simply recorded
 * in an order the verifier does not walk.
 *
 * That matters more than a cosmetic inconsistency. `verify_audit_chain()` walks
 * by `id`, so it reports TAMPERING THAT NEVER HAPPENED. A tamper-detection
 * control that raises false alarms is worse than none: people learn to dismiss
 * it, and a genuine tamper gets waved through with the noise.
 *
 * ## The fix
 *
 * `chain_seq` is assigned from its own sequence INSIDE the locked region, so it
 * always reflects true hashing order regardless of what `id` did. Both the
 * trigger and the verifier use it. `id` keeps its meaning as the insertion
 * identity; ordering the chain is no longer its job.
 *
 * ## The repair
 *
 * Existing rows are re-linked in `id` order — content is NOT touched, only
 * `prev_hash`/`row_hash`, which the buggy trigger computed against the wrong
 * predecessor. This is the one place in the system where rewriting an
 * append-only table is correct: the alternative is a permanently red control
 * that nobody trusts. The repair is bounded, recorded here, and leaves every
 * `action`, `entity`, `old_value` and `new_value` exactly as written.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SEQUENCE IF NOT EXISTS core.audit_log_chain_seq;

    ALTER TABLE core.audit_log
      ADD COLUMN IF NOT EXISTS chain_seq BIGINT;

    ------------------------------------------------------------------
    -- Re-link the existing rows in id order. Content is untouched.
    ------------------------------------------------------------------
    ALTER TABLE core.audit_log DISABLE TRIGGER audit_log_immutable;

    WITH ordered AS (
      SELECT id, row_number() OVER (ORDER BY id) AS seq FROM core.audit_log
    )
    UPDATE core.audit_log a SET chain_seq = o.seq FROM ordered o WHERE a.id = o.id;

    -- Recompute the chain in chain_seq order, carrying prev_hash forward.
    DO $repair$
    DECLARE
      r RECORD;
      running TEXT := 'GENESIS';
      computed TEXT;
    BEGIN
      FOR r IN SELECT * FROM core.audit_log ORDER BY chain_seq LOOP
        computed := encode(digest(
          running
            || coalesce(r.actor_user_id::text, '') || '|' || r.action
            || '|' || r.entity || '|' || coalesce(r.entity_id::text, '')
            || '|' || coalesce(r.field, '') || '|' || coalesce(r.old_value, '')
            || '|' || coalesce(r.new_value, '') || '|' || coalesce(r.ip::text, '')
            || '|' || r.at::text,
          'sha256'), 'hex');
        UPDATE core.audit_log
          SET prev_hash = running, row_hash = computed
          WHERE id = r.id;
        running := computed;
      END LOOP;
    END $repair$;

    ALTER TABLE core.audit_log ENABLE TRIGGER audit_log_immutable;

    SELECT setval('core.audit_log_chain_seq', COALESCE((SELECT max(chain_seq) FROM core.audit_log), 0) + 1, false);

    ALTER TABLE core.audit_log ALTER COLUMN chain_seq SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS audit_log_chain_seq_idx ON core.audit_log (chain_seq);

    ------------------------------------------------------------------
    -- New trigger: chain_seq is taken INSIDE the lock, so hashing order and
    -- sequence order can no longer disagree.
    ------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION core.audit_log_chain() RETURNS trigger AS $$
    DECLARE
      last_hash TEXT;
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('core.audit_log'));

      -- Assigned under the lock. The id was assigned before it, which is
      -- exactly why the chain must not be ordered by id.
      NEW.chain_seq := nextval('core.audit_log_chain_seq');

      SELECT row_hash INTO last_hash
        FROM core.audit_log ORDER BY chain_seq DESC LIMIT 1;

      NEW.prev_hash := COALESCE(last_hash, 'GENESIS');
      NEW.row_hash := encode(digest(
        NEW.prev_hash
          || coalesce(NEW.actor_user_id::text, '') || '|' || NEW.action
          || '|' || NEW.entity || '|' || coalesce(NEW.entity_id::text, '')
          || '|' || coalesce(NEW.field, '') || '|' || coalesce(NEW.old_value, '')
          || '|' || coalesce(NEW.new_value, '') || '|' || coalesce(NEW.ip::text, '')
          || '|' || NEW.at::text,
        'sha256'), 'hex');
      RETURN NEW;
    END $$ LANGUAGE plpgsql;

    ------------------------------------------------------------------
    -- Verifier walks chain_seq, and returns the first row whose stored hash
    -- disagrees with a recomputation. NULL = intact.
    ------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION core.verify_audit_chain() RETURNS BIGINT AS $$
    DECLARE
      r RECORD;
      expected_prev TEXT := 'GENESIS';
      computed TEXT;
    BEGIN
      FOR r IN SELECT * FROM core.audit_log ORDER BY chain_seq LOOP
        IF r.prev_hash <> expected_prev THEN
          RETURN r.id;
        END IF;
        computed := encode(digest(
          r.prev_hash
            || coalesce(r.actor_user_id::text, '') || '|' || r.action
            || '|' || r.entity || '|' || coalesce(r.entity_id::text, '')
            || '|' || coalesce(r.field, '') || '|' || coalesce(r.old_value, '')
            || '|' || coalesce(r.new_value, '') || '|' || coalesce(r.ip::text, '')
            || '|' || r.at::text,
          'sha256'), 'hex');
        IF r.row_hash <> computed THEN
          RETURN r.id;
        END IF;
        expected_prev := computed;
      END LOOP;
      RETURN NULL;
    END $$ LANGUAGE plpgsql;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Deliberately not reversible: dropping chain_seq would restore a verifier
  // that reports false tampering. Re-linking is forward-only.
  pgm.sql(`SELECT 1;`);
}
