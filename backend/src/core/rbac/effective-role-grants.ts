/** CORE-10 / docs08 §1: reporting roles are derived, not manually assigned. */
import { sql, type RawBuilder } from 'kysely';

export function effectiveRoleGrants(userId: number | RawBuilder<number>) {
  return sql<{ role_id: number; scope_org_unit_id: number | null }>`(
    SELECT ur.role_id, ur.scope_org_unit_id
      FROM core.user_roles ur
     WHERE ur.user_id = ${userId}
    UNION
    SELECT role.id, NULL::bigint AS scope_org_unit_id
      FROM core.roles role
      JOIN core.users actor ON actor.id = ${userId} AND actor.is_active
      JOIN core.employees manager ON manager.id = actor.employee_id
     WHERE manager.status IN ('active', 'on_notice')
       AND (
         (role.code = 'manager' AND EXISTS (
           SELECT 1 FROM core.reporting_tree tree
            WHERE tree.manager_id = manager.id AND tree.depth = 1
         )) OR
         (role.code = 'senior_manager' AND EXISTS (
           SELECT 1 FROM core.reporting_tree tree
            WHERE tree.manager_id = manager.id AND tree.depth >= 2
         )) OR
         (role.code = 'hod' AND (
           EXISTS (SELECT 1 FROM core.department_heads dh WHERE dh.employee_id = manager.id)
           OR EXISTS (SELECT 1 FROM core.employees sub WHERE sub.hod_employee_id = manager.id)
         ))
       )
  )`;
}
