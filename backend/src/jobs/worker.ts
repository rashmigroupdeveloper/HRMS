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
  runAbsenceScan,
  runKentSync,
  sendOvertimeSummaries,
} from '../modules/attendance/index.js';
import { registerLeaveWorkflowHooks, runCompOffExpiry, runMonthlyAccrual } from '../modules/leave/index.js';
import { registerLettersWorkflowHooks } from '../modules/letters/index.js';
import { runPolicyAckNag } from '../modules/policies/index.js';
import { sendBoardingExitEmail } from '../modules/lifecycle/index.js';
import { countDeadNotifications, drainNotifications, enqueueEvent } from '../modules/notifications/index.js';
import { runEscalations } from '../modules/workflows/index.js';
import { buildKpiSnapshot } from '../modules/reports/index.js';
import { escalateBreachedTickets } from '../modules/helpdesk/index.js';
import { istDateString, previousWeekStartIso } from '../core/dates.js';
import { registerClaimsWorkflowHooks } from '../modules/claims/index.js';

const KENT_SYNC_QUEUE = 'kent-sync';
const RECOMPUTE_QUEUE = 'attendance-recompute';
const WEEK_CLOSE_QUEUE = 'attendance-week-close';
const ROSTER_REMINDER_QUEUE = 'roster-reminder';
const WF_ESCALATION_QUEUE = 'workflow-escalation';
const OT_SUMMARY_QUEUE = 'ot-daily-summary';
const LEAVE_ACCRUAL_QUEUE = 'leave-accrual';
const COMP_OFF_EXPIRY_QUEUE = 'comp-off-expiry';
const BOARDING_EXIT_QUEUE = 'boarding-exit-email';
const ABSENCE_SCAN_QUEUE = 'absence-scan';
const POLICY_NAG_QUEUE = 'policy-ack-nag';
const KPI_SNAPSHOT_QUEUE = 'kpi-daily-snapshot';
const HELPDESK_ESCALATION_QUEUE = 'helpdesk-escalation';
const NOTIFICATION_DRAIN_QUEUE = 'notification-drain';

/**
 * pg-boss v12 requires a queue to exist before `schedule()` or `work()` names
 * it. Two queues were scheduled without being created, and the worker did not
 * merely misbehave — it threw `Queue kpi-daily-snapshot not found` on boot and
 * took ALL THIRTEEN jobs down with it (audit finding [E9], upgraded from
 * UNVERIFIED to confirmed on 5 Sep 2026 by actually starting it).
 *
 * One list, asserted at startup, so the next queue cannot be added to only half
 * of it.
 */

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);

  // The escalation sweep can LAPSE an overtime request (ATT-08) and finalize
  // leave chains — the hooks that mirror finals onto domain rows must be
  // registered in this process too.
  registerAttendanceWorkflowHooks();
  registerClaimsWorkflowHooks();
  registerLeaveWorkflowHooks();
  registerLettersWorkflowHooks();

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
    BOARDING_EXIT_QUEUE,
    ABSENCE_SCAN_QUEUE,
    POLICY_NAG_QUEUE,
    KPI_SNAPSHOT_QUEUE,
    HELPDESK_ESCALATION_QUEUE,
    NOTIFICATION_DRAIN_QUEUE,
  ];
  for (const q of queues) {
    await boss.createQueue(q);
  }

  /**
   * WF-02: drain the notification queue every minute.
   *
   * Everything else in this file ENQUEUES. Nothing dequeued: `processQueue` had
   * no production caller at all, so `wf.notifications` accumulated rows that
   * were never delivered — not even to a log (audit finding [A2]). This is the
   * job that makes "the approver was notified" true rather than merely recorded.
   */
  await boss.schedule(NOTIFICATION_DRAIN_QUEUE, '* * * * *');
  await boss.work(NOTIFICATION_DRAIN_QUEUE, async () => {
    const result = await drainNotifications(db);
    if (result.sent > 0 || result.failed > 0) {
      logger.info(result, 'notifications drained');
    }
    if (result.failed > 0) {
      // Dead-letter rows are an operational signal, not a statistic: something
      // a person was supposed to be told never reached them.
      const dead = await countDeadNotifications(db);
      if (dead > 0) logger.error({ dead }, 'notifications in dead-letter — nobody was told');
    }
  });

  // LC-03: the daily boarding/exit email at 07:00 IST (01:30 UTC) — queued
  // even on an empty day ("runs without exception", PP-6/26).
  await boss.schedule(BOARDING_EXIT_QUEUE, '30 1 * * *');
  await boss.work(BOARDING_EXIT_QUEUE, async () => {
    await sendBoardingExitEmail(db);
  });

  // ATT-10/11: absence scan of yesterday at 06:00 IST (00:30 UTC).
  await boss.schedule(ABSENCE_SCAN_QUEUE, '30 0 * * *');
  await boss.work(ABSENCE_SCAN_QUEUE, async () => {
    await runAbsenceScan(db);
  });

  // RPT-03: the CEO dashboard reads PRECOMPUTED rows, so something has to
  // precompute them. Nightly at 02:15 IST (20:45 UTC the evening before) —
  // after the day's attendance has settled, before anyone opens the dashboard.
  await boss.schedule(KPI_SNAPSHOT_QUEUE, '45 20 * * *');
  await boss.work(KPI_SNAPSHOT_QUEUE, async () => {
    const result = await buildKpiSnapshot(db);
    logger.info(result, 'kpi snapshot rebuilt');
  });

  // SOW-9.2: helpdesk SLA escalation, hourly — the same cadence as workflow
  // escalation, because a breached ticket ages exactly as fast.
  await boss.schedule(HELPDESK_ESCALATION_QUEUE, '15 * * * *');
  await boss.work(HELPDESK_ESCALATION_QUEUE, async () => {
    const { escalated } = await escalateBreachedTickets(db);
    if (escalated > 0) logger.info({ escalated }, 'helpdesk tickets escalated');
  });

  // CORE-13: weekly policy-acknowledgment nag, Monday 09:30 IST (04:00 UTC).
  await boss.schedule(POLICY_NAG_QUEUE, '0 4 * * 1');
  await boss.work(POLICY_NAG_QUEUE, async () => {
    await runPolicyAckNag(db);
  });

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
  // pg-boss crons are UTC, so 02:00 IST is 20:30 UTC on SUNDAY. The comment
  // said IST and the expression said UTC, which ran this 5.5 h late every week
  // (audit finding [E8]).
  await boss.schedule(WEEK_CLOSE_QUEUE, '30 20 * * 0');
  await boss.work(WEEK_CLOSE_QUEUE, async () => {
    await closeWeek(db, previousWeekStartIso(new Date()));
  });

  // Monthly roster deadline nag on the 5th, 09:00 (ATT-04 / Agreement 4.1a) —
  // recipients live in wf.event_subscriptions ('attendance.roster_deadline').
  // 09:00 IST on the 5th = 03:30 UTC on the 5th. Was firing at 14:30 IST.
  await boss.schedule(ROSTER_REMINDER_QUEUE, '30 3 5 * *');
  await boss.work(ROSTER_REMINDER_QUEUE, async () => {
    await enqueueEvent(db, 'attendance.roster_deadline', 'roster_deadline', {
      month: new Date().toISOString().slice(0, 7),
    });
  });

  // One immediate cycle on boot so a fresh environment has data instantly.
  await boss.send(KENT_SYNC_QUEUE, {});

  /**
   * Prove the schedules actually landed. The worker previously died on boot and
   * the only evidence was a log line nobody was reading; a deployment that
   * silently runs zero jobs looks exactly like a healthy one from outside.
   */
  const scheduled = await boss.getSchedules();
  const missing = queues.filter(
    (q) => q !== NOTIFICATION_DRAIN_QUEUE && !scheduled.some((sch) => sch.name === q),
  );
  if (missing.length > 0) {
    logger.error({ missing }, 'queues registered but NOT scheduled — jobs will never fire');
  }
  logger.info({ queues: queues.length, scheduled: scheduled.length }, 'hrms-worker running');
}

main().catch((err: unknown) => {
  logger.error(err, 'hrms-worker failed to start');
  process.exitCode = 1;
});
