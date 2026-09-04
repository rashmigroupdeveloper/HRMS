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
import { healEmployeeLinkIfNeeded } from '../modules/auth/auth.service.js';
import { getUserPermissionAccess, getUserPermissions } from '../core/rbac/permissions.service.js';
import type { PermissionCode } from '../core/rbac/seed-data.js';
import { findLiveSession, isSteppedUp, touchSession } from '../core/auth/session.js';
import { getSessionPolicy } from '../core/auth/security-policy.js';

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

  // SEC-05 — the token is only half the credential; `sec.sessions` is the
  // other half. This is what makes "sign out everywhere", an admin revoke and
  // the exit-day access cut take effect on the NEXT request rather than
  // whenever the token happens to expire.
  if (claims.sid === undefined) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Session ended — please sign in again' });
  }
  const sessionPolicy = await getSessionPolicy(context.db);
  const session = await findLiveSession(context.db, claims.sid, sessionPolicy.idleMinutes);
  if (session?.user_id !== user.id) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Session ended — please sign in again' });
  }
  await touchSession(context.db, session);

  const linkedUser = await healEmployeeLinkIfNeeded(context.db, user);

  // Inject the now-verified user AND a NON-NULL db, so downstream handlers use
  // context.db directly without re-checking (kills the ~27 duplicated guards).
  return next({ context: { user: linkedUser, db: context.db, session } });
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
  return authed.use(async ({ context, next }) => {
    const held = await getUserPermissions(context.db, context.user.id);
    const matched = permissions.find((code) => held.has(code));
    if (matched === undefined) {
      throw new ORPCError('FORBIDDEN', {
        message: `Missing permission: one of ${permissions.join(', ')}`,
      });
    }
    // Scope comes from the permission the caller actually holds.
    const permissionAccess = await getUserPermissionAccess(context.db, context.user.id, matched);
    if (permissionAccess === null) {
      throw new ORPCError('FORBIDDEN', { message: `Missing permission: ${matched}` });
    }
    return next({ context: { permissions: held, permissionAccess } });
  });
}

export function withPermission(permission: PermissionCode) {
  return authed.use(async ({ context, next }) => {
    // context.db is already the non-null instance injected by `authed`.
    const permissions = await getUserPermissions(context.db, context.user.id);
    if (!permissions.has(permission)) {
      throw new ORPCError('FORBIDDEN', { message: `Missing permission: ${permission}` });
    }
    const permissionAccess = await getUserPermissionAccess(
      context.db,
      context.user.id,
      permission,
    );
    if (permissionAccess === null) {
      throw new ORPCError('FORBIDDEN', { message: `Missing permission: ${permission}` });
    }
    return next({ context: { permissions, permissionAccess } });
  });
}

/**
 * SEC-04 — step-up re-authentication.
 *
 * Use it on anything that reveals or moves money, statutory identifiers, or
 * someone's case file:
 *
 *   withStepUp('employee.statutory_ids.read')
 *
 * Holding the permission answers "may this person ever do this". Step-up
 * answers "is it this person, right now, at this keyboard" — the question an
 * unattended laptop makes urgent.
 */
const STEP_UP_ERROR = {
  message: 'Step-up required',
  data: { code: 'STEP_UP_REQUIRED' },
} as const;

/** Step-up on an authenticated (non-permission-gated) procedure. */
export const authedWithStepUp = authed.use(({ context, next }) => {
  if (!isSteppedUp(context.session)) throw new ORPCError('FORBIDDEN', STEP_UP_ERROR);
  return next();
});

/**
 * Permission AND step-up. The permission is checked first so a caller who may
 * never do this at all is told that, rather than being sent to re-authenticate
 * for something they will still be refused.
 */
export function withStepUp(permission: PermissionCode) {
  return withPermission(permission).use(({ context, next }) => {
    if (!isSteppedUp(context.session)) throw new ORPCError('FORBIDDEN', STEP_UP_ERROR);
    return next();
  });
}
