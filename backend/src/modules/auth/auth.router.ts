/**
 * Auth procedures: login / refresh / logout / me.
 * Refresh token travels ONLY as an httpOnly cookie scoped to /api/auth —
 * JavaScript can never read it (docs/02 §1: 15 min access + 7 d refresh).
 */
import { ORPCError } from '@orpc/server';
import type { Response } from 'express';
import { z } from 'zod';
import { authed, base } from '../../api/orpc.js';
import { login, refresh } from './auth.service.js';

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
  .route({ method: 'POST', path: '/auth/login', summary: 'Password login' })
  .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .output(z.object({ accessToken: z.string(), user: userOutput }))
  .handler(async ({ input, context }) => {
    if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });

    const result = await login(context.db, context.jwtSecret, input.email, input.password, context.req.ip ?? null);

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
  .route({ method: 'POST', path: '/auth/logout', summary: 'Clear the refresh cookie' })
  .output(z.object({ ok: z.literal(true) }))
  .handler(({ context }) => {
    context.res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { ok: true as const };
  });

const meProcedure = authed
  .route({ method: 'GET', path: '/auth/me', summary: 'The authenticated user' })
  .output(userOutput)
  .handler(({ context }) => ({
    id: context.user.id,
    email: context.user.email,
  }));

export const authRouter = {
  login: loginProcedure,
  refresh: refreshProcedure,
  logout: logoutProcedure,
  me: meProcedure,
};
