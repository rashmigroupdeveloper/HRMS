/**
 * Polls and pulse checks (EN-02/03, SOW-7.2).
 *
 * Anonymity is fixed AT CREATION and enforced by a column CHECK, so it cannot
 * be switched off for people who already answered on the strength of it.
 * An anonymous response stores a salted HMAC instead of a user id: it still
 * dedupes one-person-one-response, but the row carries no identity. The salt
 * is DERIVED from the application secret rather than stored beside the data,
 * so reading the database alone does not let you map a hash back to a person
 * by trying every user id.
 */
import { createHmac } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  audienceIncludesUser,
  toAudience,
  type Db,
  type EngagementAudience,
} from './audience.js';

export interface PollRow {
  id: number;
  question: string;
  options: string[];
  kind: 'poll' | 'pulse';
  isAnonymous: boolean;
  opensAt: string;
  closesAt: string | null;
  isActive: boolean;
  /** Whether the CALLER has already responded — drives the ESS surface. */
  hasResponded: boolean;
}

export interface PollResultRow {
  pollId: number;
  question: string;
  isAnonymous: boolean;
  totalResponses: number;
  options: { index: number; label: string; votes: number }[];
  comments: { comment: string; byEmail: string | null }[];
}

function anonymousHash(appSecret: string, pollId: number, userId: number): string {
  return createHmac('sha256', appSecret).update(`eng.poll:${pollId}:${userId}`).digest('hex');
}

function toOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.map((o) => String(o)) : [];
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

/** Epoch millis for a timestamptz column, whatever the driver hands back. */
function millis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return Number.NaN;
}

export interface CreatePollParams {
  question: string;
  options: string[];
  kind?: 'poll' | 'pulse' | undefined;
  isAnonymous: boolean;
  audience?: EngagementAudience | undefined;
  closesAt?: string | undefined;
  actorUserId: number;
}

export async function createPoll(db: Kysely<Database>, params: CreatePollParams): Promise<number> {
  if (params.options.length < 2) throw new Error('A poll needs at least two options');

  const row = await db
    .insertInto('eng.polls')
    .values({
      question: params.question,
      options: JSON.stringify(params.options),
      kind: params.kind ?? 'poll',
      is_anonymous: params.isAnonymous,
      audience: JSON.stringify(params.audience ?? {}),
      created_by: params.actorUserId,
      closes_at: params.closesAt === undefined ? null : sql<Date>`${params.closesAt}::timestamptz`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'eng.polls',
    entityId: row.id,
    field: 'question',
    // The anonymity promise is part of the record: it is the one property of a
    // poll that must never be seen to change after the fact.
    newValue: `${params.kind ?? 'poll'} (${params.isAnonymous ? 'anonymous' : 'named'}): ${params.question}`,
  });
  return row.id;
}

/** Open polls addressed to this person, with whether they have answered. */
export async function listPollsForUser(
  db: Db,
  userId: number,
  appSecret: string,
): Promise<PollRow[]> {
  const rows = await db
    .selectFrom('eng.polls')
    .selectAll()
    .where('is_active', '=', true)
    .where(sql<boolean>`opens_at <= now()`)
    .where(sql<boolean>`(closes_at IS NULL OR closes_at > now())`)
    .orderBy('opens_at', 'desc')
    .execute();

  const visible: PollRow[] = [];
  for (const r of rows) {
    const pollId = r.id;
    if (!(await audienceIncludesUser(db, toAudience(r.audience), userId))) continue;
    visible.push({
      id: pollId,
      question: r.question,
      options: toOptions(r.options),
      kind: r.kind,
      isAnonymous: r.is_anonymous,
      opensAt: iso(r.opens_at) ?? '',
      closesAt: iso(r.closes_at),
      isActive: r.is_active,
      hasResponded: await hasResponded(db, pollId, userId, r.is_anonymous, appSecret),
    });
  }
  return visible;
}

async function hasResponded(
  db: Db,
  pollId: number,
  userId: number,
  isAnonymous: boolean,
  appSecret: string,
): Promise<boolean> {
  const q = db.selectFrom('eng.poll_responses').select('id').where('poll_id', '=', pollId);
  const hit = isAnonymous
    ? await q
        .where('respondent_hash', '=', anonymousHash(appSecret, pollId, userId))
        .executeTakeFirst()
    : await q.where('respondent_user_id', '=', userId).executeTakeFirst();
  return hit !== undefined;
}

export interface RespondToPollParams {
  pollId: number;
  userId: number;
  optionIndex: number;
  comment?: string | undefined;
  appSecret: string;
}

export async function respondToPoll(
  db: Kysely<Database>,
  params: RespondToPollParams,
): Promise<void> {
  const poll = await db
    .selectFrom('eng.polls')
    .selectAll()
    .where('id', '=', params.pollId)
    .executeTakeFirst();
  if (poll === undefined) throw new Error('Poll not found');
  if (!poll.is_active) throw new Error('This poll is closed');
  if (poll.closes_at !== null && millis(poll.closes_at) <= Date.now()) {
    throw new Error('This poll is closed');
  }
  if (millis(poll.opens_at) > Date.now()) throw new Error('This poll is not open yet');

  const options = toOptions(poll.options);
  if (params.optionIndex < 0 || params.optionIndex >= options.length) {
    throw new Error('Invalid option');
  }
  if (!(await audienceIncludesUser(db, toAudience(poll.audience), params.userId))) {
    throw new Error('This poll is not addressed to you');
  }

  // NOTE: deliberately NOT audited. `writeAudit` records the actor, so an audit
  // row for an anonymous response would re-attach the very identity the schema
  // exists to remove. The tally IS the record.
  try {
    await db
      .insertInto('eng.poll_responses')
      .values({
        poll_id: params.pollId,
        respondent_user_id: poll.is_anonymous ? null : params.userId,
        respondent_hash: poll.is_anonymous
          ? anonymousHash(params.appSecret, params.pollId, params.userId)
          : null,
        option_index: params.optionIndex,
        comment: params.comment ?? null,
      })
      .execute();
  } catch (err: unknown) {
    // Either unique index — named or anonymous — means the same to the user.
    if (err instanceof Error && err.message.includes('poll_responses_one_per')) {
      throw new Error('You have already responded to this poll');
    }
    throw err;
  }
}

/**
 * Tally. On an anonymous poll the rows hold no user id at all, so there is
 * nothing to leak here even by accident.
 */
export async function pollResults(db: Db, pollId: number): Promise<PollResultRow> {
  const poll = await db
    .selectFrom('eng.polls')
    .selectAll()
    .where('id', '=', pollId)
    .executeTakeFirst();
  if (poll === undefined) throw new Error('Poll not found');

  const tally = await db
    .selectFrom('eng.poll_responses')
    .select(['option_index', (eb) => eb.fn.countAll<string>().as('votes')])
    .where('poll_id', '=', pollId)
    .groupBy('option_index')
    .execute();
  const votesByIndex = new Map(tally.map((t) => [t.option_index, Number(t.votes)]));

  const commentRows = await db
    .selectFrom('eng.poll_responses as r')
    .leftJoin('core.users as u', 'u.id', 'r.respondent_user_id')
    .select(['r.comment', 'u.email as by_email'])
    .where('r.poll_id', '=', pollId)
    .where('r.comment', 'is not', null)
    .orderBy('r.created_at', 'asc')
    .execute();

  return {
    pollId,
    question: poll.question,
    isAnonymous: poll.is_anonymous,
    totalResponses: [...votesByIndex.values()].reduce((a, b) => a + b, 0),
    options: toOptions(poll.options).map((label, index) => ({
      index,
      label,
      votes: votesByIndex.get(index) ?? 0,
    })),
    comments: commentRows.map((c) => ({
      comment: c.comment ?? '',
      // Belt and braces: an anonymous poll never returns an author, even if a
      // row were somehow written with one.
      byEmail: poll.is_anonymous ? null : (c.by_email ?? null),
    })),
  };
}

/** Close a poll for good — results stay readable, responses stop. */
export async function closePoll(
  db: Kysely<Database>,
  pollId: number,
  actorUserId: number,
): Promise<void> {
  const updated = await db
    .updateTable('eng.polls')
    .set({ is_active: false })
    .where('id', '=', pollId)
    .returning('id')
    .executeTakeFirst();
  if (updated === undefined) throw new Error('Poll not found');

  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'eng.polls',
    entityId: pollId,
    field: 'is_active',
    oldValue: 'true',
    newValue: 'false',
  });
}
