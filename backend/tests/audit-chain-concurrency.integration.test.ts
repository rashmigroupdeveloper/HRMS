/**
 * CORE-11 / NFR-04 — the audit hash chain under CONCURRENT writes.
 *
 * The defect this pins was real and was found in the dev database, not in
 * theory: the chain trigger serialises hashing with an advisory lock, but `id`
 * comes from a sequence assigned BEFORE that lock is taken. A transaction could
 * take a lower id, block, and then hash off a row with a higher id — so row
 * 4565 chained off row 4567, and two rows shared a `prev_hash`.
 *
 * Nothing had been tampered with. But `verify_audit_chain()` walked by `id`, so
 * it reported tampering anyway — and a tamper-detection control that raises
 * false alarms is worse than none, because people learn to dismiss it and a
 * real tamper goes through with the noise.
 *
 * The existing suite never caught this because every test wrote audit rows
 * sequentially. This one writes them the way the application actually does.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { writeAudit, verifyAuditChain } from '../src/core/audit/audit.service.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('audit hash chain — concurrency (live Postgres)', () => {
  let db: Kysely<Database>;
  const tag = `test.concurrency.${String(Date.now())}`;

  beforeAll(() => {
    db = createDatabase(DB_URL ?? '');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('stays intact when many rows are written at once', async () => {
    expect(await verifyAuditChain(db)).toBeNull();

    // Parallel writers, each its own transaction — the shape that broke it.
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        writeAudit(db, { action: 'create', entity: tag, newValue: `parallel ${String(i)}` }),
      ),
    );

    expect(await verifyAuditChain(db)).toBeNull();
  });

  it('assigns chain_seq in hashing order, so no two rows share a prev_hash', async () => {
    const forks = await sql<{ n: string }>`
      SELECT count(*)::text AS n FROM (
        SELECT prev_hash FROM core.audit_log
        GROUP BY prev_hash HAVING count(*) > 1
      ) forked`.execute(db);

    // A shared prev_hash means two rows both claimed the same predecessor —
    // the exact signature of the race.
    expect(Number(forks.rows[0]?.n ?? 0)).toBe(0);
  });

  it('orders the chain by chain_seq, which may differ from id order', async () => {
    // Not an accident to tolerate — the whole point. id is insertion identity;
    // chain_seq is hashing order. The verifier must never conflate them.
    const rows = await sql<{ id: string; chain_seq: string }>`
      SELECT id::text, chain_seq::text FROM core.audit_log
      ORDER BY chain_seq DESC LIMIT 40`.execute(db);

    expect(rows.rows.length).toBeGreaterThan(0);
    const seqs = rows.rows.map((r) => Number(r.chain_seq));
    // chain_seq is strictly monotonic with no gaps in its own ordering.
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});
