/** WF-01 / CORE-10: resolve and authorize the same live scoped approvers. */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { Database, WfRequestStepsTable, WfRequestsTable } from '../../core/db/types.js';
import { istDateString } from '../../core/dates.js';
import { workflowPermissionSql, workflowRoleSql } from './workflow-access.js';
type Db = Kysely<Database> | Transaction<Database>;
type StepRow = Selectable<WfRequestStepsTable>;
type RequestRow = Selectable<WfRequestsTable>;

export interface ResolvedApprover {
  userId: number;
  delegatedFrom: number | null;
}

/** Spec → the canonical ACTIVE recipient, with delegation applied. Null = vacant.
 *  For `role:` this is the deterministic first holder who is NOTIFIED; any
 *  holder may still act (see canActOnStep / inbox). */
export async function resolveApprover(db: Db, spec: string, subjectEmployeeId: number, definitionCode: string): Promise<ResolvedApprover | null> {
  let userId: number | null = null;

  if (spec === 'reporting_manager' || spec === 'functional_manager') {
    const col = spec === 'reporting_manager' ? 'reporting_manager_id' : 'functional_manager_id';
    const subject = await db.selectFrom('core.employees').select([col]).where('id', '=', subjectEmployeeId).executeTakeFirst();
    const managerEmployeeId = subject?.[col] ?? null;
    if (managerEmployeeId !== null) {
      const user = await db
        .selectFrom('core.users')
        .select('id')
        .where('employee_id', '=', managerEmployeeId)
        .where('is_active', '=', true)
        .executeTakeFirst();
      userId = user?.id ?? null;
    }
  } else if (spec === 'department_head') {
    userId = await resolveDepartmentHead(db, subjectEmployeeId);
  } else if (spec.startsWith('role:')) {
    const roleCode = spec.slice('role:'.length);
    const candidates = db
      .selectFrom('core.user_roles as ur')
      .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
      .innerJoin('core.users as u', 'u.id', 'ur.user_id')
      .where('r.code', '=', roleCode)
      .where('u.is_active', '=', true)
      .where((eb) => eb.or([eb('u.employee_id', 'is', null), eb('u.employee_id', '!=', subjectEmployeeId)]))
      .select('u.id')
      .orderBy('u.id');
    const user = await candidates.where(workflowRoleSql(sql.ref<number>('u.id'), spec, definitionCode, subjectEmployeeId))
      .executeTakeFirst();
    if (!user && await candidates.executeTakeFirst()) {
      throw new Error('No authorized approver in this role for the employee scope — contact HR');
    }
    userId = user?.id ?? null;
  } else if (spec.startsWith('user:')) {
    const explicit = Number(spec.slice('user:'.length));
    const user = await db
      .selectFrom('core.users')
      .select('id')
      .where('id', '=', explicit)
      .where('is_active', '=', true)
      .executeTakeFirst();
    userId = user?.id ?? null;
  }

  if (userId === null) return null;
  const authorized = await db.selectFrom('core.users').select('id').where('id', '=', userId)
    .where(workflowPermissionSql(userId, definitionCode, subjectEmployeeId)).executeTakeFirst();
  if (!authorized) throw new Error('Configured approver has no current permission for this employee — contact HR');

  // Out-of-office delegation (WF-01): active IST-calendar window today.
  const today = istDateString();
  const delegation = await db
    .selectFrom('wf.delegations')
    .select('to_user_id')
    .where('from_user_id', '=', userId)
    .where('from_date', '<=', today as unknown as Date)
    .where('to_date', '>=', today as unknown as Date)
    .orderBy('id', 'desc')
    .executeTakeFirst();

  if (delegation) {
    const delegate = await db
      .selectFrom('core.users')
      .select('id')
      .where('id', '=', delegation.to_user_id)
      .where('is_active', '=', true)
      // A delegate is never routed a request about themselves (C-07).
      .where((eb) => eb.or([eb('employee_id', 'is', null), eb('employee_id', '!=', subjectEmployeeId)]))
      .executeTakeFirst();
    if (delegate) return { userId: delegate.id, delegatedFrom: userId };
  }
  return { userId, delegatedFrom: null };
}

/**
 * C-02: the subject's head of department — the per-employee override
 * (hod_employee_id) first, else a designated head of the subject's department,
 * company-specific before group-wide, lowest id first. Never the subject.
 */
async function resolveDepartmentHead(db: Db, subjectEmployeeId: number): Promise<number | null> {
  const subject = await db.selectFrom('core.employees')
    .select(['hod_employee_id', 'department_id', 'company_id'])
    .where('id', '=', subjectEmployeeId).executeTakeFirst();
  if (!subject) return null;
  const activeUser = (employeeId: number) => db.selectFrom('core.users').select('id')
    .where('employee_id', '=', employeeId).where('is_active', '=', true).executeTakeFirst();
  if (subject.hod_employee_id !== null) return (await activeUser(subject.hod_employee_id))?.id ?? null;
  if (subject.department_id === null) return null;
  const head = await db.selectFrom('core.department_heads as dh')
    .innerJoin('core.users as u', 'u.employee_id', 'dh.employee_id')
    .innerJoin('core.employees as he', 'he.id', 'dh.employee_id')
    .where('dh.department_id', '=', subject.department_id)
    .where((eb) => eb.or([eb('dh.company_id', 'is', null), eb('dh.company_id', '=', subject.company_id)]))
    .where('dh.employee_id', '!=', subjectEmployeeId)
    .where('u.is_active', '=', true)
    .where('he.status', 'in', ['active', 'on_notice'])
    .select('u.id')
    .orderBy(sql`dh.company_id IS NULL`).orderBy('dh.id')
    .executeTakeFirst();
  return head?.id ?? null;
}

/** May this actor act on this step? The named approver, or (role queue) any
 *  active holder of the step's role. */
export async function canActOnStep(
  db: Db, step: Pick<StepRow, 'approver_user_id' | 'approver_spec' | 'delegated_from'>,
  actorUserId: number, request: RequestRow,
): Promise<boolean> {
  const sourceUserId = step.delegated_from ?? actorUserId;
  const named = sql<boolean>`${step.approver_user_id} = ${actorUserId}
    AND ${workflowPermissionSql(sourceUserId, request.definition_code, request.subject_employee_id)}
    AND (${step.approver_spec ?? ''} NOT LIKE 'role:%'
      OR ${workflowRoleSql(sourceUserId, step.approver_spec ?? '', request.definition_code, request.subject_employee_id)})`;
  const actor = await db.selectFrom('core.users').select('id')
    .where('id', '=', actorUserId).where('is_active', '=', true)
    .where(sql<boolean>`(${named} OR ${workflowRoleSql(actorUserId, step.approver_spec ?? '', request.definition_code, request.subject_employee_id)})`)
    .executeTakeFirst();
  return actor !== undefined;
}

