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
import { closeWeek, drainRecomputeQueue, runKentSync } from '../modules/attendance/index.js';
import { enqueueEvent } from '../modules/notifications/index.js';

const KENT_SYNC_QUEUE = 'kent-sync';
const RECOMPUTE_QUEUE = 'attendance-recompute';
const WEEK_CLOSE_QUEUE = 'attendance-week-close';
const ROSTER_REMINDER_QUEUE = 'roster-reminder';

/** Monday of the week BEFORE the one containing `d` (the week being closed). */
function previousWeekStartIso(d: Date): string {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const dow = (day.getDay() + 6) % 7; // Mon=0
  day.setDate(day.getDate() - dow - 7);
  return day.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);

  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on('error', (err: Error) => {
    logger.error(err, 'pg-boss error');
  });

  await boss.start();
  for (const q of [KENT_SYNC_QUEUE, RECOMPUTE_QUEUE, WEEK_CLOSE_QUEUE, ROSTER_REMINDER_QUEUE]) {
    await boss.createQueue(q);
  }

  // Every 5 minutes (ATT-01: ≤5 min lag). One pending run at a time.
  await boss.schedule(KENT_SYNC_QUEUE, '*/5 * * * *');
  await boss.work(KENT_SYNC_QUEUE, async () => {
    await runKentSync(db);
  });

  // Safety-net drain each minute — catches roster edits between sync cycles (ATT-03).
  await boss.schedule(RECOMPUTE_QUEUE, '* * * * *');
  await boss.work(RECOMPUTE_QUEUE, async () => {
    await drainRecomputeQueue(db);
  });

  // Week-off eligibility for the JUST-FINISHED week, Monday 02:00 IST (ATT-09).
  await boss.schedule(WEEK_CLOSE_QUEUE, '0 2 * * 1');
  await boss.work(WEEK_CLOSE_QUEUE, async () => {
    await closeWeek(db, previousWeekStartIso(new Date()));
  });

  // Monthly roster deadline nag on the 5th, 09:00 (ATT-04 / Agreement 4.1a) —
  // recipients live in wf.event_subscriptions ('attendance.roster_deadline').
  await boss.schedule(ROSTER_REMINDER_QUEUE, '0 9 5 * *');
  await boss.work(ROSTER_REMINDER_QUEUE, async () => {
    await enqueueEvent(db, 'attendance.roster_deadline', 'roster_deadline', {
      month: new Date().toISOString().slice(0, 7),
    });
  });

  // One immediate cycle on boot so a fresh environment has data instantly.
  await boss.send(KENT_SYNC_QUEUE, {});

  logger.info(
    { queues: [KENT_SYNC_QUEUE, RECOMPUTE_QUEUE, WEEK_CLOSE_QUEUE, ROSTER_REMINDER_QUEUE] },
    'hrms-worker running',
  );
}

main().catch((err: unknown) => {
  logger.error(err, 'hrms-worker failed to start');
  process.exitCode = 1;
});
