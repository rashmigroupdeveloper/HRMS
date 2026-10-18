/**
 * C-34 / A-15 (NFR-03, SEC-01): password change, forgot/reset and the
 * IT-admin account lifecycle. Every outcome is audited; tokens and passwords
 * are only ever stored as hashes.
 */
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';
import { getTypedSetting } from '../settings/index.js';
import { enqueue } from '../notifications/index.js';
import { findUserByIdentifier } from './auth.repository.js';
import { inTransaction } from '../../core/db/database.js';

const BCRYPT_COST = 10;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export interface PasswordPolicy {
  minLength: number;
  historyDepth: number;
  resetTokenMinutes: number;
}

async function readPasswordPolicy(db: Kysely<Database>): Promise<PasswordPolicy> {
  const [minLength, historyDepth, resetTokenMinutes] = await Promise.all([
    getTypedSetting(db, 'auth.password_min_length', 'number', 10),
    getTypedSetting(db, 'auth.password_history_depth', 'number', 5),
    getTypedSetting(db, 'auth.reset_token_minutes', 'number', 30),
  ]);
  return { minLength, historyDepth, resetTokenMinutes };
}

/** Returns a human sentence when the password breaks policy, else null. */
function passwordProblem(password: string, policy: PasswordPolicy, email?: string): string | null {
  if (password.length < policy.minLength) return `Password must be at least ${String(policy.minLength)} characters`;
  if (password.length > 128) return 'Password must be at most 128 characters';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain letters and numbers';
  if (email && password.toLowerCase().includes(email.split('@')[0]?.toLowerCase() ?? '\u0000')) {
    return 'Password must not contain your login name';
  }
  return null;
}

async function assertNotReused(db: Kysely<Database>, userId: number, password: string, depth: number, currentHash: string) {
  const history = await db.selectFrom('sec.password_history').select('password_hash')
    .where('user_id', '=', userId).orderBy('changed_at', 'desc').limit(depth).execute();
  for (const hash of [currentHash, ...history.map((h) => h.password_hash)]) {
    if (hash.startsWith('$2') && await bcrypt.compare(password, hash)) {
      throw new DomainError(`Choose a password you have not used in your last ${String(depth)} changes`);
    }
  }
}

async function storeNewPassword(
  db: Kysely<Database>, userId: number, oldHash: string, password: string,
  actorUserId: number, mustChange: boolean,
): Promise<void> {
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await db.insertInto('sec.password_history').values({ user_id: userId, password_hash: oldHash, changed_by_user_id: actorUserId }).execute();
  await db.updateTable('core.users').set({
    password_hash: hash, must_change_password: mustChange, password_changed_at: new Date(),
    failed_attempts: 0, locked_until: null,
  }).where('id', '=', userId).execute();
}

async function revokeSessions(db: Kysely<Database>, userId: number, actorUserId: number, reason: string, keepSid?: string) {
  await db.updateTable('sec.sessions')
    .set({ revoked_at: new Date(), revoked_by_user_id: actorUserId, revoke_reason: reason })
    .where('user_id', '=', userId).where('revoked_at', 'is', null)
    .$if(keepSid !== undefined, (q) => q.where('sid', '!=', keepSid ?? ''))
    .execute();
}

export async function changePassword(
  db: Kysely<Database>,
  params: { userId: number; currentPassword: string; newPassword: string; sid?: string | undefined; ip: string | null },
): Promise<void> {
  await inTransaction(db, async (trx) => {
    const user = await trx.selectFrom('core.users').selectAll().where('id', '=', params.userId).forUpdate().executeTakeFirst();
    if (!user) throw new NotFoundError('Account not found');
    if (!(await bcrypt.compare(params.currentPassword, user.password_hash))) {
      await writeAudit(trx, { actorUserId: user.id, action: 'password_change_failed', entity: 'core.users', entityId: user.id, ip: params.ip });
      throw new DomainError('Your current password is not correct');
    }
    const policy = await readPasswordPolicy(trx);
    const problem = passwordProblem(params.newPassword, policy, user.email);
    if (problem) throw new DomainError(problem);
    await assertNotReused(trx, user.id, params.newPassword, policy.historyDepth, user.password_hash);
    await storeNewPassword(trx, user.id, user.password_hash, params.newPassword, user.id, false);
    await revokeSessions(trx, user.id, user.id, 'password_changed', params.sid);
    await writeAudit(trx, { actorUserId: user.id, action: 'password_changed', entity: 'core.users', entityId: user.id, ip: params.ip });
  });
}

/**
 * Forgot password: always answers the same way (no account oracle). When the
 * account exists and is active a single-use token is mailed.
 */
export async function requestPasswordReset(
  db: Kysely<Database>,
  params: { identifier: string; ip: string | null; resetUrlBase: string },
): Promise<void> {
  await inTransaction(db, async (trx) => {
    const user = await findUserByIdentifier(trx, params.identifier.trim());
    if (!user?.is_active) {
      await writeAudit(trx, { action: 'password_reset_requested', entity: 'core.users', ip: params.ip, newValue: 'unknown or inactive identifier' });
      return;
    }
    const policy = await readPasswordPolicy(trx);
    const token = randomBytes(32).toString('base64url');
    // One live token per account: older unused tokens are retired.
    await trx.updateTable('core.password_reset_tokens').set({ used_at: new Date() })
      .where('user_id', '=', user.id).where('used_at', 'is', null).execute();
    await trx.insertInto('core.password_reset_tokens').values({
      user_id: user.id, token_hash: digest(token),
      expires_at: new Date(Date.now() + policy.resetTokenMinutes * 60_000),
    }).execute();
    await enqueue(trx, {
      recipientEmail: user.email, channel: 'email', templateCode: 'password_reset',
      payload: { resetLink: `${params.resetUrlBase}/reset-password?token=${token}`, validMinutes: policy.resetTokenMinutes },
    });
    await writeAudit(trx, { action: 'password_reset_requested', entity: 'core.users', entityId: user.id, ip: params.ip });
  });
}

export async function resetPasswordWithToken(
  db: Kysely<Database>,
  params: { token: string; newPassword: string; ip: string | null },
): Promise<void> {
  await inTransaction(db, async (trx) => {
    const row = await trx.selectFrom('core.password_reset_tokens').selectAll()
      .where('token_hash', '=', digest(params.token)).forUpdate().executeTakeFirst();
    const usable = row?.used_at === null && row.expires_at.getTime() >= Date.now();
    if (!row || !usable) {
      throw new DomainError('This reset link is invalid or has expired — request a new one');
    }
    const user = await trx.selectFrom('core.users').selectAll().where('id', '=', row.user_id).forUpdate().executeTakeFirstOrThrow();
    if (!user.is_active) throw new DomainError('This reset link is invalid or has expired — request a new one');
    const policy = await readPasswordPolicy(trx);
    const problem = passwordProblem(params.newPassword, policy, user.email);
    if (problem) throw new DomainError(problem);
    await assertNotReused(trx, user.id, params.newPassword, policy.historyDepth, user.password_hash);
    await trx.updateTable('core.password_reset_tokens').set({ used_at: new Date() }).where('id', '=', row.id).execute();
    await storeNewPassword(trx, user.id, user.password_hash, params.newPassword, user.id, false);
    await revokeSessions(trx, user.id, user.id, 'password_reset');
    await writeAudit(trx, { actorUserId: user.id, action: 'password_reset', entity: 'core.users', entityId: user.id, ip: params.ip });
  });
}

/** A temporary password an admin reads out once; the user must change it. */
function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let out = '';
  for (const b of bytes) out += alphabet.charAt(b % alphabet.length);
  return `${out}9a`;
}

export async function adminResetPassword(
  db: Kysely<Database>,
  params: { userId: number; actorUserId: number; ip: string | null },
): Promise<{ temporaryPassword: string }> {
  const temp = temporaryPassword();
  await inTransaction(db, async (trx) => {
    const user = await trx.selectFrom('core.users').selectAll().where('id', '=', params.userId).forUpdate().executeTakeFirst();
    if (!user) throw new NotFoundError('User not found');
    await storeNewPassword(trx, user.id, user.password_hash, temp, params.actorUserId, true);
    await revokeSessions(trx, user.id, params.actorUserId, 'admin_reset');
    await writeAudit(trx, { actorUserId: params.actorUserId, action: 'password_reset_by_admin', entity: 'core.users', entityId: user.id, ip: params.ip });
  });
  return { temporaryPassword: temp };
}

export async function setUserActive(
  db: Kysely<Database>,
  params: { userId: number; active: boolean; actorUserId: number; ip: string | null },
): Promise<void> {
  if (params.userId === params.actorUserId && !params.active) throw new DomainError('You cannot deactivate your own account');
  await inTransaction(db, async (trx) => {
    const user = await trx.selectFrom('core.users').select(['id', 'is_active']).where('id', '=', params.userId).forUpdate().executeTakeFirst();
    if (!user) throw new NotFoundError('User not found');
    await trx.updateTable('core.users').set({
      is_active: params.active, deactivated_at: params.active ? null : new Date(),
      ...(params.active ? { failed_attempts: 0, locked_until: null } : {}),
    }).where('id', '=', user.id).execute();
    if (!params.active) await revokeSessions(trx, user.id, params.actorUserId, 'deactivated');
    await writeAudit(trx, { actorUserId: params.actorUserId, action: params.active ? 'user_activated' : 'user_deactivated', entity: 'core.users', entityId: user.id, ip: params.ip });
  });
}

export async function unlockUser(db: Kysely<Database>, params: { userId: number; actorUserId: number; ip: string | null }) {
  const res = await db.updateTable('core.users').set({ failed_attempts: 0, locked_until: null })
    .where('id', '=', params.userId).executeTakeFirst();
  if (res.numUpdatedRows === 0n) throw new NotFoundError('User not found');
  await writeAudit(db, { actorUserId: params.actorUserId, action: 'user_unlocked', entity: 'core.users', entityId: params.userId, ip: params.ip });
}

export async function createUser(
  db: Kysely<Database>,
  params: { email: string; employeeId: number | null; actorUserId: number; ip: string | null },
): Promise<{ userId: number; temporaryPassword: string }> {
  const temp = temporaryPassword();
  const email = params.email.trim().toLowerCase();
  return inTransaction(db, async (trx) => {
    if (params.employeeId !== null) {
      const emp = await trx.selectFrom('core.employees').select(['id', 'status']).where('id', '=', params.employeeId).executeTakeFirst();
      if (!emp) throw new NotFoundError('Employee not found');
      if (emp.status === 'exited') throw new DomainError('Cannot create a login for an exited employee');
      const existing = await trx.selectFrom('core.users').select('id').where('employee_id', '=', params.employeeId).executeTakeFirst();
      if (existing) throw new DomainError('This employee already has a login');
    }
    const dup = await trx.selectFrom('core.users').select('id').where('email', '=', email).executeTakeFirst();
    if (dup) throw new DomainError('A login with this email already exists');
    const hash = await bcrypt.hash(temp, BCRYPT_COST);
    const row = await trx.insertInto('core.users').values({
      email, password_hash: hash, employee_id: params.employeeId, must_change_password: true,
    }).returning('id').executeTakeFirstOrThrow();
    const employeeRole = await trx.selectFrom('core.roles').select('id').where('code', '=', 'employee').executeTakeFirst();
    if (employeeRole && params.employeeId !== null) {
      await trx.insertInto('core.user_roles').values({ user_id: row.id, role_id: employeeRole.id, scope_org_unit_id: null })
        .onConflict((oc) => oc.doNothing()).execute();
    }
    await writeAudit(trx, { actorUserId: params.actorUserId, action: 'user_created', entity: 'core.users', entityId: row.id, ip: params.ip, newValue: email });
    return { userId: row.id, temporaryPassword: temp };
  });
}

export async function listUsers(db: Kysely<Database>, params: { q?: string | undefined; limit: number }) {
  const q = params.q?.trim();
  return db.selectFrom('core.users as u')
    .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
    .select(['u.id', 'u.email', 'u.is_active', 'u.locked_until', 'u.failed_attempts', 'u.last_login_at',
      'u.must_change_password', 'e.ecode', 'e.first_name', 'e.last_name'])
    .$if(q !== undefined && q !== '', (qb) => qb.where((eb) => eb.or([
      eb('u.email', 'ilike', `%${q ?? ''}%`), eb('e.ecode', 'ilike', `%${q ?? ''}%`),
      eb('e.first_name', 'ilike', `%${q ?? ''}%`), eb('e.last_name', 'ilike', `%${q ?? ''}%`),
    ])))
    .orderBy('u.id').limit(params.limit).execute();
}
