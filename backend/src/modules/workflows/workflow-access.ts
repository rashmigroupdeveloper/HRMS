/** WF-01 / CORE-10: one SQL scope rule for resolution, inbox and decisions. */
import { sql, type RawBuilder } from 'kysely';
import { effectiveRoleGrants } from '../../core/rbac/effective-role-grants.js';
import type { PermissionCode } from '../../core/rbac/seed-data.js';

type Id = number | RawBuilder<number>;
type Text = string | RawBuilder<string>;

// docs08 §2: domain approval authority is runtime role-permission DATA.
// Encashment/loan/custom chains have heterogeneous stages; their named/role
// assignments remain authoritative until their per-stage contract is specified.
const DOMAIN_PERMISSION = {
  regularization: 'ar.approve', od: 'od.approve', overtime: 'ot.approve',
  leave: 'leave.approve', comp_off: 'leave.approve',
  leave_cancel: 'leave.approve', restricted_holiday: 'leave.approve',
  // C-16: lifecycle chains are bounded by the approver's data scope too, so an
  // RML-scoped hr_ops can never act on an RGH resignation.
  resignation: 'lifecycle.separation.approve', confirmation: 'lifecycle.confirmation.approve',
  claim: 'claims.approve',
} satisfies Record<string, PermissionCode>;

function requiredPermission(definition: Text) {
  return sql<string | null>`CASE ${definition} ${sql.join(
    Object.entries(DOMAIN_PERMISSION).map(([code, permission]) => sql`WHEN ${code} THEN ${permission}`), sql` `,
  )} ELSE NULL END`;
}

function permittedGrant() {
  return sql<boolean>`(
    -- group scope = 'all' on an unbound assignment; an entity-bound
    -- assignment confines even 'all' grants to that entity's org unit.
    (grant_permission.scope = 'all' AND (grant_role.scope_org_unit_id IS NULL
      OR subject.org_unit_id = grant_role.scope_org_unit_id))
    OR (grant_permission.scope = 'own' AND subject.id = actor.employee_id)
    OR (grant_permission.scope = 'org_unit' AND subject.org_unit_id = grant_role.scope_org_unit_id)
    OR (grant_permission.scope = 'department' AND (subject.hod_employee_id = actor.employee_id OR EXISTS (
      SELECT 1 FROM core.department_heads dh
       WHERE dh.employee_id = actor.employee_id AND dh.department_id = subject.department_id
         AND (dh.company_id IS NULL OR dh.company_id = subject.company_id)
    )))
    OR (grant_permission.scope = 'subtree' AND EXISTS (
      SELECT 1 FROM core.reporting_tree tree
       WHERE tree.manager_id = actor.employee_id AND tree.employee_id = subject.id
    ))
  )`;
}

function employeePermissionSql(userId: Id, permission: RawBuilder<string | null>, subjectId: Id) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM core.users actor
     WHERE actor.id = ${userId} AND actor.is_active
       AND (${permission} IS NULL OR EXISTS (
         SELECT 1 FROM ${effectiveRoleGrants(userId)} grant_role
           JOIN core.role_permissions grant_permission ON grant_permission.role_id = grant_role.role_id
           JOIN core.permissions permission ON permission.id = grant_permission.permission_id
           JOIN core.employees subject ON subject.id = ${subjectId}
          WHERE permission.code = ${permission} AND ${permittedGrant()}
       ))
  )`;
}

export function workflowPermissionSql(userId: Id, definition: Text, subjectId: Id) {
  return employeePermissionSql(userId, requiredPermission(definition), subjectId);
}

/** Routing administration cannot grant consent, and readonly grants cannot repair it. */
export function workflowAdministrationSql(userId: Id, subjectId: Id) {
  return employeePermissionSql(userId, sql<string>`'admin.settings'`, subjectId);
}

/** E2E-004 (RQ-WF-009, O25): routing-hold repair needs admin.settings OR workflow.routing_holds, in scope. */
export function workflowRoutingHoldSql(userId: Id, subjectId: Id) {
  return sql<boolean>`(${workflowAdministrationSql(userId, subjectId)} OR ${employeePermissionSql(userId, sql<string>`'workflow.routing_holds'`, subjectId)})`;
}

export function workflowRoleSql(userId: Id, roleSpec: Text, definition: Text, subjectId: Id) {
  const permission = requiredPermission(definition);
  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${effectiveRoleGrants(userId)} grant_role
      JOIN core.roles role ON role.id = grant_role.role_id
      JOIN core.users actor ON actor.id = ${userId} AND actor.is_active
      JOIN core.employees subject ON subject.id = ${subjectId}
     WHERE ('role:' || role.code) = ${roleSpec}
       AND (
         (${permission} IS NULL AND (grant_role.scope_org_unit_id IS NULL OR grant_role.scope_org_unit_id = subject.org_unit_id))
         OR EXISTS (
           SELECT 1 FROM core.role_permissions grant_permission
             JOIN core.permissions permission ON permission.id = grant_permission.permission_id
            WHERE grant_permission.role_id = grant_role.role_id
              AND permission.code = ${permission} AND ${permittedGrant()}
         )
       )
  )`;
}
