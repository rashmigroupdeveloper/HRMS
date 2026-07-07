/**
 * oRPC base — docs/14 §3 (DECIDED 6 Jul 2026).
 *
 * Every internal endpoint is an oRPC procedure with zod INPUT AND OUTPUT
 * schemas — the output schema is the runtime firewall against a procedure
 * silently returning a malformed shape. The router emits an OpenAPI spec
 * (/api/openapi.json) — the neutral contract the frontend team generates its
 * typed client from. Frontend never imports backend source.
 */
import { ORPCError, os } from '@orpc/server';
import type { Request, Response } from 'express';
import type { Kysely, Selectable } from 'kysely';
import type { Database, UsersTable } from '../core/db/types.js';
import { verifyToken } from '../core/auth/jwt.js';
import { getUserPermissions } from '../core/rbac/permissions.service.js';
import type { PermissionCode } from '../core/rbac/seed-data.js';

/** Per-request context assembled by the Express middleware (handler.ts). */
export interface AppContext {
  db: Kysely<Database> | null;
  jwtSecret: string;
  secureCookies: boolean;
  req: Request;
  res: Response;
}

export const base = os.$context<AppContext>();

export type AuthedUser = Selectable<UsersTable>;

/**
 * Authenticated procedure base: verifies the Bearer access token, loads the
 * active user, and injects it into context. Every non-public procedure builds
 * on this.
 */
export const authed = base.use(async ({ context, next }) => {
  const header = context.req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (token === undefined || token === '') {
    throw new ORPCError('UNAUTHORIZED', { message: 'Missing access token' });
  }

  const claims = await verifyToken(token, context.jwtSecret);
  if (claims?.typ !== 'access') {
    throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired access token' });
  }

  if (!context.db) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
  }

  const user = await context.db
    .selectFrom('core.users')
    .selectAll()
    .where('id', '=', claims.userId)
    .where('is_active', '=', true)
    .executeTakeFirst();

  if (!user) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Account not found or deactivated' });
  }

  return next({ context: { user } });
});

/**
 * THE central access-control gate (CORE-10). Usage on every protected procedure:
 *
 *   withPermission('admin.settings')
 *     .route({ ... })
 *     .handler(...)
 *
 * The permission→role mapping lives in the DATABASE (core.role_permissions),
 * editable at runtime via the RBAC admin API — grants/revokes take effect on
 * the next request, no deploy. The required permission is also stamped into
 * the OpenAPI description so the contract documents who can call what.
 */
export function withPermission(permission: PermissionCode) {
  return authed.use(async ({ context, next }) => {
    // db is guaranteed by `authed`, but the type allows null — re-narrow.
    if (!context.db) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    }
    const permissions = await getUserPermissions(context.db, context.user.id);
    if (!permissions.has(permission)) {
      throw new ORPCError('FORBIDDEN', {
        message: `Missing permission: ${permission}`,
      });
    }
    return next({ context: { permissions } });
  });
}
