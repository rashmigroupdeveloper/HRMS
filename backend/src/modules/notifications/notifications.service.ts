/**
 * Notification skeleton (WF-02): queue → transport with retry → dead-letter.
 * The transport is pluggable: DevLogTransport now; SMTP (nodemailer) lands when
 * server credentials exist. Nothing is ever silently dropped — undeliverable
 * rows park in status 'dead' for the ops dashboard.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { logger } from '../../core/logger.js';
import { SmtpTransport } from './smtp.transport.js';
import type { NotificationTransport } from './transport.js';
import { getTypedSetting } from '../settings/index.js';
import {
  claimDeliverable,
  insertNotification,
  markClaimed,
  reclaimStalledSending,
  listSubscribers,
  markFailed,
  markSent,
  type EnqueueInput,
} from './notifications.repository.js';

const MAX_ATTEMPTS = 5;

/** Development transport — structured log line instead of a real send. */
export const devLogTransport: NotificationTransport = {
  send(n) {
    logger.info(
      { id: n.id, channel: n.channel, template: n.template_code, to: n.recipient_user_id ?? n.recipient_email },
      'notification (dev transport)',
    );
    return Promise.resolve();
  },
};

/**
 * Pick the transport from the environment, once.
 *
 * A missing SMTP host in development is normal and logs at debug. In production
 * `loadEnv` has already refused to boot without one, so reaching the fallback
 * there is impossible by construction rather than by vigilance.
 */
let transportInstance: NotificationTransport | null = null;

export function resolveTransport(): NotificationTransport {
  if (transportInstance !== null) return transportInstance;

  const host = process.env['SMTP_HOST'];
  const from = process.env['SMTP_FROM'];
  if (host === undefined || host === '' || from === undefined || from === '') {
    logger.warn(
      'SMTP is not configured — notifications will be logged, not delivered. This is expected in development only.',
    );
    transportInstance = devLogTransport;
    return transportInstance;
  }

  transportInstance = new SmtpTransport({
    host,
    port: Number(process.env['SMTP_PORT'] ?? 587),
    user: process.env['SMTP_USER'],
    pass: process.env['SMTP_PASS'],
    from,
  });
  return transportInstance;
}

/** Tests inject their own transport; this clears the memoised one. */
export function resetTransport(): void {
  transportInstance = null;
}

/** Queue one notification for a known recipient. */
export function enqueue(db: Kysely<Database>, input: EnqueueInput): Promise<number> {
  return insertNotification(db, input);
}

/**
 * Fan an EVENT out to its configured audience (wf.event_subscriptions) —
 * the per-event recipient matrix is data, editable without deploys (PP-26).
 * Role subscriptions notify every user currently holding the role.
 */
export async function enqueueEvent(
  db: Kysely<Database>,
  eventCode: string,
  templateCode: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const subs = await listSubscribers(db, eventCode);
  let queued = 0;

  for (const sub of subs) {
    if (sub.recipient_kind === 'email') {
      await insertNotification(db, { recipientEmail: sub.recipient_ref, channel: 'email', templateCode, payload });
      queued += 1;
    } else if (sub.recipient_kind === 'user') {
      await insertNotification(db, {
        recipientUserId: Number(sub.recipient_ref),
        channel: 'in_app',
        templateCode,
        payload,
      });
      queued += 1;
    } else {
      const holders = await db
        .selectFrom('core.user_roles as ur')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .innerJoin('core.users as u', 'u.id', 'ur.user_id')
        .where('r.code', '=', sub.recipient_ref)
        .where('u.is_active', '=', true)
        .select('u.id as user_id')
        .distinct()
        .execute();
      for (const h of holders) {
        await insertNotification(db, { recipientUserId: h.user_id, channel: 'in_app', templateCode, payload });
        queued += 1;
      }
    }
  }
  return queued;
}

/**
 * Drain the queue once: claim → send → sent | failed(attempt++) | dead.
 * Called by the scheduler (Phase 1 wires pg-boss/cron); callable manually.
 */
export async function processQueue(
  db: Kysely<Database>,
  transport: NotificationTransport,
  batchSize = 50,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  /**
   * Claim in ONE short transaction, then send and mark each message on its own.
   *
   * The whole batch used to run inside a single transaction, which had two
   * consequences with a real transport (audit finding [E10]). A failure late in
   * the batch rolled back the `markSent` of messages that had ALREADY been
   * delivered, so the retry sent them again — and the claim held row locks for
   * the sum of fifty SMTP round-trips. With a dev transport that logs, neither
   * showed up.
   *
   * Claiming means moving the row out of the deliverable set, so a second
   * worker cannot pick it up while this one is talking to the mail server.
   */
  const batch = await db.transaction().execute(async (trx) => {
    const rows = await claimDeliverable(trx, batchSize);
    if (rows.length > 0) await markClaimed(trx, rows.map((r) => r.id));
    return rows;
  });

  for (const notification of batch) {
    try {
      await transport.send(notification);
      await markSent(db, notification.id);
      sent += 1;
    } catch (err) {
      await markFailed(db, notification.id, err instanceof Error ? err.message : String(err), MAX_ATTEMPTS);
      failed += 1;
    }
  }

  return { sent, failed };
}

/**
 * One drain cycle for the scheduler, with the transport chosen from the
 * environment. Exists so `src/jobs/worker.ts` does not have to know how a
 * transport is built.
 */
export async function drainNotifications(
  db: Kysely<Database>,
  batchSize = 50,
): Promise<{ sent: number; failed: number; reclaimed: number }> {
  const staleMinutes = await getTypedSetting(db, 'wf.notification_stale_sending_minutes', 'number', 15);
  const reclaimed = await reclaimStalledSending(db, staleMinutes);
  if (reclaimed > 0) {
    logger.warn({ reclaimed }, 'reclaimed notifications stranded in sending by a dead worker');
  }
  const result = await processQueue(db, resolveTransport(), batchSize);
  return { ...result, reclaimed };
}

/** Re-exported so callers keep importing the transport contract from here. */
export type { NotificationTransport } from './transport.js';
