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
import {
  closeWeek,
  drainRecomputeQueue,
  lapseExpiredOvertime,
  registerAttendanceWorkflowHooks,
  runKentSync,
  sendOvertimeSummaries,
} from '../modules/attendance/index.js';
import { registerLeaveWorkflowHooks, runCompOffExpiry, runMonthlyAccrual } from '../modules/leave/index.js';
import { enqueueEvent } from '../modules/notifications/index.js';
import { runEscalations } from '../modules/workflows/index.js';
import { istDateString, previousWeekStartIso } from '../core/dates.js';

const KENT_SYNC_QUEUE = 'kent-sync';
const RECOMPUTE_QUEUE = 'attendance-recompute';
const WEEK_CLOSE_QUEUE = 'attendance-week-close';
const ROSTER_REMINDER_QUEUE = 'roster-reminder';
const WF_ESCALATION_QUEUE = 'workflow-escalation';
const OT_SUMMARY_QUEUE = 'ot-daily-summary';
const LEAVE_ACCRUAL_QUEUE = 'leave-accrual';
const COMP_OFF_EXPIRY_QUEUE = 'comp-off-expiry';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);

  // The escalation sweep can LAPSE an overtime request (ATT-08) and finalize
  // leave chains — the hooks that mirror finals onto domain rows must be
  // registered in this process too.
  registerAttendanceWorkflowHooks();
  registerLeaveWorkflowHooks();

  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on('error', (err: Error) => {
    logger.error(err, 'pg-boss error');
  });

  await boss.start();
  const queues = [
    KENT_SYNC_QUEUE,
    RECOMPUTE_QUEUE,
    WEEK_CLOSE_QUEUE,
    ROSTER_REMINDER_QUEUE,
    WF_ESCALATION_QUEUE,
    OT_SUMMARY_QUEUE,
    LEAVE_ACCRUAL_QUEUE,
    COMP_OFF_EXPIRY_QUEUE,
  ];
  for (const q of queues) {
    await boss.createQueue(q);
  }

  // LV-02: monthly credit on the 1st, 00:05 IST (= 18:35 UTC the evening
  // before). Scheduled daily with an IST-date guard — the DB's one-accrual-
  // per-month unique index makes any extra run a no-op anyway.
  await boss.schedule(LEAVE_ACCRUAL_QUEUE, '35 18 * * *');
  await boss.work(LEAVE_ACCRUAL_QUEUE, async () => {
    if (istDateString().endsWith('-01')) await runMonthlyAccrual(db);
  });

  // LV-04: expired comp-off credits lapse daily at 00:30 IST.
  await boss.schedule(COMP_OFF_EXPIRY_QUEUE, '0 19 * * *');
  await boss.work(COMP_OFF_EXPIRY_QUEUE, async () => {
    await runCompOffExpiry(db);
  });

  // Approval SLA sweep, hourly (WF-03): breach → escalate/auto-reject/lapse/
  // auto-approve. The companion sweep lapses workflow-less OT entries (ATT-08).
  await boss.schedule(WF_ESCALATION_QUEUE, '0 * * * *');
  await boss.work(WF_ESCALATION_QUEUE, async () => {
    await runEscalations(db);
    await lapseExpiredOvertime(db);
  });

  // Manager OT digest at 18:00 IST = 12:30 UTC (PP-19: decide before it lapses).
  await boss.schedule(OT_SUMMARY_QUEUE, '30 12 * * *');
  await boss.work(OT_SUMMARY_QUEUE, async () => {
    await sendOvertimeSummaries(db);
  });

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

  logger.info({ queues }, 'hrms-worker running');
}

main().catch((err: unknown) => {
  logger.error(err, 'hrms-worker failed to start');
  process.exitCode = 1;
});
