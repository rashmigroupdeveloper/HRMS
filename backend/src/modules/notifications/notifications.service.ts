/**
 * Notification skeleton (WF-02): queue → transport with retry → dead-letter.
 * The transport is pluggable: DevLogTransport now; SMTP (nodemailer) lands when
 * server credentials exist. Nothing is ever silently dropped — undeliverable
 * rows park in status 'dead' for the ops dashboard.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { logger } from '../../core/logger.js';
import {
  claimDeliverable,
  insertNotification,
  listSubscribers,
  markFailed,
  markSent,
  type EnqueueInput,
  type NotificationRow,
} from './notifications.repository.js';

const MAX_ATTEMPTS = 5;

export interface NotificationTransport {
  send(notification: NotificationRow): Promise<void>;
}

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

  await db.transaction().execute(async (trx) => {
    const batch = await claimDeliverable(trx, batchSize);
    for (const notification of batch) {
      try {
        await transport.send(notification);
        await markSent(trx, notification.id);
        sent += 1;
      } catch (err) {
        await markFailed(trx, notification.id, err instanceof Error ? err.message : String(err), MAX_ATTEMPTS);
        failed += 1;
      }
    }
  });

  return { sent, failed };
}
