/** NFR-03: one login identity; atomic single-use refresh, no plaintext storage. */
import { createHash, randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../../core/auth/jwt.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import type { UserRow } from './auth.repository.js';
import { findUserById } from './auth.repository.js';
import { readAuthPolicy, type AuthPolicy } from './auth.policy.js';
import { inTransaction } from '../../core/db/database.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
async function tokenPair(user: UserRow, secret: string, sid: string, expires: Date, policy: AuthPolicy) {
  const end = Math.floor(expires.getTime() / 1000);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.email, secret, sid, Math.min(end, Math.floor(Date.now() / 1000) + policy.accessTtlSeconds)),
    signRefreshToken(user.id, user.email, secret, sid, end),
  ]);
  return { accessToken, refreshToken, refreshExpiresAt: expires };
}
export async function createSession(db: Kysely<Database>, user: UserRow, secret: string, ip: string | null, policy: AuthPolicy) {
  const sid = randomUUID();
  const expires = new Date(Date.now() + policy.refreshTtlSeconds * 1000);
  const pair = await tokenPair(user, secret, sid, expires, policy);
  await db.insertInto('sec.sessions').values({ sid, user_id: user.id, expires_at: expires, ip, refresh_token_hash: digest(pair.refreshToken) }).execute();
  return pair;
}
export async function rotateSession(db: Kysely<Database>, secret: string, token: string, ip: string | null) {
  const claims = await verifyToken(token, secret);
  if (claims?.typ !== 'refresh' || !claims.sid) return { ok: false as const };
  const rotate = async (tx: Kysely<Database>) => {
    // Match login's account-first lock order; session rotation and revocation
    // then serialize on the session row, before the append-only audit chain.
    const user = await findUserById(tx, claims.userId, true);
    if (!user?.is_active) return { ok: false as const };
    const session = await tx.selectFrom('sec.sessions').selectAll().where('sid', '=', claims.sid ?? '')
      .where('user_id', '=', user.id).where('revoked_at', 'is', null).where('expires_at', '>', new Date())
      .where('refresh_token_hash', '=', digest(token)).forUpdate().executeTakeFirst();
    if (!session) {
      // Reuse detection (A-27): a correctly signed refresh token for a live
      // session whose stored hash has already rotated means the token was
      // replayed — revoke the whole session family.
      const live = await tx.selectFrom('sec.sessions').select(['id']).where('sid', '=', claims.sid ?? '')
        .where('user_id', '=', user.id).where('revoked_at', 'is', null).forUpdate().executeTakeFirst();
      if (live) {
        await tx.updateTable('sec.sessions')
          .set({ revoked_at: new Date(), revoked_by_user_id: user.id, revoke_reason: 'refresh_reuse' })
          .where('id', '=', live.id).execute();
        await writeAudit(tx, { actorUserId: user.id, action: 'refresh_reuse_detected', entity: 'sec.sessions', entityId: live.id, ip });
        return { ok: false as const, reused: true as const };
      }
      return { ok: false as const };
    }
    const pair = await tokenPair(user, secret, session.sid, session.expires_at, await readAuthPolicy(tx));
    await tx.updateTable('sec.sessions').set({ refresh_token_hash: digest(pair.refreshToken), last_seen_at: new Date() }).where('id', '=', session.id).execute();
    await writeAudit(tx, { actorUserId: user.id, action: 'refresh', entity: 'sec.sessions', entityId: session.id, ip });
    return { ok: true as const, ...pair };
  };
  return db.isTransaction ? rotate(db) : inTransaction(db, rotate);
}
export async function revokeSession(db: Kysely<Database>, secret: string, token: string, ip: string | null): Promise<void> {
  const claims = await verifyToken(token, secret);
  if (!claims?.sid) return;
  const revoke = async (tx: Kysely<Database>) => {
    const session = await tx.updateTable('sec.sessions')
      .set({ revoked_at: new Date(), revoked_by_user_id: claims.userId, revoke_reason: 'logout' })
      .where('sid', '=', claims.sid ?? '').where('user_id', '=', claims.userId).where('revoked_at', 'is', null)
      .returning('id').executeTakeFirst();
    if (session) await writeAudit(tx, { actorUserId: claims.userId, action: 'logout', entity: 'sec.sessions', entityId: session.id, ip });
  };
  if (db.isTransaction) await revoke(db); else await inTransaction(db, revoke);
}
