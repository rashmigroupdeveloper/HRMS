/**
 * Auth procedures: login / refresh / logout / me.
 * Refresh token travels ONLY as an httpOnly cookie scoped to /api/auth —
 * JavaScript can never read it (docs/02 §1: 15 min access + 7 d refresh).
 */
import { ORPCError } from '@orpc/server';
import type { Response } from 'express';
import { z } from 'zod';
import { authed, base, withPermission } from '../../api/orpc.js';
import { verifyToken } from '../../core/auth/jwt.js';
import { ForbiddenError, NotFoundError } from '../../core/errors/index.js';
import {
  getUserPermissions,
  getUserRoleCodes,
} from '../../core/rbac/permissions.service.js';
import { revokeSession } from './auth.sessions.js';
import { verifyStepUp } from './auth.step-up.js';
import { login, refresh } from './auth.service.js';
import {
  adminResetPassword,
  changePassword,
  createUser,
  listUsers,
  requestPasswordReset,
  resetPasswordWithToken,
  setUserActive,
  unlockUser,
} from './auth.passwords.js';

const REFRESH_COOKIE = 'hrms_refresh';

function setRefreshCookie(res: Response, token: string, secure: boolean, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/api/auth',
    expires: expiresAt,
  });
}

function readRefreshCookie(cookies: unknown): string | undefined {
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

const userOutput = z.object({
  id: z.number().int(),
  email: z.string(),
});

const loginProcedure = base
  .route({
    method: 'POST',
    path: '/auth/login',
    summary: 'Password login — identifier is an employee e-code (RML035384) or an email',
  })
  .input(z.object({ identifier: z.string().min(4), password: z.string().min(1) }))
  .output(z.object({ accessToken: z.string(), user: userOutput }))
  .handler(async ({ input, context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });

    const result = await login(context.db, context.jwtSecret, input.identifier, input.password, context.req.ip ?? null, context.req.get('user-agent') ?? null);

    if (!result.ok) {
      // invalid_credentials and inactive answer identically — no account oracle.
      throw new ORPCError('UNAUTHORIZED', { message: 'Invalid email or password' });
    }

    setRefreshCookie(context.res, result.refreshToken, context.secureCookies, result.refreshExpiresAt);
    return {
      accessToken: result.accessToken,
      user: { id: result.user.id, email: result.user.email },
    };
  });

const refreshProcedure = base
  .route({ method: 'POST', path: '/auth/refresh', summary: 'Rotate the refresh token' })
  .output(z.object({ accessToken: z.string() }))
  .handler(async ({ context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });

    const token = readRefreshCookie(context.req.cookies);
    if (token === undefined) throw new ORPCError('UNAUTHORIZED', { message: 'No refresh token' });

    const result = await refresh(context.db, context.jwtSecret, token, context.req.ip ?? null);
    if (!result.ok) throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired refresh token' });

    setRefreshCookie(context.res, result.refreshToken, context.secureCookies, result.refreshExpiresAt);
    return { accessToken: result.accessToken };
  });

const logoutProcedure = base
  .route({ method: 'POST', path: '/auth/logout', summary: 'Revoke this session and clear its refresh cookie' })
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    const header = context.req.headers.authorization;
    const cookie = readRefreshCookie(context.req.cookies);
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    for (const token of new Set([cookie, bearer])) {
      if (token) await revokeSession(context.db, context.jwtSecret, token, context.req.ip ?? null);
    }
    context.res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { ok: true as const };
  });

const meOutput = z.object({
  id: z.number().int(),
  email: z.string(),
  employeeId: z.number().int().nullable(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  mustChangePassword: z.boolean(),
});

const meProcedure = authed
  .route({
    method: 'GET',
    path: '/auth/me',
    summary: 'The authenticated user plus live roles/permissions (for nav)',
  })
  .output(meOutput)
  .handler(async ({ context }) => {
    const [roles, permissions] = await Promise.all([
      getUserRoleCodes(context.db, context.user.id),
      getUserPermissions(context.db, context.user.id),
    ]);
    return {
      id: context.user.id,
      email: context.user.email,
      employeeId: context.user.employee_id,
      roles: [...roles].sort(),
      permissions: [...permissions].sort(),
      mustChangePassword: context.user.must_change_password,
    };
  });

const changePasswordProcedure = authed
  .route({ method: 'POST', path: '/auth/change-password', summary: 'Change your own password (C-34); other sessions are signed out' })
  .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1).max(128) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const header = context.req.headers.authorization;
    const claims = header?.startsWith('Bearer ') ? await verifyToken(header.slice(7), context.jwtSecret) : null;
    await changePassword(context.db, {
      userId: context.user.id, currentPassword: input.currentPassword, newPassword: input.newPassword,
      sid: claims?.sid, ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

const forgotPasswordProcedure = base
  .route({ method: 'POST', path: '/auth/forgot-password', summary: 'E-mail a single-use reset link (same answer whether or not the account exists)' })
  .input(z.object({ identifier: z.string().min(4).max(254) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    await requestPasswordReset(context.db, {
      identifier: input.identifier, ip: context.req.ip ?? null, resetUrlBase: context.appBaseUrl ?? 'http://localhost:5173',
    });
    return { ok: true as const };
  });

const resetPasswordProcedure = base
  .route({ method: 'POST', path: '/auth/reset-password', summary: 'Set a new password with a reset token' })
  .input(z.object({ token: z.string().min(20).max(200), newPassword: z.string().min(1).max(128) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    await resetPasswordWithToken(context.db, { token: input.token, newPassword: input.newPassword, ip: context.req.ip ?? null });
    return { ok: true as const };
  });

/** it_admin may only manage accounts whose roles it holds itself (grant ≤ own level). */
export async function assertManageable(db: Parameters<typeof getUserRoleCodes>[0], actorUserId: number, targetUserId: number) {
  const [mine, theirs] = await Promise.all([getUserRoleCodes(db, actorUserId), getUserRoleCodes(db, targetUserId)]);
  const above = [...theirs].filter((r) => !mine.has(r) && r !== 'employee' && r !== 'manager' && r !== 'senior_manager');
  if (above.length > 0) throw new ForbiddenError(`You cannot manage an account holding ${above.join(', ')}`);
}

const userRow = z.object({
  id: z.number(), email: z.string(), isActive: z.boolean(), locked: z.boolean(), failedAttempts: z.number(),
  lastLoginAt: z.string().nullable(), mustChangePassword: z.boolean(), ecode: z.string().nullable(), name: z.string().nullable(),
});

const listUsersProcedure = withPermission('admin.users')
  .route({ method: 'GET', path: '/auth/users', summary: 'Login accounts (IT admin user lifecycle)' })
  .input(z.object({ q: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }))
  .output(z.array(userRow))
  .handler(async ({ input, context }) => {
    const rows = await listUsers(context.db, input);
    return rows.map((r) => ({
      id: r.id, email: r.email, isActive: r.is_active,
      locked: r.locked_until !== null && r.locked_until.getTime() > Date.now(),
      failedAttempts: r.failed_attempts, lastLoginAt: r.last_login_at?.toISOString() ?? null,
      mustChangePassword: r.must_change_password, ecode: r.ecode,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
    }));
  });

const createUserProcedure = withPermission('admin.users')
  .route({ method: 'POST', path: '/auth/users', summary: 'Create a login (temporary password, forced change on first login)' })
  .input(z.object({ email: z.string().email().max(254), employeeId: z.number().int().positive().nullable().default(null), ecode: z.string().trim().min(1).max(32).optional() }))
  .output(z.object({ userId: z.number(), temporaryPassword: z.string() }))
  .handler(async ({ input, context }) => {
    const { ecode, ...rest } = input;
    let employeeId = rest.employeeId;
    if (ecode !== undefined) {
      const row = await context.db.selectFrom('core.employees').select('id').where('ecode', '=', ecode.toUpperCase()).executeTakeFirst();
      if (!row) throw new NotFoundError(`No employee with e-code ${ecode}`);
      employeeId = row.id;
    }
    return createUser(context.db, { ...rest, employeeId, actorUserId: context.user.id, ip: context.req.ip ?? null });
  });

const setActiveProcedure = withPermission('admin.users')
  .route({ method: 'POST', path: '/auth/users/{userId}/active', summary: 'Activate or deactivate a login (deactivation revokes sessions)' })
  .input(z.object({ userId: z.number().int().positive(), active: z.boolean() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await assertManageable(context.db, context.user.id, input.userId);
    await setUserActive(context.db, { ...input, actorUserId: context.user.id, ip: context.req.ip ?? null });
    return { ok: true as const };
  });

const adminResetProcedure = withPermission('admin.users')
  .route({ method: 'POST', path: '/auth/users/{userId}/reset-password', summary: 'Issue a temporary password (forced change)' })
  .input(z.object({ userId: z.number().int().positive() }))
  .output(z.object({ temporaryPassword: z.string() }))
  .handler(async ({ input, context }) => {
    if (input.userId === context.user.id) throw new ForbiddenError('Use change password for your own account');
    await assertManageable(context.db, context.user.id, input.userId);
    return adminResetPassword(context.db, { userId: input.userId, actorUserId: context.user.id, ip: context.req.ip ?? null });
  });

const unlockProcedure = withPermission('admin.users')
  .route({ method: 'POST', path: '/auth/users/{userId}/unlock', summary: 'Clear a lockout' })
  .input(z.object({ userId: z.number().int().positive() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await assertManageable(context.db, context.user.id, input.userId);
    await unlockUser(context.db, { userId: input.userId, actorUserId: context.user.id, ip: context.req.ip ?? null });
    return { ok: true as const };
  });

const stepUp = withPermission('admin.roles')
  .route({ method: 'POST', path: '/auth/step-up', summary: 'Re-enter password before changing roles or permissions (SEC-04)' })
  .input(z.object({ password: z.string().min(1).max(128) }))
  .output(z.object({ steppedUpUntil: z.string() }))
  .handler(async ({ input, context }) => {
    const result = await verifyStepUp(context.db, context.user.id, context.sessionSid, input.password, context.req.ip ?? null);
    if (!result.ok) throw new ORPCError('BAD_REQUEST', { message: 'Password verification failed. Try again or unlock your account.' });
    return { steppedUpUntil: result.steppedUpUntil };
  });

export const authRouter = {
  stepUp,
  login: loginProcedure,
  refresh: refreshProcedure,
  logout: logoutProcedure,
  me: meProcedure,
  changePassword: changePasswordProcedure,
  forgotPassword: forgotPasswordProcedure,
  resetPassword: resetPasswordProcedure,
  listUsers: listUsersProcedure,
  createUser: createUserProcedure,
  setUserActive: setActiveProcedure,
  adminResetPassword: adminResetProcedure,
  unlockUser: unlockProcedure,
};
