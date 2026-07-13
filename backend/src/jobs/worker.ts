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
  runAbsenteeScan,
  runKentSync,
  sendOvertimeSummaries,
} from '../modules/attendance/index.js';
import { runDailyBoardingExitReport } from '../modules/boarding/index.js';
import {
  registerLeaveWorkflowHooks,
  runCompOffExpiry,
  runMonthlyAccrual,
} from '../modules/leave/index.js';
import { enqueueEvent } from '../modules/notifications/index.js';
import { runPolicyAckNag } from '../modules/policies/index.js';
import { runEscalations } from '../modules/workflows/index.js';
import { istDateString, previousWeekStartIso } from '../core/dates.js';

const KENT_SYNC_QUEUE = 'kent-sync';
const RECOMPUTE_QUEUE = 'attendance-recompute';
const WEEK_CLOSE_QUEUE = 'attendance-week-close';
const ROSTER_REMINDER_QUEUE = 'roster-reminder';
const WF_ESCALATION_QUEUE = 'workflow-escalation';
const OT_SUMMARY_QUEUE = 'ot-daily-summary';
const LEAVE_ACCRUAL_QUEUE = 'leave-monthly-accrual';
const COMP_OFF_LAPSE_QUEUE = 'comp-off-expiry';
const BOARDING_EXIT_QUEUE = 'daily-boarding-exit';
const ABSENTEE_SCAN_QUEUE = 'absentee-scan';
const POLICY_ACK_NAG_QUEUE = 'policy-ack-nag';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);

  // The escalation sweep can LAPSE an overtime request (ATT-08) — the hook that
  // mirrors that onto att.overtime_entries must be registered in this process.
  // Leave finals (approve → ledger debit) likewise need registration here.
  registerAttendanceWorkflowHooks();
  registerLeaveWorkflowHooks();

  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on('error', (err: Error) => {
    logger.error(err, 'pg-boss error');
  });

  await boss.start();
  for (const q of [
    KENT_SYNC_QUEUE,
    RECOMPUTE_QUEUE,
    WEEK_CLOSE_QUEUE,
    ROSTER_REMINDER_QUEUE,
    WF_ESCALATION_QUEUE,
    OT_SUMMARY_QUEUE,
    LEAVE_ACCRUAL_QUEUE,
    COMP_OFF_LAPSE_QUEUE,
    BOARDING_EXIT_QUEUE,
    ABSENTEE_SCAN_QUEUE,
    POLICY_ACK_NAG_QUEUE,
  ]) {
    await boss.createQueue(q);
  }

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

  // LV-02: monthly leave credit on the 1st at 00:05 IST = 18:35 UTC previous day.
  // Cron '35 18 28-31 * *' is awkward; use 1st 18:35 UTC of prior calendar?
  // IST 00:05 on 1st = UTC 18:35 on last day of previous month.
  // Practical: schedule daily at 18:35 UTC and only act when IST date is the 1st
  // (handled inside runMonthlyAccrual idempotency — safe to call daily).
  // Spec says 1st 00:05: cron '5 18 1 * *' is 00:05 IST only if we use IST TZ —
  // pg-boss uses server local/UTC. Use '35 18 * * *' daily + job is idempotent.
  await boss.schedule(LEAVE_ACCRUAL_QUEUE, '35 18 * * *');
  await boss.work(LEAVE_ACCRUAL_QUEUE, async () => {
    if (istDateString().endsWith('-01')) await runMonthlyAccrual(db);
  });

  // LV-04: comp-off expiry sweep daily 01:00 IST = 19:30 UTC prior day ≈ '30 19 * * *'
  await boss.schedule(COMP_OFF_LAPSE_QUEUE, '30 19 * * *');
  await boss.work(COMP_OFF_LAPSE_QUEUE, async () => {
    await runCompOffExpiry(db);
  });

  // LC-03: daily boarding/exit email 07:00 IST = 01:30 UTC
  await boss.schedule(BOARDING_EXIT_QUEUE, '30 1 * * *');
  await boss.work(BOARDING_EXIT_QUEUE, async () => {
    await runDailyBoardingExitReport(db);
  });

  // ATT-10: absentee scan 06:00 IST = 00:30 UTC
  await boss.schedule(ABSENTEE_SCAN_QUEUE, '30 0 * * *');
  await boss.work(ABSENTEE_SCAN_QUEUE, async () => {
    await runAbsenteeScan(db);
  });

  // CORE-13: weekly policy-ack nag Monday 10:00 IST = 04:30 UTC
  await boss.schedule(POLICY_ACK_NAG_QUEUE, '30 4 * * 1');
  await boss.work(POLICY_ACK_NAG_QUEUE, async () => {
    await runPolicyAckNag(db);
  });

  // One immediate cycle on boot so a fresh environment has data instantly.
  await boss.send(KENT_SYNC_QUEUE, {});

  logger.info(
    {
      queues: [
        KENT_SYNC_QUEUE,
        RECOMPUTE_QUEUE,
        WEEK_CLOSE_QUEUE,
        ROSTER_REMINDER_QUEUE,
        LEAVE_ACCRUAL_QUEUE,
        COMP_OFF_LAPSE_QUEUE,
        BOARDING_EXIT_QUEUE,
        ABSENTEE_SCAN_QUEUE,
        POLICY_ACK_NAG_QUEUE,
      ],
    },
    'hrms-worker running',
  );
}

main().catch((err: unknown) => {
  logger.error(err, 'hrms-worker failed to start');
  process.exitCode = 1;
});
