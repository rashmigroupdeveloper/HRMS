/**
 * RBAC admin API — THE control panel for "who can access what" (CORE-10).
 *
 * Grant/revoke a permission to a role, or a role to a user, and every
 * procedure guarded by withPermission() obeys ON THE NEXT REQUEST — no deploy,
 * no restart. Every change is written to the hash-chained audit log.
 *
 * Guarded by 'admin.roles' (it_admin, super_admin per docs/08 §2).
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission, withStepUp } from '../../api/orpc.js';
import {
  assertMayAssignRole,
  assertMayChangeGrant,
  assertNotSelf,
} from './rbac.guard.js';
import { enqueueEvent } from '../notifications/index.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  assignRoleToUser,
  deleteGrant,
  findPermissionByCode,
  findRoleByCode,
  insertGrant,
  listGrants,
  listPermissions,
  listRoles,
  removeRoleFromUser,
  searchUsersWithRoles,
} from './rbac.repository.js';

/**
 * READS of the grid need the permission only. docs/08 §3 gives it_admin a
 * "Users & Roles" screen, and making its landing page demand a password
 * re-entry would train people to type their password more often, not less.
 */
const readGuard = () => withPermission('admin.roles');

/**
 * WRITES need the permission AND step-up (SEC-04, audit W0-T24). Holding the
 * permission answers "may this person ever do this"; step-up answers "is it
 * this person, right now, at this keyboard". Handing out a role is precisely
 * the unattended-laptop case the mechanism exists for.
 */
const guard = () => withStepUp('admin.roles');

const matrixProcedure = readGuard()
  .route({ method: 'GET', path: '/rbac/matrix', summary: 'The live role×permission access matrix' })
  .output(
    z.object({
      roles: z.array(z.object({ code: z.string(), name: z.string() })),
      permissions: z.array(z.string()),
      grants: z.array(
        z.object({
          role: z.string(),
          permission: z.string(),
          scope: z.enum(['all', 'subtree', 'own', 'org_unit', 'readonly']),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const db = context.db;
    const [roles, permissions, grants] = await Promise.all([
      listRoles(db),
      listPermissions(db),
      listGrants(db),
    ]);
    return {
      roles: roles.map((r) => ({ code: r.code, name: r.name })),
      permissions: permissions.map((p) => p.code),
      grants,
    };
  });

const grantInput = z.object({
  role: z.string().min(1),
  permission: z.string().min(1),
  scope: z.enum(['all', 'subtree', 'own', 'org_unit', 'readonly']).default('all'),
});

const grantProcedure = guard()
  .route({ method: 'POST', path: '/rbac/grants', summary: 'Grant a permission to a role (runtime, audited)' })
  .input(grantInput)
  .output(z.object({ changed: z.boolean() }))
  .handler(async ({ input, context }) => {
    const db = context.db;

    const role = await findRoleByCode(db, input.role);
    const permission = await findPermissionByCode(db, input.permission);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });
    if (!permission) throw new ORPCError('NOT_FOUND', { message: `Unknown permission: ${input.permission}` });

    await assertMayChangeGrant(db, context.user.id, input.permission);

    const changed = await insertGrant(db, role.id, permission.id, input.scope);
    if (changed) {
      await enqueueEvent(db, 'rbac.grant_changed', 'rbac_grant_changed', {
        actorUserId: context.user.id,
        role: input.role,
        permission: input.permission,
        change: 'granted',
      });
      await writeAudit(db, {
        actorUserId: context.user.id,
        action: 'grant',
        entity: 'core.role_permissions',
        field: `${input.role}→${input.permission}`,
        newValue: `granted:${input.scope}`,
        ip: context.req.ip ?? null,
      });
    }
    return { changed };
  });

const revokeProcedure = guard()
  .route({ method: 'DELETE', path: '/rbac/grants', summary: 'Revoke a permission from a role (runtime, audited)' })
  .input(grantInput)
  .output(z.object({ changed: z.boolean() }))
  .handler(async ({ input, context }) => {
    const db = context.db;

    const role = await findRoleByCode(db, input.role);
    const permission = await findPermissionByCode(db, input.permission);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });
    if (!permission) throw new ORPCError('NOT_FOUND', { message: `Unknown permission: ${input.permission}` });

    await assertMayChangeGrant(db, context.user.id, input.permission);

    const changed = await deleteGrant(db, role.id, permission.id);
    if (changed) {
      await enqueueEvent(db, 'rbac.grant_changed', 'rbac_grant_changed', {
        actorUserId: context.user.id,
        role: input.role,
        permission: input.permission,
        change: 'revoked',
      });
      await writeAudit(db, {
        actorUserId: context.user.id,
        action: 'revoke',
        entity: 'core.role_permissions',
        field: `${input.role}→${input.permission}`,
        oldValue: 'granted',
        newValue: 'revoked',
        ip: context.req.ip ?? null,
      });
    }
    return { changed };
  });

const assignRoleProcedure = guard()
  .route({ method: 'POST', path: '/rbac/user-roles', summary: 'Assign a role to a user (runtime, audited)' })
  .input(
    z.object({
      userId: z.number().int().positive(),
      role: z.string().min(1),
      scopeOrgUnitId: z.number().int().positive().nullish(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const db = context.db;

    const role = await findRoleByCode(db, input.role);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });

    assertNotSelf(context.user.id, input.userId);
    await assertMayAssignRole(db, context.user.id, role.id, input.role);

    await assignRoleToUser(db, input.userId, role.id, input.scopeOrgUnitId ?? null);
    await writeAudit(db, {
      actorUserId: context.user.id,
      action: 'grant',
      entity: 'core.user_roles',
      entityId: input.userId,
      field: input.role,
      newValue: 'assigned',
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

const removeRoleProcedure = guard()
  .route({ method: 'DELETE', path: '/rbac/user-roles', summary: 'Remove a role from a user (runtime, audited)' })
  .input(z.object({ userId: z.number().int().positive(), role: z.string().min(1) }))
  .output(z.object({ changed: z.boolean() }))
  .handler(async ({ input, context }) => {
    const db = context.db;

    const role = await findRoleByCode(db, input.role);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });

    assertNotSelf(context.user.id, input.userId);
    await assertMayAssignRole(db, context.user.id, role.id, input.role);

    const changed = await removeRoleFromUser(db, input.userId, role.id);
    if (changed) {
      await writeAudit(db, {
        actorUserId: context.user.id,
        action: 'revoke',
        entity: 'core.user_roles',
        entityId: input.userId,
        field: input.role,
        oldValue: 'assigned',
        newValue: 'removed',
        ip: context.req.ip ?? null,
      });
    }
    return { changed };
  });

/** Who can be given a role — the picker behind the access console. */
const usersProcedure = readGuard()
  .route({ method: 'GET', path: '/rbac/users', summary: 'Search users (with their current roles)' })
  .input(z.object({ q: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(25) }))
  .output(
    z.array(
      z.object({
        userId: z.number(),
        email: z.string(),
        ecode: z.string().nullable(),
        name: z.string().nullable(),
        roles: z.array(z.string()),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const rows = await searchUsersWithRoles(context.db, { q: input.q, limit: input.limit });
    return rows.map((r) => {
      const full = [r.first_name, r.last_name].filter((part) => part !== null && part !== '').join(' ');
      return {
        userId: r.user_id,
        email: r.email,
        ecode: r.ecode,
        name: full === '' ? null : full,
        roles: Array.isArray(r.role_codes) ? r.role_codes : [],
      };
    });
  });

export const rbacRouter = {
  matrix: matrixProcedure,
  users: usersProcedure,
  grant: grantProcedure,
  revoke: revokeProcedure,
  assignRole: assignRoleProcedure,
  removeRole: removeRoleProcedure,
};
