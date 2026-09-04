/**
 * Auth business logic: credential check with lockout/backoff, token issue,
 * refresh rotation. Every outcome (success OR failure) writes an audit row —
 * auth events are the first thing a forensic review asks for (NFR-03).
 *
 * Forgot/reset (ESS-01) lives in `auth.password-reset.ts` so this file stays
 * under the 400-line cap and so orpc.ts can import healEmployeeLinkIfNeeded
 * without pulling the security router.
 */
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../../core/auth/jwt.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { createSession, deviceLabelFrom, findLiveSession } from '../../core/auth/session.js';
import { getSessionPolicy } from '../../core/auth/security-policy.js';
import {
  attachEmployeeToUser,
  findHealCandidateEmployeeId,
  findUserByIdentifier,
  findUserById,
  recordLoginFailure,
  recordLoginSuccess,
  type UserRow,
} from './auth.repository.js';

export type LoginResult =
  | { ok: true; user: UserRow; accessToken: string; refreshToken: string; sid: string }
  | { ok: false; reason: 'invalid_credentials' | 'locked' | 'inactive'; lockedUntil?: Date };

export async function login(
  db: Kysely<Database>,
  jwtSecret: string,
  identifier: string, // email OR employee e-code
  password: string,
  ip: string | null,
  userAgent: string | null = null,
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

  // SEC-05: the session row is created FIRST — a token whose sid has no live
  // row is worthless, which is precisely the property revoke depends on.
  const policy = await getSessionPolicy(db);
  const { sid } = await createSession(db, {
    userId: user.id,
    ip,
    userAgent,
    deviceLabel: deviceLabelFrom(userAgent),
    ttlMs: policy.absoluteHours * 60 * 60 * 1000,
  });

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.email, jwtSecret, sid),
    signRefreshToken(user.id, user.email, jwtSecret, sid),
  ]);
  return { ok: true, user, accessToken, refreshToken, sid };
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
  if (claims.sid === undefined) return { ok: false };

  const user = await findUserById(db, claims.userId);
  if (!user?.is_active) return { ok: false };

  // A revoked session cannot be refreshed back to life — otherwise "sign out
  // everywhere" would last only until the next silent refresh.
  const policy = await getSessionPolicy(db);
  const session = await findLiveSession(db, claims.sid, policy.idleMinutes);
  if (session?.user_id !== user.id) return { ok: false };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.email, jwtSecret, claims.sid),
    signRefreshToken(user.id, user.email, jwtSecret, claims.sid),
  ]);
  return { ok: true, accessToken, refreshToken };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * On the next authenticated request, attach an unused employee whose
 * `work_email` matches the login. Pure-admin accounts with no matching employee
 * stay unlinked (NULL is legal for service accounts — doc 03).
 */
export async function healEmployeeLinkIfNeeded(
  db: Kysely<Database>,
  user: UserRow,
): Promise<UserRow> {
  if (user.employee_id !== null) return user;

  const employeeId = await findHealCandidateEmployeeId(db, user.id, user.email);
  if (employeeId === undefined) return user;

  await attachEmployeeToUser(db, user.id, employeeId);
  await writeAudit(db, {
    actorUserId: user.id,
    action: 'update',
    entity: 'core.users',
    entityId: user.id,
    field: 'employee_id',
    newValue: String(employeeId),
    subjectEmployeeId: employeeId,
  });

  return { ...user, employee_id: employeeId };
}
