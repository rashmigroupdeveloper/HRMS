/**
 * RBAC admin API — THE control panel for "who can access what" (CORE-10).
 *
 * Grant/revoke a permission to a role, or a role to a user, and every
 * procedure guarded by withPermission() obeys ON THE NEXT REQUEST — no deploy,
 * no restart. Every change is written to the hash-chained audit log.
 *
 * Guarded by 'admin.roles' (it_admin, super_admin per docs/08 §2).
 */
import { assertDelegationCeiling, assertRoleDelegation } from './rbac.guard.js';
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withAnyPermission, withPermission, withStepUp } from '../../api/orpc.js';
import { rowsToExcelBuffer } from '../../core/excel/workbook.js';
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
import { inTransaction } from '../../core/db/database.js';

const guard = () => withStepUp('admin.roles');

/** E2E-005 (RQ-RBAC-008): hr_head reviews the matrix read-only (admin.rbac.read); editing stays admin.roles. */
const readGuard = () => withAnyPermission('admin.roles', 'admin.rbac.read');

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
          scope: z.enum(['all', 'subtree', 'own', 'org_unit', 'readonly', 'department']),
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

const matrixExport = readGuard()
  .route({ method: 'GET', path: '/rbac/matrix/export', summary: 'Access matrix as an Excel workbook (one row per permission, one column per role)' })
  .output(z.object({ filename: z.string(), base64: z.string() }))
  .handler(async ({ context }) => {
    const [roles, permissions, grants] = await Promise.all([listRoles(context.db), listPermissions(context.db), listGrants(context.db)]);
    const cell = new Map(grants.map((g) => [`${g.role}|${g.permission}`, g.scope]));
    const columns = [{ header: 'Permission', key: '__perm', width: 34 }, ...roles.map((r) => ({ header: r.name, key: r.code, width: 14 }))];
    const rows = permissions.map((p) => Object.fromEntries([['__perm', p.code], ...roles.map((r) => [r.code, cell.get(`${r.code}|${p.code}`) ?? ''])]) as Record<string, string>);
    const buf = await rowsToExcelBuffer('Access matrix', columns, rows);
    return { filename: `access-matrix-${new Date().toISOString().slice(0, 10)}.xlsx`, base64: buf.toString('base64') };
  });

const grantInput = z.object({
  role: z.string().min(1),
  permission: z.string().min(1),
  scope: z.enum(['all', 'subtree', 'own', 'org_unit', 'readonly', 'department']).default('all'),
});

const grantProcedure = guard()
  .route({ method: 'POST', path: '/rbac/grants', summary: 'Grant a permission to a role (runtime, audited)' })
  .input(grantInput)
  .output(z.object({ changed: z.boolean() }))
  .handler(async ({ input, context }) => {
    return inTransaction(context.db, async (db) => {

    const role = await findRoleByCode(db, input.role);
    const permission = await findPermissionByCode(db, input.permission);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });
    if (!permission) throw new ORPCError('NOT_FOUND', { message: `Unknown permission: ${input.permission}` });

    await assertDelegationCeiling(db, context.user.id, [permission.id]);
    const changed = await insertGrant(db, role.id, permission.id, input.scope);
    if (changed) {
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
  });

const revokeProcedure = guard()
  .route({ method: 'DELETE', path: '/rbac/grants', summary: 'Revoke a permission from a role (runtime, audited)' })
  .input(grantInput)
  .output(z.object({ changed: z.boolean() }))
  .handler(async ({ input, context }) => {
    return inTransaction(context.db, async (db) => {

    const role = await findRoleByCode(db, input.role);
    const permission = await findPermissionByCode(db, input.permission);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });
    if (!permission) throw new ORPCError('NOT_FOUND', { message: `Unknown permission: ${input.permission}` });

    await assertDelegationCeiling(db, context.user.id, [permission.id]);
    const changed = await deleteGrant(db, role.id, permission.id);
    if (changed) {
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
  });

/** Roles whose authority is one entity (docs/08 §2); a grant must name the org unit.
 *  payroll_admin is not in this set: a super admin chooses one entity or the whole group. */
const ENTITY_SCOPED_ROLES = new Set(['hr_ops', 'plant_head']);
/** These roles always cover the whole group. An org unit must not narrow them. */
const GROUP_ROLES = new Set(['super_admin', 'it_admin', 'hr_head', 'ceo_cell']);

/** Payroll is not locked to one entity. Omitting the choice stays a 400 so a blank form never becomes group-wide. */
function resolveAssignmentScope(
  role: string,
  coverage: 'group' | 'entity' | undefined,
  scopeOrgUnitId: number | null,
): number | null {
  if (GROUP_ROLES.has(role)) {
    if (scopeOrgUnitId !== null) {
      throw new ORPCError('BAD_REQUEST', { message: `${role} covers the whole group. Do not attach an entity.` });
    }
    return null;
  }
  if (role === 'payroll_admin') {
    if (coverage === 'group') {
      if (scopeOrgUnitId !== null) {
        throw new ORPCError('BAD_REQUEST', { message: 'Whole-group payroll does not take an entity' });
      }
      return null;
    }
    if (coverage === 'entity') {
      if (scopeOrgUnitId === null) {
        throw new ORPCError('BAD_REQUEST', { message: 'Choose the entity this payroll grant covers' });
      }
      return scopeOrgUnitId;
    }
    throw new ORPCError('BAD_REQUEST', { message: 'Choose whole group or one entity for payroll_admin' });
  }
  if (ENTITY_SCOPED_ROLES.has(role) && scopeOrgUnitId === null) {
    throw new ORPCError('BAD_REQUEST', { message: `${role} is entity-scoped: choose the org unit (company) this grant covers` });
  }
  return scopeOrgUnitId;
}

function readAssignments(value: unknown): { code: string; scopeOrgUnitId: number | null; scopeName: string | null }[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const assignments: { code: string; scopeOrgUnitId: number | null; scopeName: string | null }[] = [];
  for (const row of parsed) {
    if (typeof row !== 'object' || row === null || !('code' in row)) continue;
    const code = row.code;
    if (typeof code !== 'string') continue;
    const rawId = 'scopeOrgUnitId' in row ? row.scopeOrgUnitId : null;
    const asNumber = rawId === null || rawId === undefined ? null : Number(rawId);
    const rawName = 'scopeName' in row ? row.scopeName : null;
    assignments.push({
      code,
      scopeOrgUnitId: asNumber !== null && Number.isFinite(asNumber) ? asNumber : null,
      scopeName: typeof rawName === 'string' ? rawName : null,
    });
  }
  return assignments;
}

const assignRoleProcedure = guard()
  .route({ method: 'POST', path: '/rbac/user-roles', summary: 'Assign a role to a user (runtime, audited)' })
  .input(
    z.object({
      userId: z.number().int().positive(),
      role: z.string().min(1),
      scopeOrgUnitId: z.number().int().positive().nullish(),
      coverage: z.enum(['group', 'entity']).optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    return inTransaction(context.db, async (db) => {

    const role = await findRoleByCode(db, input.role);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });

    await assertRoleDelegation(db, context.user.id, input.userId, role.id);
    const scopeOrgUnitId = resolveAssignmentScope(input.role, input.coverage, input.scopeOrgUnitId ?? null);
    await assignRoleToUser(db, input.userId, role.id, scopeOrgUnitId);
    await writeAudit(db, {
      actorUserId: context.user.id,
      action: 'grant',
      entity: 'core.user_roles',
      entityId: input.userId,
      field: input.role,
      newValue: scopeOrgUnitId === null ? 'assigned:group' : `assigned:org-unit:${String(scopeOrgUnitId)}`,
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
    });
  });

const removeRoleProcedure = guard()
  .route({ method: 'DELETE', path: '/rbac/user-roles', summary: 'Remove a role from a user (runtime, audited)' })
  .input(z.object({ userId: z.number().int().positive(), role: z.string().min(1) }))
  .output(z.object({ changed: z.boolean() }))
  .handler(async ({ input, context }) => {
    return inTransaction(context.db, async (db) => {

    const role = await findRoleByCode(db, input.role);
    if (!role) throw new ORPCError('NOT_FOUND', { message: `Unknown role: ${input.role}` });

    await assertRoleDelegation(db, context.user.id, input.userId, role.id);
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
  });

/** Who can be given a role — the picker behind the access console. */
const usersProcedure = withPermission('admin.roles')
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
        assignments: z.array(z.object({
          code: z.string(),
          scopeOrgUnitId: z.number().nullable(),
          scopeName: z.string().nullable(),
        })),
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
        assignments: readAssignments(r.assignments),
      };
    });
  });

export const rbacRouter = {
  matrix: matrixProcedure,
  matrixExport,
  users: usersProcedure,
  grant: grantProcedure,
  revoke: revokeProcedure,
  assignRole: assignRoleProcedure,
  removeRole: removeRoleProcedure,
};
