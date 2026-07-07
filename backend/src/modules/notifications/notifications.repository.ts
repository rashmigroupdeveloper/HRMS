/** All database access for the notifications module. */
import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { Database, NotificationsTable } from '../../core/db/types.js';

export type NotificationRow = Selectable<NotificationsTable>;

export interface EnqueueInput {
  recipientUserId?: number | null;
  recipientEmail?: string | null;
  channel: 'in_app' | 'email';
  templateCode: string;
  payload: Record<string, unknown>;
}

export async function insertNotification(db: Kysely<Database>, input: EnqueueInput): Promise<number> {
  const row = await db
    .insertInto('wf.notifications')
    .values({
      recipient_user_id: input.recipientUserId ?? null,
      recipient_email: input.recipientEmail ?? null,
      channel: input.channel,
      template_code: input.templateCode,
      payload: JSON.stringify(input.payload),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Claim a batch of deliverable rows — FOR UPDATE SKIP LOCKED so concurrent drains never double-send. */
export async function claimDeliverable(db: Kysely<Database>, limit: number): Promise<NotificationRow[]> {
  return db
    .selectFrom('wf.notifications')
    .selectAll()
    .where('status', 'in', ['queued', 'failed'])
    .orderBy('created_at')
    .limit(limit)
    .forUpdate()
    .skipLocked()
    .execute();
}

export async function markSent(db: Kysely<Database>, id: number): Promise<void> {
  await db
    .updateTable('wf.notifications')
    .set({ status: 'sent', sent_at: new Date(), last_error: null })
    .where('id', '=', id)
    .execute();
}

export async function markFailed(
  db: Kysely<Database>,
  id: number,
  error: string,
  maxAttempts: number,
): Promise<void> {
  await db
    .updateTable('wf.notifications')
    .set((eb) => ({
      attempts: eb('attempts', '+', 1),
      last_error: error,
      status: sql<'failed' | 'dead'>`CASE WHEN attempts + 1 >= ${maxAttempts} THEN 'dead' ELSE 'failed' END`,
    }))
    .where('id', '=', id)
    .execute();
}

export function listSubscribers(db: Kysely<Database>, eventCode: string) {
  return db
    .selectFrom('wf.event_subscriptions')
    .selectAll()
    .where('event_code', '=', eventCode)
    .execute();
}
