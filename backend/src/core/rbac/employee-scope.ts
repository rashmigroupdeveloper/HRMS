/** Query-time employee scoping for CORE-10 protected data. */
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from '../db/types.js';
import { getUserPermissionAccess, type PermissionAccess } from './permissions.service.js';
import type { PermissionCode } from './seed-data.js';

export interface EmployeeScope extends PermissionAccess {
  actorEmployeeId: number | null;
}

/**
 * THE way a router turns its request context into a data scope. It exists once
 * so that no module can quietly grow its own variant, and so that the type of
 * every scoped repository function points back here.
 *
 * `withPermission()` has already resolved `permissionAccess` for the permission
 * the caller actually holds; this only pairs it with the caller's employee
 * identity, which `own`/`subtree` need.
 */
export function scopeFromContext(context: {
  permissionAccess: PermissionAccess;
  user: { employee_id: number | null };
}): EmployeeScope {
  return { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
}

/**
 * The caller's scope for a DIFFERENT permission than the one gating the route.
 *
 * Needed where the gate and the data are not the same question. Workflow
 * participation, for instance, is `all` for every role — everyone takes part in
 * workflows — so scoping an employee-facing read by it restricts nothing. What
 * governs "may I see facts about this employee" is `employee.read`, and that is
 * what such a read must be narrowed by.
 */
export async function scopeForPermission(
  db: Kysely<Database>,
  userId: number,
  actorEmployeeId: number | null,
  permission: PermissionCode,
): Promise<EmployeeScope> {
  const access = await getUserPermissionAccess(db, userId, permission);
  return access === null
    // Holding nothing means seeing nothing — employeeScopeSql fails closed on
    // this shape, and assertEmployeesInScope refuses.
    ? { all: false, own: false, subtree: false, orgUnitIds: [], actorEmployeeId }
    : { ...access, actorEmployeeId };
}

export function employeeScopeSql(
  scope: EmployeeScope | undefined,
  employeeAlias = 'e',
): RawBuilder<boolean> {
  if (scope === undefined || scope.all) return sql<boolean>`true`;

  const employeeId = sql.ref(`${employeeAlias}.id`);
  const orgUnitId = sql.ref(`${employeeAlias}.org_unit_id`);
  const conditions: RawBuilder<unknown>[] = [];
  if (scope.own && scope.actorEmployeeId !== null) {
    conditions.push(sql`${employeeId} = ${scope.actorEmployeeId}`);
  }
  if (scope.subtree && scope.actorEmployeeId !== null) {
    conditions.push(
      sql`${employeeId} IN (
        SELECT rt.employee_id
          FROM core.reporting_tree rt
         WHERE rt.manager_id = ${scope.actorEmployeeId}
      )`,
    );
  }
  if (scope.orgUnitIds.length > 0) {
    conditions.push(sql`${orgUnitId} IN (${sql.join(scope.orgUnitIds)})`);
  }
  return conditions.length > 0
    ? sql<boolean>`(${sql.join(conditions, sql` OR `)})`
    : sql<boolean>`false`;
}

/**
 * Raised when a caller addresses an employee outside their data scope.
 *
 * A distinct class, not a bare Error, because the API layer has to turn it into
 * the RIGHT status exactly once: a bare Error surfaced as 500, which is both a
 * broken client contract and a hint that something interesting is there.
 */
export class OutOfScopeError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'OutOfScopeError';
  }
}

export async function assertEmployeesInScope(
  db: Kysely<Database>,
  scope: EmployeeScope,
  employeeIds: readonly number[],
): Promise<void> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0 || scope.all) return;
  const row = await db
    .selectFrom('core.employees as e')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('e.id', 'in', ids)
    .where(employeeScopeSql(scope, 'e'))
    .executeTakeFirstOrThrow();
  const allowed = typeof row.n === 'number' ? row.n : Number(row.n);
  if (allowed !== ids.length) {
    // Deliberately the same answer as "no such employee". Telling an
    // out-of-scope caller that the record EXISTS is the oracle W0-T11 closes
    // on the profile endpoint; the same reasoning applies to every subject-
    // addressed endpoint.
    throw new OutOfScopeError();
  }
}
