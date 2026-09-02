/** Query-time employee scoping for CORE-10 protected data. */
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from '../db/types.js';
import type { PermissionAccess } from './permissions.service.js';

export interface EmployeeScope extends PermissionAccess {
  actorEmployeeId: number | null;
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
    throw new Error('One or more employees are outside your permitted data scope');
  }
}
