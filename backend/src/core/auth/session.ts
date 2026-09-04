/**
 * SEC-05 — sessions as rows. Foundation, not a feature: the API layer
 * validates a session on EVERY request, so this cannot live behind a module
 * whose public API also exports a router (that would be a cycle through
 * `api/orpc.ts`). Same reasoning as `core/auth/jwt.ts`.
 *
 * A JWT alone cannot be withdrawn: until it expires it is valid everywhere,
 * which makes "sign out on all devices" and an admin revoke into promises the
 * system cannot keep. So the access token carries a `sid` and THIS table is the
 * authority — a revoke takes effect on the very next request (GAP-C04), which
 * is also what the Phase-3 exit-day control needs.
 */
import { randomUUID } from 'node:crypto';
import type { Kysely, Selectable } from 'kysely';
import type { Database, SecSessionsTable } from '../db/types.js';

export type SessionRow = Selectable<SecSessionsTable>;

/** Writing `last_seen_at` on every request would be a write per read. */
const TOUCH_THROTTLE_MS = 60_000;

export interface NewSession {
  userId: number;
  ip: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  ttlMs: number;
}

export async function createSession(
  db: Kysely<Database>,
  input: NewSession,
): Promise<{ sid: string; expiresAt: Date }> {
  const sid = randomUUID();
  const expiresAt = new Date(Date.now() + input.ttlMs);
  await db
    .insertInto('sec.sessions')
    .values({
      sid,
      user_id: input.userId,
      expires_at: expiresAt,
      ip: input.ip,
      user_agent: input.userAgent,
      device_label: input.deviceLabel,
    })
    .execute();
  return { sid, expiresAt };
}

/**
 * The hot path. A session is live when it exists, is not revoked, has not
 * expired, AND has been seen inside the idle window — idle timeout is a policy
 * value, so it is passed in rather than read here.
 */
export async function findLiveSession(
  db: Kysely<Database>,
  sid: string,
  idleMinutes: number,
): Promise<SessionRow | undefined> {
  const now = Date.now();
  const row = await db
    .selectFrom('sec.sessions')
    .selectAll()
    .where('sid', '=', sid)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();

  if (!row) return undefined;
  if (row.expires_at.getTime() <= now) return undefined;
  if (idleMinutes > 0 && now - row.last_seen_at.getTime() > idleMinutes * 60_000) return undefined;
  return row;
}

/** Throttled heartbeat — keeps the idle window honest without a write per request. */
export async function touchSession(db: Kysely<Database>, session: SessionRow): Promise<void> {
  if (Date.now() - session.last_seen_at.getTime() < TOUCH_THROTTLE_MS) return;
  await db
    .updateTable('sec.sessions')
    .set({ last_seen_at: new Date() })
    .where('sid', '=', session.sid)
    .execute();
}

export async function revokeSession(
  db: Kysely<Database>,
  sid: string,
  byUserId: number,
  reason: string,
): Promise<number> {
  const result = await db
    .updateTable('sec.sessions')
    .set({ revoked_at: new Date(), revoked_by_user_id: byUserId, revoke_reason: reason })
    .where('sid', '=', sid)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

/** "Sign out everywhere" — optionally sparing the session making the request. */
export async function revokeAllForUser(
  db: Kysely<Database>,
  userId: number,
  byUserId: number,
  reason: string,
  exceptSid?: string,
): Promise<number> {
  let query = db
    .updateTable('sec.sessions')
    .set({ revoked_at: new Date(), revoked_by_user_id: byUserId, revoke_reason: reason })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null);
  if (exceptSid !== undefined) query = query.where('sid', '<>', exceptSid);
  const result = await query.executeTakeFirst();
  return Number(result.numUpdatedRows);
}

export async function listSessionsForUser(
  db: Kysely<Database>,
  userId: number,
  includeRevoked: boolean,
): Promise<SessionRow[]> {
  let query = db
    .selectFrom('sec.sessions')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('last_seen_at', 'desc')
    .limit(50);
  if (!includeRevoked) query = query.where('revoked_at', 'is', null);
  return query.execute();
}

/** SEC-04 — a proven step-up elevates this session for a short, explicit window. */
export async function markSteppedUp(
  db: Kysely<Database>,
  sid: string,
  minutes: number,
): Promise<Date> {
  const now = new Date();
  const until = new Date(now.getTime() + minutes * 60_000);
  await db
    .updateTable('sec.sessions')
    .set({ stepped_up_at: now, stepped_up_until: until })
    .where('sid', '=', sid)
    .execute();
  return until;
}

export function isSteppedUp(session: SessionRow, now = Date.now()): boolean {
  return session.stepped_up_until !== null && session.stepped_up_until.getTime() > now;
}

/**
 * A device label a human recognises, derived from the user agent. Deliberately
 * coarse: "Chrome on Windows" is what someone needs to spot a session that is
 * not theirs; a full UA string is noise.
 */
export function deviceLabelFrom(userAgent: string | null): string | null {
  if (userAgent === null || userAgent === '') return null;
  const has = (needle: string): boolean => userAgent.includes(needle);
  // Order matters: every Chromium browser also claims Chrome and Safari.
  const browser =
    has('Edg/') ? 'Edge'
    : has('OPR/') ? 'Opera'
    : has('Chrome/') ? 'Chrome'
    : has('Firefox/') ? 'Firefox'
    : has('Safari/') ? 'Safari'
    : 'Browser';
  const platform =
    has('Android') ? 'Android'
    : has('iPhone') || has('iPad') || has('iPod') ? 'iOS'
    : has('Windows') ? 'Windows'
    : has('Mac OS X') ? 'macOS'
    : has('Linux') ? 'Linux'
    : 'device';
  return `${browser} on ${platform}`;
}
