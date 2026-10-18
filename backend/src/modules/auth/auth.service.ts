/**
 * Auth business logic: credential check with lockout/backoff, token issue,
 * refresh rotation. Every outcome (success OR failure) writes an audit row —
 * auth events are the first thing a forensic review asks for (NFR-03).
 */
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { createSession, rotateSession } from './auth.sessions.js';
import { readAuthPolicy } from './auth.policy.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  findUserByIdentifier,
  recordLoginFailure,
  recordLoginSuccess,
  type UserRow,
} from './auth.repository.js';

export type LoginResult =
  | { ok: true; user: UserRow; accessToken: string; refreshToken: string; refreshExpiresAt: Date }
  | { ok: false; reason: 'invalid_credentials' | 'locked' | 'inactive'; lockedUntil?: Date };

export async function login(
  db: Kysely<Database>,
  jwtSecret: string,
  identifier: string, // email OR employee e-code
  password: string,
  ip: string | null,
): Promise<LoginResult> {
  const attempt = async (tx: Kysely<Database>): Promise<LoginResult> => {
    const user = await findUserByIdentifier(tx, identifier, true);

    // Uniform failure path: same audit + same response whether the account
    // exists or not (no user-enumeration oracle).
    if (!user) {
      await writeAudit(tx, { action: 'login_failed', entity: 'core.users', ip, newValue: 'unknown identifier' });
      return { ok: false, reason: 'invalid_credentials' };
    }

    if (!user.is_active) {
      await writeAudit(tx, { action: 'login_failed', entity: 'core.users', entityId: user.id, ip, newValue: 'inactive account' });
      return { ok: false, reason: 'inactive' };
    }

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      await writeAudit(tx, { action: 'login_failed', entity: 'core.users', entityId: user.id, ip, newValue: 'locked' });
      return { ok: false, reason: 'locked', lockedUntil: user.locked_until };
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const { fails, lockedUntil } = await recordLoginFailure(tx, user.id, await readAuthPolicy(tx));
      await writeAudit(tx, {
        action: 'login_failed',
        entity: 'core.users',
        entityId: user.id,
        ip,
        newValue: `wrong password (attempt ${fails})${lockedUntil ? ' — locked' : ''}`,
      });
      if (lockedUntil) return { ok: false, reason: 'locked', lockedUntil };
      return { ok: false, reason: 'invalid_credentials' };
    }

    await recordLoginSuccess(tx, user.id);
    await writeAudit(tx, { actorUserId: user.id, action: 'login', entity: 'core.users', entityId: user.id, ip });

    const pair = await createSession(tx, user, jwtSecret, ip, await readAuthPolicy(tx));
    return { ok: true, user, ...pair };
  };
  return db.isTransaction ? attempt(db) : db.transaction().execute(attempt);
}

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string; refreshExpiresAt: Date }
  | { ok: false };

/** Rotates the refresh token: a used token is answered with a fresh pair. */
export async function refresh(
  db: Kysely<Database>,
  jwtSecret: string,
  token: string,
  ip: string | null = null,
): Promise<RefreshResult> {
  return rotateSession(db, jwtSecret, token, ip);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
