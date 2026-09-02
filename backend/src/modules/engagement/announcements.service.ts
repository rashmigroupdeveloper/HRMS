/**
 * Announcements (EN-01, SOW-7.1) — reach an audience, not "everyone" by
 * default. Withdrawal is a flag, never a delete, so the record of what was
 * said to whom survives.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  audienceIncludesUser,
  toAudience,
  type Db,
  type EngagementAudience,
} from './audience.js';

export interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  publishedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  publishedByEmail: string | null;
}

export interface PublishAnnouncementParams {
  title: string;
  body: string;
  audience?: EngagementAudience | undefined;
  expiresAt?: string | undefined;
  actorUserId: number;
}

export async function publishAnnouncement(
  db: Kysely<Database>,
  params: PublishAnnouncementParams,
): Promise<number> {
  const row = await db
    .insertInto('eng.announcements')
    .values({
      title: params.title,
      body: params.body,
      audience: JSON.stringify(params.audience ?? {}),
      published_by: params.actorUserId,
      expires_at:
        params.expiresAt === undefined ? null : sql<Date>`${params.expiresAt}::timestamptz`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'eng.announcements',
    entityId: row.id,
    field: 'title',
    newValue: params.title,
  });
  return row.id;
}

/** The publisher's view — everything, including expired and withdrawn. */
export async function listAllAnnouncements(db: Db): Promise<AnnouncementRow[]> {
  const rows = await db
    .selectFrom('eng.announcements as a')
    .leftJoin('core.users as u', 'u.id', 'a.published_by')
    .select([
      'a.id',
      'a.title',
      'a.body',
      'a.published_at',
      'a.expires_at',
      'a.is_active',
      'u.email as published_by_email',
    ])
    .orderBy('a.published_at', 'desc')
    .execute();
  return rows.map(toRow);
}

/** The reader's feed — live, unexpired, and addressed to this person. */
export async function listAnnouncementsForUser(
  db: Db,
  userId: number,
): Promise<AnnouncementRow[]> {
  const rows = await db
    .selectFrom('eng.announcements as a')
    .leftJoin('core.users as u', 'u.id', 'a.published_by')
    .select([
      'a.id',
      'a.title',
      'a.body',
      'a.audience',
      'a.published_at',
      'a.expires_at',
      'a.is_active',
      'u.email as published_by_email',
    ])
    .where('a.is_active', '=', true)
    .where(sql<boolean>`a.published_at <= now()`)
    .where(sql<boolean>`(a.expires_at IS NULL OR a.expires_at > now())`)
    .orderBy('a.published_at', 'desc')
    .execute();

  const visible: AnnouncementRow[] = [];
  for (const r of rows) {
    if (await audienceIncludesUser(db, toAudience(r.audience), userId)) visible.push(toRow(r));
  }
  return visible;
}

/** Withdraw a published announcement — never a hard delete. */
export async function withdrawAnnouncement(
  db: Kysely<Database>,
  announcementId: number,
  actorUserId: number,
): Promise<void> {
  const updated = await db
    .updateTable('eng.announcements')
    .set({ is_active: false })
    .where('id', '=', announcementId)
    .returning('id')
    .executeTakeFirst();
  if (updated === undefined) throw new Error('Announcement not found');

  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'eng.announcements',
    entityId: announcementId,
    field: 'is_active',
    oldValue: 'true',
    newValue: 'false',
  });
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

interface RawAnnouncement {
  id: number;
  title: string;
  body: string;
  published_at: unknown;
  expires_at: unknown;
  is_active: boolean;
  published_by_email: string | null;
}

function toRow(r: RawAnnouncement): AnnouncementRow {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    publishedAt: iso(r.published_at) ?? '',
    expiresAt: iso(r.expires_at),
    isActive: r.is_active,
    publishedByEmail: r.published_by_email ?? null,
  };
}
