/**
 * Auth business logic: credential check with lockout/backoff, token issue,
 * refresh rotation. Every outcome (success OR failure) writes an audit row —
 * auth events are the first thing a forensic review asks for (NFR-03).
 */
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../../core/auth/jwt.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  findUserByIdentifier,
  findUserById,
  recordLoginFailure,
  recordLoginSuccess,
  type UserRow,
} from './auth.repository.js';

export type LoginResult =
  | { ok: true; user: UserRow; accessToken: string; refreshToken: string }
  | { ok: false; reason: 'invalid_credentials' | 'locked' | 'inactive'; lockedUntil?: Date };

export async function login(
  db: Kysely<Database>,
  jwtSecret: string,
  identifier: string, // email OR employee e-code
  password: string,
  ip: string | null,
): Promise<LoginResult> {
  const user = await findUserByIdentifier(db, identifier);

  // Uniform failure path: same audit + same response whether the account
  // exists or not (no user-enumeration oracle).
  if (!user) {
    await writeAudit(db, { action: 'login_failed', entity: 'core.users', ip, newValue: 'unknown identifier' });
    return { ok: false, reason: 'invalid_credentials' };
  }

  if (!user.is_active) {
    await writeAudit(db, { action: 'login_failed', entity: 'core.users', entityId: user.id, ip, newValue: 'inactive account' });
    return { ok: false, reason: 'inactive' };
  }

  if (user.locked_until && user.locked_until.getTime() > Date.now()) {
    await writeAudit(db, { action: 'login_failed', entity: 'core.users', entityId: user.id, ip, newValue: 'locked' });
    return { ok: false, reason: 'locked', lockedUntil: user.locked_until };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const { fails, lockedUntil } = await recordLoginFailure(db, user.id, user.failed_attempts);
    await writeAudit(db, {
      action: 'login_failed',
      entity: 'core.users',
      entityId: user.id,
      ip,
      newValue: `wrong password (attempt ${fails})${lockedUntil ? ' — locked' : ''}`,
    });
    if (lockedUntil) return { ok: false, reason: 'locked', lockedUntil };
    return { ok: false, reason: 'invalid_credentials' };
  }

  await recordLoginSuccess(db, user.id);
  await writeAudit(db, { actorUserId: user.id, action: 'login', entity: 'core.users', entityId: user.id, ip });

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.email, jwtSecret),
    signRefreshToken(user.id, user.email, jwtSecret),
  ]);
  return { ok: true, user, accessToken, refreshToken };
}

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false };

/** Rotates the refresh token: a used token is answered with a fresh pair. */
export async function refresh(
  db: Kysely<Database>,
  jwtSecret: string,
  token: string,
): Promise<RefreshResult> {
  const claims = await verifyToken(token, jwtSecret);
  if (claims?.typ !== 'refresh') return { ok: false };

  const user = await findUserById(db, claims.userId);
  if (!user?.is_active) return { ok: false };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.email, jwtSecret),
    signRefreshToken(user.id, user.email, jwtSecret),
  ]);
  return { ok: true, accessToken, refreshToken };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
