/**
 * Scale spike (P0-T41): push a 3k-employee swipe volume through the REAL
 * ingestion pipeline (partitioned table, idempotency key, watermark) and
 * measure. Usage: npx tsx scripts/scale-spike.ts [employees] [days]
 * Results recorded in docs/recon/scale-spike.md.
 */
import 'dotenv/config';
import { loadEnv } from '../src/core/config/env.js';
import { createDatabase } from '../src/core/db/database.js';
import { MockKentConnector } from '../src/modules/attendance/kent-connector.js';
import { ingestOnce } from '../src/modules/attendance/ingest.service.js';
import { sql } from 'kysely';

const EMPLOYEES = Number(process.argv[2] ?? 3000);
const DAYS = Number(process.argv[3] ?? 14);
const SOURCE = 'scale-spike';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);
  const employeeNos = Array.from({ length: EMPLOYEES }, (_, i) => `SCL${String(i + 1).padStart(6, '0')}`);

  try {
    await db.deleteFrom('att.ingest_watermarks').where('source', '=', SOURCE).execute();

    let totalFetched = 0;
    let totalInserted = 0;
    const t0 = performance.now();

    for (let d = 0; d < DAYS; d++) {
      const day = new Date(Date.UTC(2026, 5, 1 + d)); // June 2026, one partition
      const connector = new MockKentConnector({ employeeNos, day, seed: 100 + d });
      const result = await ingestOnce(db, connector, SOURCE);
      totalFetched += result.fetched;
      totalInserted += result.inserted;
      process.stdout.write(`day ${d + 1}/${DAYS}: +${result.inserted}\n`);
    }
    const ingestMs = performance.now() - t0;

    // Replay day 1 with a reset watermark — idempotency under full duplication.
    await db.deleteFrom('att.ingest_watermarks').where('source', '=', SOURCE).execute();
    const t1 = performance.now();
    const replay = await ingestOnce(db, new MockKentConnector({ employeeNos, day: new Date(Date.UTC(2026, 5, 1)), seed: 100 }), SOURCE);
    const replayMs = performance.now() - t1;

    // The muster-shaped aggregate: FILO per employee per day across the window.
    const t2 = performance.now();
    const agg = await sql<{ n: string }>`
      SELECT COUNT(*) AS n FROM (
        SELECT employee_no, swipe_ts::date AS d, MIN(swipe_ts), MAX(swipe_ts)
        FROM att.swipe_events
        WHERE source = ${SOURCE}
        GROUP BY employee_no, swipe_ts::date
      ) x
    `.execute(db);
    const aggMs = performance.now() - t2;

    console.log('\n=== SCALE SPIKE RESULTS ===');
    console.log(`employees=${EMPLOYEES} days=${DAYS}`);
    console.log(`ingest: ${totalInserted} rows in ${(ingestMs / 1000).toFixed(1)}s → ${Math.round(totalInserted / (ingestMs / 1000))} rows/s`);
    console.log(`replay of day 1 (full dup): inserted=${replay.inserted} (must be 0) in ${(replayMs / 1000).toFixed(2)}s`);
    console.log(`FILO aggregate over ${totalFetched} swipes → ${agg.rows[0]?.n ?? '?'} employee-days in ${(aggMs / 1000).toFixed(2)}s`);
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
