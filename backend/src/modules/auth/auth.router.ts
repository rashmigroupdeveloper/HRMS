/**
 * Auth procedures: login / refresh / logout / me / ESS-01 forgot-reset.
 * Refresh token travels ONLY as an httpOnly cookie scoped to /api/auth —
 * JavaScript can never read it (docs/02 §1: 15 min access + 7 d refresh).
 */
import { ORPCError } from '@orpc/server';
import type { Response } from 'express';
import { z } from 'zod';
import { authed, base } from '../../api/orpc.js';
import {
  getUserPermissions,
  getUserRoleCodes,
} from '../../core/rbac/permissions.service.js';
import { verifyToken } from '../../core/auth/jwt.js';
import { getMfaStatus } from '../security/index.js';
import { getMfaPolicy } from '../../core/auth/security-policy.js';
import { revokeSession } from '../../core/auth/session.js';
import { login, refresh } from './auth.service.js';
import { requestPasswordReset, resetPasswordWithToken } from './auth.password-reset.js';
import { VIOLATION_MESSAGES } from '../../core/auth/password-policy.js';

const REFRESH_COOKIE = 'hrms_refresh';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE_MS,
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

    const result = await login(
      context.db,
      context.jwtSecret,
      input.identifier,
      input.password,
      context.req.ip ?? null,
      context.req.headers['user-agent'] ?? null,
    );

    if (!result.ok) {
      if (result.reason === 'locked') {
        throw new ORPCError('UNAUTHORIZED', {
          message: `Account temporarily locked. Try again after ${result.lockedUntil?.toISOString() ?? 'a while'}.`,
        });
      }
      // invalid_credentials and inactive answer identically — no account oracle.
      throw new ORPCError('UNAUTHORIZED', { message: 'Invalid email or password' });
    }

    setRefreshCookie(context.res, result.refreshToken, context.secureCookies);
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

    const result = await refresh(context.db, context.jwtSecret, token);
    if (!result.ok) throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired refresh token' });

    setRefreshCookie(context.res, result.refreshToken, context.secureCookies);
    return { accessToken: result.accessToken };
  });

const logoutProcedure = base
  .route({
    method: 'POST',
    path: '/auth/logout',
    summary: 'Clear the refresh cookie AND revoke the session server-side',
  })
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ context }) => {
    // Clearing a cookie a browser may ignore is not a logout. Revoking the
    // session row is (SEC-05) — so a token already in flight stops working too.
    const token = readRefreshCookie(context.req.cookies);
    if (token !== undefined && context.db) {
      const claims = await verifyToken(token, context.jwtSecret);
      if (claims?.sid !== undefined) {
        await revokeSession(context.db, claims.sid, claims.userId, 'signed out');
      }
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
  /** SEC-03 — drives the enrolment home card and the blocking interstitial. */
  mfa: z.object({
    enrolled: z.boolean(),
    required: z.boolean(),
    enforcement: z.enum(['off', 'grace', 'required']),
  }),
  /** SEC-04 — the shell knows whether a step-up modal is still needed. */
  steppedUpUntil: z.string().nullable(),
});

const meProcedure = authed
  .route({
    method: 'GET',
    path: '/auth/me',
    summary: 'The authenticated user plus live roles/permissions (for nav)',
  })
  .output(meOutput)
  .handler(async ({ context }) => {
    const [roles, permissions, mfaStatus, mfaPolicy] = await Promise.all([
      getUserRoleCodes(context.db, context.user.id),
      getUserPermissions(context.db, context.user.id),
      getMfaStatus(context.db, context.user.id),
      getMfaPolicy(context.db),
    ]);
    return {
      id: context.user.id,
      email: context.user.email,
      employeeId: context.user.employee_id,
      roles: [...roles].sort(),
      permissions: [...permissions].sort(),
      mfa: {
        enrolled: mfaStatus.enrolled,
        required: mfaPolicy.requiredRoles.some((role) => roles.has(role)),
        enforcement: mfaPolicy.enforcement,
      },
      steppedUpUntil: context.session.stepped_up_until?.toISOString() ?? null,
    };
  });

const forgotPasswordProcedure = base
  .route({
    method: 'POST',
    path: '/auth/password/forgot',
    summary: 'ESS-01 — request a password-reset link (always ok; no user enumeration)',
  })
  .input(z.object({ identifier: z.string().min(4) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    return requestPasswordReset(context.db, input.identifier, context.req.ip ?? null);
  });

const resetPasswordProcedure = base
  .route({
    method: 'POST',
    path: '/auth/password/reset',
    summary: 'ESS-01 — set a new password with a single-use reset token',
  })
  .input(z.object({ token: z.string().min(1), newPassword: z.string().min(1) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });

    const result = await resetPasswordWithToken(
      context.db,
      input.token,
      input.newPassword,
      context.req.ip ?? null,
    );

    if (!result.ok) {
      if (result.reason === 'expired') {
        throw new ORPCError('BAD_REQUEST', {
          message: 'This reset link has expired. Request a new one from the sign-in page.',
        });
      }
      if (result.reason === 'reused') {
        throw new ORPCError('BAD_REQUEST', {
          message: 'You have used this password before. Choose one you have not used.',
        });
      }
      if (result.reason === 'policy') {
        const messages = (result.violations ?? []).map((v) => VIOLATION_MESSAGES[v]);
        throw new ORPCError('BAD_REQUEST', {
          message: messages.length > 0 ? messages.join(' · ') : 'Password does not meet the policy.',
          data: { violations: result.violations ?? [] },
        });
      }
      throw new ORPCError('BAD_REQUEST', {
        message: 'This reset link is invalid or has already been used.',
      });
    }

    return { ok: true as const };
  });

export const authRouter = {
  login: loginProcedure,
  refresh: refreshProcedure,
  logout: logoutProcedure,
  me: meProcedure,
  forgotPassword: forgotPasswordProcedure,
  resetPassword: resetPasswordProcedure,
};
