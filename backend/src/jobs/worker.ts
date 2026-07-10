/**
 * hrms-worker — the background-job process (docs/02 §2 topology: api ×N,
 * worker ×M, scheduler). pg-boss keeps queue state in Postgres (schema
 * `pgboss`), so jobs survive restarts and retries are built in.
 *
 * Jobs registered here (docs/02 §6 catalog grows phase by phase):
 *   kent-sync — every 5 minutes — ATT-01/02: swipe ingestion + silent-door alerting
 *
 * Run: npm run worker
 */
import 'dotenv/config';
import { PgBoss } from 'pg-boss';
import { loadEnv } from '../core/config/env.js';
import { createDatabase } from '../core/db/database.js';
import { logger } from '../core/logger.js';
import { runKentSync } from '../modules/attendance/index.js';

const KENT_SYNC_QUEUE = 'kent-sync';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);

  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on('error', (err: Error) => {
    logger.error(err, 'pg-boss error');
  });

  await boss.start();
  await boss.createQueue(KENT_SYNC_QUEUE);

  // Every 5 minutes (ATT-01: ≤5 min lag). singletonKey via schedule = one
  // pending run at a time; a slow cycle never stampedes the next.
  await boss.schedule(KENT_SYNC_QUEUE, '*/5 * * * *');

  await boss.work(KENT_SYNC_QUEUE, async () => {
    await runKentSync(db);
  });

  // One immediate cycle on boot so a fresh environment has data instantly.
  await boss.send(KENT_SYNC_QUEUE, {});

  logger.info({ queues: [KENT_SYNC_QUEUE] }, 'hrms-worker running');
}

main().catch((err: unknown) => {
  logger.error(err, 'hrms-worker failed to start');
  process.exitCode = 1;
});
