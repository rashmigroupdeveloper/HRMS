/**
 * THE central authorization check (CORE-10 — the user's centralization rule):
 *
 *   Every protected procedure declares ONE permission code. Whether a role
 *   holds that permission lives in the DATABASE (core.role_permissions),
 *   editable at runtime through the RBAC admin API — no deploy, no restart.
 *   Permissions are read per-request, so a grant/revoke takes effect on the
 *   very next call.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';
import type { PermissionCode, Scope } from './seed-data.js';
import { effectiveRoleGrants } from './effective-role-grants.js';

export interface PermissionAccess {
  all: boolean;
  own: boolean;
  subtree: boolean;
  orgUnitIds: readonly number[];
  /** HOD scope: subjects whose head of department is the actor. */
  department?: boolean;
}

export type PermissionAction = 'read' | 'write';

/** Every permission the user currently holds, via their roles. */
export async function getUserPermissions(
  db: Kysely<Database>,
  userId: number,
  action: PermissionAction = 'read',
): Promise<ReadonlySet<string>> {
  const rows = await db
    .selectFrom(effectiveRoleGrants(userId).as('ur'))
    .innerJoin('core.role_permissions as rp', 'rp.role_id', 'ur.role_id')
    .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
    .$if(action === 'write', query => query.where('rp.scope', '!=', 'readonly'))
    .select('p.code')
    .distinct()
    .execute();
  return new Set(rows.map((r) => r.code));
}

/** Runtime data scope for one permission across all of the user's roles. */
export async function getUserPermissionAccess(
  db: Kysely<Database>,
  userId: number,
  permission: PermissionCode,
  action: PermissionAction = 'read',
): Promise<PermissionAccess | null> {
  const rows = await db
    .selectFrom(effectiveRoleGrants(userId).as('ur'))
    .innerJoin('core.role_permissions as rp', 'rp.role_id', 'ur.role_id')
    .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
    .where('p.code', '=', permission)
    .$if(action === 'write', query => query.where('rp.scope', '!=', 'readonly'))
    .select(['rp.scope', 'ur.scope_org_unit_id'])
    .execute();
  if (rows.length === 0) return null;

  const scopes = new Set<Scope>(rows.map((row) => row.scope));
  const orgUnitIds = [
    ...new Set(
      rows
        // An 'all' grant on an ENTITY-BOUND assignment (scope_org_unit_id set)
        // is bounded to that entity: group scope = role assigned with no unit.
        .filter((row) => row.scope === 'org_unit' || row.scope === 'readonly' || row.scope === 'all')
        .map((row) => row.scope_org_unit_id)
        .filter((id): id is number => id !== null),
    ),
  ];
  return {
    // A readonly grant contributes only to reads, and its assigned unit still
    // bounds those reads. It must never widen an additive scoped write grant.
    all: rows.some(row => (row.scope === 'all' || row.scope === 'readonly') && row.scope_org_unit_id === null),
    own: scopes.has('own'),
    subtree: scopes.has('subtree'),
    orgUnitIds,
    ...(scopes.has('department') ? { department: true } : {}),
  };
}

/** Every role CODE the user currently holds — for workflow role-queues (WF-01):
 *  any holder of a `role:<code>` step may act, not just one designated user. */
export async function getUserRoleCodes(db: Kysely<Database>, userId: number): Promise<ReadonlySet<string>> {
  const rows = await db
    .selectFrom(effectiveRoleGrants(userId).as('ur'))
    .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
    .select('r.code')
    .distinct()
    .execute();
  return new Set(rows.map((r) => r.code));
}
