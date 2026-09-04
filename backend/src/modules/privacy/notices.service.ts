/**
 * Stage 5.3 — notices + acks (PRV-01).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { PrincipalClass } from '../../core/db/types.prv.js';
import { writeAudit } from '../../core/audit/audit.service.js';

export interface NoticeView {
  id: number;
  version: number;
  title: string;
  body: string;
  principalClass: string;
  effectiveFrom: string;
  isCurrent: boolean;
}

function mapNotice(row: {
  id: number;
  version: number;
  title: string;
  body: string;
  principal_class: string;
  effective_from: Date;
  is_current: boolean;
}): NoticeView {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    body: row.body,
    principalClass: row.principal_class,
    effectiveFrom: row.effective_from.toISOString(),
    isCurrent: row.is_current,
  };
}

export async function currentNotice(
  db: Kysely<Database>,
  principalClass: PrincipalClass = 'employee',
): Promise<NoticeView | null> {
  const row = await db
    .selectFrom('prv.notices')
    .selectAll()
    .where('principal_class', '=', principalClass)
    .where('is_current', '=', true)
    .orderBy('version', 'desc')
    .executeTakeFirst();
  return row === undefined ? null : mapNotice(row);
}

export async function listNotices(db: Kysely<Database>): Promise<NoticeView[]> {
  const rows = await db
    .selectFrom('prv.notices')
    .selectAll()
    .orderBy('principal_class')
    .orderBy('version', 'desc')
    .execute();
  return rows.map(mapNotice);
}

export async function noticeStatus(
  db: Kysely<Database>,
  userId: number,
): Promise<{ required: boolean; notice: NoticeView | null }> {
  const notice = await currentNotice(db);
  if (notice === null) return { required: false, notice: null };
  const ack = await db
    .selectFrom('prv.notice_acks')
    .select('id')
    .where('notice_id', '=', notice.id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return { required: ack === undefined, notice };
}

export async function acknowledgeNotice(
  db: Kysely<Database>,
  userId: number,
  noticeId: number,
  ip: string | null,
): Promise<'ok' | 'not_found'> {
  const notice = await db
    .selectFrom('prv.notices')
    .select(['id', 'is_current'])
    .where('id', '=', noticeId)
    .executeTakeFirst();
  if (!notice?.is_current) return 'not_found';
  await db
    .insertInto('prv.notice_acks')
    .values({ notice_id: noticeId, user_id: userId, ip })
    .onConflict((oc) => oc.columns(['notice_id', 'user_id']).doNothing())
    .execute();
  await writeAudit(db, {
    actorUserId: userId,
    action: 'privacy_notice_ack',
    entity: 'prv.notice_acks',
    entityId: noticeId,
    ip: ip ?? null,
    newValue: 'acknowledged',
  });
  return 'ok';
}
