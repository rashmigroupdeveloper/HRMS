/**
 * ESS-01 forgot / reset password. Lives beside auth.service so login stays
 * under the 400-line cap, and so this file never imports the security module
 * (orpc.ts already imports auth.service — a cycle would un-init `authed`).
 */
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { revokeAllForUser } from '../../core/auth/session.js';
import { getPasswordPolicy } from '../../core/auth/security-policy.js';
import { checkPassword, type PasswordViolation } from '../../core/auth/password-policy.js';
import { getTypedSetting } from '../../core/settings/read.js';
import { enqueue } from '../notifications/index.js';
import { findUserByIdentifier, findUserById } from './auth.repository.js';
import { hashPassword } from './auth.service.js';

function hashResetTokenBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseResetToken(token: string): Buffer | null {
  if (!/^[0-9a-f]{64}$/i.test(token)) return null;
  const bytes = Buffer.from(token, 'hex');
  return bytes.length === 32 ? bytes : null;
}

/**
 * ESS-01 — issue a password-reset token. Always returns `{ ok: true }` so the
 * response cannot be used as a user-enumeration oracle. Rate-limit is per
 * active account (unused tokens created in the last hour vs setting).
 */
export async function requestPasswordReset(
  db: Kysely<Database>,
  identifier: string,
  ip: string | null,
): Promise<{ ok: true }> {
  const user = await findUserByIdentifier(db, identifier.trim());
  if (!user?.is_active) {
    await writeAudit(db, {
      action: 'password_reset_requested',
      entity: 'core.users',
      ip,
      newValue: 'unknown or inactive',
    });
    return { ok: true };
  }

  const ratePerHour = await getTypedSetting(db, 'sec.password_reset_rate_per_hour', 'number', 3);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db
    .selectFrom('core.password_reset_tokens')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('user_id', '=', user.id)
    .where('used_at', 'is', null)
    .where('created_at', '>=', hourAgo)
    .executeTakeFirst();
  if (Number(recent?.count ?? 0) >= ratePerHour) {
    await writeAudit(db, {
      actorUserId: user.id,
      action: 'password_reset_requested',
      entity: 'core.users',
      entityId: user.id,
      ip,
      newValue: 'rate limited',
    });
    return { ok: true };
  }

  const ttlMinutes = await getTypedSetting(db, 'sec.password_reset_ttl_minutes', 'number', 30);
  const tokenBytes = randomBytes(32);
  const token = tokenBytes.toString('hex');
  const tokenHash = hashResetTokenBytes(tokenBytes);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await db
    .insertInto('core.password_reset_tokens')
    .values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
    })
    .execute();

  const payload = { token };
  await enqueue(db, {
    recipientUserId: user.id,
    channel: 'in_app',
    templateCode: 'password_reset',
    payload,
  });
  await enqueue(db, {
    recipientUserId: user.id,
    recipientEmail: user.email,
    channel: 'email',
    templateCode: 'password_reset',
    payload,
  });

  await writeAudit(db, {
    actorUserId: user.id,
    action: 'password_reset_requested',
    entity: 'core.users',
    entityId: user.id,
    ip,
    newValue: 'reset issued',
  });

  return { ok: true };
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_token' | 'expired' | 'reused' | 'policy'; violations?: PasswordViolation[] };

async function isReused(
  db: Kysely<Database>,
  userId: number,
  candidate: string,
  currentHash: string,
  depth: number,
): Promise<boolean> {
  if (await bcrypt.compare(candidate, currentHash)) return true;
  if (depth <= 0) return false;
  const history = await db
    .selectFrom('sec.password_history')
    .select('password_hash')
    .where('user_id', '=', userId)
    .orderBy('changed_at', 'desc')
    .limit(depth)
    .execute();
  for (const row of history) {
    if (await bcrypt.compare(candidate, row.password_hash)) return true;
  }
  return false;
}

/**
 * ESS-01 — consume a single-use reset token and set a new password under
 * SEC-01 policy. Revokes every live session for the account.
 */
export async function resetPasswordWithToken(
  db: Kysely<Database>,
  token: string,
  newPassword: string,
  ip: string | null,
): Promise<ResetPasswordResult> {
  const tokenBytes = parseResetToken(token);
  if (tokenBytes === null) {
    await writeAudit(db, {
      action: 'password_reset_failed',
      entity: 'core.password_reset_tokens',
      ip,
      newValue: 'malformed token',
    });
    return { ok: false, reason: 'invalid_token' };
  }

  const tokenHash = hashResetTokenBytes(tokenBytes);
  const row = await db
    .selectFrom('core.password_reset_tokens')
    .select(['id', 'user_id', 'expires_at', 'used_at'])
    .where('token_hash', '=', tokenHash)
    .executeTakeFirst();

  if (row?.used_at !== null) {
    await writeAudit(db, {
      action: 'password_reset_failed',
      entity: 'core.password_reset_tokens',
      entityId: row?.id ?? null,
      ip,
      newValue: 'missing or already used',
    });
    return { ok: false, reason: 'invalid_token' };
  }

  if (row.expires_at.getTime() <= Date.now()) {
    await writeAudit(db, {
      action: 'password_reset_failed',
      entity: 'core.password_reset_tokens',
      entityId: row.id,
      ip,
      newValue: 'expired',
    });
    return { ok: false, reason: 'expired' };
  }

  const user = await findUserById(db, row.user_id);
  if (!user?.is_active) {
    await writeAudit(db, {
      action: 'password_reset_failed',
      entity: 'core.users',
      entityId: row.user_id,
      ip,
      newValue: 'inactive account',
    });
    return { ok: false, reason: 'invalid_token' };
  }

  const policy = await getPasswordPolicy(db);
  const employee =
    user.employee_id === null
      ? undefined
      : await db
          .selectFrom('core.employees')
          .select('ecode')
          .where('id', '=', user.employee_id)
          .executeTakeFirst();
  const identifiers = [user.email.split('@')[0] ?? '', employee?.ecode ?? ''].filter(
    (value) => value !== '',
  );

  const verdict = checkPassword(newPassword, policy, { identifiers });
  if (!verdict.ok) {
    return { ok: false, reason: 'policy', violations: verdict.violations };
  }

  if (await isReused(db, user.id, newPassword, user.password_hash, policy.historyDepth)) {
    return { ok: false, reason: 'reused' };
  }

  const passwordHash = await hashPassword(newPassword);

  const consumed = await db
    .updateTable('core.password_reset_tokens')
    .set({ used_at: new Date() })
    .where('id', '=', row.id)
    .where('used_at', 'is', null)
    .executeTakeFirst();
  if (Number(consumed.numUpdatedRows) === 0) {
    return { ok: false, reason: 'invalid_token' };
  }

  await db
    .updateTable('core.users')
    .set({ password_hash: passwordHash, failed_attempts: 0, locked_until: null })
    .where('id', '=', user.id)
    .execute();
  await db
    .insertInto('sec.password_history')
    .values({
      user_id: user.id,
      password_hash: passwordHash,
      changed_by_user_id: user.id,
    })
    .execute();

  await revokeAllForUser(db, user.id, user.id, 'password reset');
  await writeAudit(db, {
    actorUserId: user.id,
    action: 'password_reset',
    entity: 'core.users',
    entityId: user.id,
    ip,
    newValue: 'password changed via reset',
  });

  return { ok: true };
}
