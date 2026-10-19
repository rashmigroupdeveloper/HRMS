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
import { getUserPermissionAccess, getUserPermissions, type PermissionAction } from '../core/rbac/permissions.service.js';
import type { PermissionCode } from '../core/rbac/seed-data.js';
import { mapError } from '../core/errors/index.js';
import { inTransaction } from '../core/db/database.js';
import { assertStepUp } from '../core/auth/step-up.js';
import { logger } from '../core/logger.js';

/** Per-request context assembled by the Express middleware (handler.ts). */
export interface AppContext {
  db: Kysely<Database> | null;
  jwtSecret: string;
  secureCookies: boolean;
  /** Public SPA origin for e-mailed links. */
  appBaseUrl?: string;
  req: Request;
  res: Response;
}

/**
 * Error firewall (C-20): every procedure runs inside this middleware, so a
 * business-rule refusal thrown as a plain/domain Error becomes a 4xx with its
 * authored message, Postgres errors become friendly 400/409s (raw driver text
 * never leaks), and genuine defects are logged with stack + request id.
 */
export const base = os.$context<AppContext>().use(async ({ context, next, path }) => {
  try {
    return await next();
  } catch (err: unknown) {
    const requestId = (context.req as Request & { id?: string }).id;
    const route = path.join('.');
    if (err instanceof ORPCError) {
      if (err.status >= 500) {
        logger.error({ err, requestId, route, cause: (err as { cause?: unknown }).cause }, 'procedure failed');
      }
      throw err;
    }
    const mapped = mapError(err);
    if (mapped.defect) {
      logger.error({ err, requestId, route }, 'procedure failed with an unexpected error');
    } else {
      logger.info({ requestId, route, status: mapped.status, reason: mapped.message }, 'request refused');
    }
    throw new ORPCError(mapped.code, { message: mapped.message, cause: err });
  }
});

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

  const session = claims.sid ? await context.db.selectFrom('sec.sessions').select('id')
    .where('sid', '=', claims.sid).where('user_id', '=', user.id)
    .where('revoked_at', 'is', null).where('expires_at', '>', new Date()).executeTakeFirst() : undefined;
  if (!session) throw new ORPCError('UNAUTHORIZED', { message: 'Session expired or revoked' });

  // Inject the now-verified user AND a NON-NULL db, so downstream handlers use
  // context.db directly without re-checking (kills the ~27 duplicated guards).
  return next({ context: { user, db: context.db, sessionSid: claims.sid ?? null } });
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
/**
 * Some surfaces are legitimately reachable through MORE THAN ONE permission,
 * because docs/08 §2 defines three parallel report permissions —
 * `reports.hr`, `reports.bu`, `reports.ceo` — granted to different roles for
 * the SAME screens. Gating those on `reports.hr` alone silently killed the
 * "Reports (BU)" nav docs/08 §3 promises plant_head, and the "Reports (read)"
 * it promises ceo_cell.
 *
 * The narrowing still comes from SCOPE, not from the permission: whichever
 * permission the caller holds, `permissionAccess` carries its scope
 * (`org_unit` for plant_head, `all` for hr_head), and the query applies it.
 * This widens WHO may ask, never WHAT they get back.
 */
export function withAnyPermission(...permissions: PermissionCode[]) {
  return authed.use(async ({ context, next, procedure }) => {
    const action = procedure['~orpc'].route.method === 'GET' ? 'read' : 'write';
    const held = await getUserPermissions(context.db, context.user.id, action);
    const matched = permissions.find((code) => held.has(code));
    if (matched === undefined) {
      throw new ORPCError('FORBIDDEN', {
        message: `Missing permission: one of ${permissions.join(', ')}`,
      });
    }
    // Scope comes from the permission the caller actually holds.
    const permissionAccess = await getUserPermissionAccess(context.db, context.user.id, matched, action);
    if (permissionAccess === null) {
      throw new ORPCError('FORBIDDEN', { message: `Missing permission: ${matched}` });
    }
    return next({ context: { permissions: held, permissionAccess } });
  });
}

export function withPermission(
  permission: PermissionCode,
  declaredAction?: PermissionAction,
  authenticateClient?: (context: AppContext) => Promise<number>,
) {
  // Confidential clients prove possession separately, then use the SAME active
  // account and runtime permission gate. They never supply human role claims.
  const principal = authenticateClient
    ? base.use(async ({ context, next }) => {
        if (!context.db) throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'Database unavailable' });
        const userId = await authenticateClient(context);
        const user = await context.db.selectFrom('core.users').selectAll()
          .where('id', '=', userId).where('is_active', '=', true).executeTakeFirst();
        if (!user) throw new ORPCError('UNAUTHORIZED', { message: 'Integration account unavailable' });
        return next({ context: { user, db: context.db, sessionSid: null as string | null } });
      })
    : authed;
  return principal.use(async ({ context, next, procedure }) => {
    // Use the server's procedure contract, never the incoming request verb.
    // Unspecified methods default to POST in oRPC and require write authority.
    // A POST query must explicitly declare 'read' after its handler is audited.
    const action = declaredAction ?? (procedure['~orpc'].route.method === 'GET' ? 'read' : 'write');
    // context.db is already the non-null instance injected by `authed`.
    const permissions = await getUserPermissions(context.db, context.user.id, action);
    if (!permissions.has(permission)) {
      throw new ORPCError('FORBIDDEN', { message: `Missing permission: ${permission}` });
    }
    const permissionAccess = await getUserPermissionAccess(
      context.db,
      context.user.id,
      permission,
      action,
    );
    if (permissionAccess === null) {
      throw new ORPCError('FORBIDDEN', { message: `Missing permission: ${permission}` });
    }
    return next({ context: { permissions, permissionAccess } });
  });
}

/** SEC-04: ordinary runtime permission plus password proof, atomic with mutation. */
export function withStepUp(permission: PermissionCode) {
  return withPermission(permission).use(async ({ context, next }) =>
    inTransaction(context.db, async db => {
      await assertStepUp(db, context.user.id, context.sessionSid);
      return next({ context: { db } });
    }),
  );
}
