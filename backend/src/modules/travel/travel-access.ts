/**
 * Travel data access (C-02 / B-05 / P-23): an employee works on their OWN
 * trips, advances, claims and wallet. Travel desk / payroll (claims.approve,
 * payroll.run.manage) see employees inside their permission scope; a
 * reporting manager may view a direct/indirect report's trip they approve.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { DomainError, ForbiddenError } from '../../core/errors/index.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import { getUserPermissionAccess, getUserPermissions } from '../../core/rbac/permissions.service.js';
import type { PermissionCode } from '../../core/rbac/seed-data.js';

const TRAVEL_ADMIN: PermissionCode[] = ['payroll.run.manage', 'claims.approve'];

export interface TravelActor {
  db: Kysely<Database>;
  user: { id: number; employee_id: number | null };
}

/** Scope of the caller's travel-admin permission, or null for a plain employee. */
async function travelAdminScope(actor: TravelActor): Promise<EmployeeScope | null> {
  const held = await getUserPermissions(actor.db, actor.user.id, 'read');
  const perm = TRAVEL_ADMIN.find((p) => held.has(p));
  if (!perm) return null;
  const access = await getUserPermissionAccess(actor.db, actor.user.id, perm, 'read');
  return access ? { ...access, actorEmployeeId: actor.user.employee_id } : null;
}

export function requireSelf(actor: TravelActor): number {
  if (actor.user.employee_id === null) throw new DomainError('Your account is not linked to an employee record');
  return actor.user.employee_id;
}

async function isManagerOf(db: Kysely<Database>, managerEmployeeId: number | null, employeeId: number): Promise<boolean> {
  if (managerEmployeeId === null) return false;
  const row = await db
    .selectFrom('core.reporting_tree')
    .select(sql<number>`1`.as('x'))
    .where('manager_id', '=', managerEmployeeId)
    .where('employee_id', '=', employeeId)
    .executeTakeFirst();
  return row !== undefined;
}

/** Throws unless the caller may read this employee's travel data. */
export async function assertTravelReadable(actor: TravelActor, employeeId: number, allowManager = false): Promise<void> {
  if (actor.user.employee_id === employeeId) return;
  if (allowManager && (await isManagerOf(actor.db, actor.user.employee_id, employeeId))) return;
  const scope = await travelAdminScope(actor);
  if (!scope) throw new ForbiddenError('You can only access your own travel records');
  await assertEmployeesInScope(actor.db, scope, [employeeId]);
}

/**
 * Resolves which employees a list call may return: an explicit employee (own,
 * or in admin scope), everything in admin scope, or the caller's own records.
 */
export async function resolveListSubject(
  actor: TravelActor,
  requested: number | undefined,
): Promise<{ employeeId?: number; scope?: EmployeeScope; none?: true }> {
  if (requested !== undefined) {
    await assertTravelReadable(actor, requested, true);
    return { employeeId: requested };
  }
  const scope = await travelAdminScope(actor);
  if (scope) return { scope };
  if (actor.user.employee_id === null) return { none: true };
  return { employeeId: actor.user.employee_id };
}
