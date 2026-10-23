/** WF-01 / CORE-10: resolve and authorize the same live scoped approvers. */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { Database, WfRequestStepsTable, WfRequestsTable } from '../../core/db/types.js';
import { istDateString } from '../../core/dates.js';
import { workflowPermissionSql, workflowRoleSql } from './workflow-access.js';
import { getTypedSetting } from '../settings/index.js';
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
export async function resolveApprover(
  db: Db,
  spec: string,
  subjectEmployeeId: number,
  definitionCode: string,
  requestId?: number,
): Promise<ResolvedApprover | null> {
  let userId: number | null = null;

  if (spec === 'reporting_manager' || spec === 'functional_manager') {
    const col = spec === 'reporting_manager' ? 'reporting_manager_id' : 'functional_manager_id';
    const subject = await db.selectFrom('core.employees').select([col]).where('id', '=', subjectEmployeeId).executeTakeFirst();
    const managerEmployeeId = subject?.[col] ?? null;
    // Applicant is never their own reporting manager (EMS rule & C-07)
    if (managerEmployeeId !== null && managerEmployeeId !== subjectEmployeeId) {
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
  } else if (spec === 'travel_admin') {
    userId = await resolveTravelAdmin(db, subjectEmployeeId);
  } else if (spec === 'travel_sea_manager') {
    userId = await resolveTravelRegionalReviewer(db, 'sea', subjectEmployeeId, requestId);
  } else if (spec === 'travel_africa_reviewer') {
    userId = await resolveTravelRegionalReviewer(db, 'africa', subjectEmployeeId, requestId);
  } else if (spec.startsWith('setting:')) {
    const settingKey = spec.slice('setting:'.length);
    userId = await resolveSettingEmployee(db, settingKey, subjectEmployeeId);
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
    // Holders who cannot act on this employee are vacant. A later step may
    // take the request; an all-vacant round is held for HR (WF-01).
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

  // Applicant self-approval guard (EMS Rule & C-07): applicant is never their own approver
  const applicantUser = await db
    .selectFrom('core.users')
    .select('id')
    .where('employee_id', '=', subjectEmployeeId)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (applicantUser?.id === userId) {
    return null;
  }

  const authorized = await db.selectFrom('core.users').select('id').where('id', '=', userId)
    .where(workflowPermissionSql(userId, definitionCode, subjectEmployeeId)).executeTakeFirst();
  // Onboarding, a revoked role, or a scope miss: the person is named but cannot
  // decide. Vacant — not an error the employee has to retry (WF-01, 16 Oct 2026).
  if (!authorized) return null;

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

/**
 * Resolves the primary Travel/Org Admin approver from core.settings ('te.admin_employee_id').
 * Falls back to super_admin or hr_head when unconfigured.
 */
async function resolveTravelAdmin(db: Db, subjectEmployeeId: number): Promise<number | null> {
  const adminRef = await getTypedSetting<string | null>(db, 'te.admin_employee_id', 'string', null);
  if (adminRef?.trim()) {
    const trimmed = adminRef.trim();
    const emp = await db
      .selectFrom('core.employees')
      .select('id')
      .where((eb) => eb.or([eb('ecode', '=', trimmed), eb('id', '=', Number(trimmed) || 0)]))
      .executeTakeFirst();
    if (emp && emp.id !== subjectEmployeeId) {
      const user = await db
        .selectFrom('core.users')
        .select('id')
        .where('employee_id', '=', emp.id)
        .where('is_active', '=', true)
        .executeTakeFirst();
      if (user) return user.id;
    }
  }
  // Fallback: active user holding super_admin or hr_head role (excluding applicant)
  const candidate = await db
    .selectFrom('core.user_roles as ur')
    .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
    .innerJoin('core.users as u', 'u.id', 'ur.user_id')
    .where('r.code', 'in', ['super_admin', 'hr_head'])
    .where('u.is_active', '=', true)
    .where((eb) => eb.or([eb('u.employee_id', 'is', null), eb('u.employee_id', '!=', subjectEmployeeId)]))
    .select('u.id')
    .orderBy('u.id')
    .executeTakeFirst();
  return candidate?.id ?? null;
}

/**
 * Resolves regional reviewer for SEA or Africa if the request destination matches.
 * If the trip is not in that region or the reviewer is unconfigured, returns null (skips).
 */
async function resolveTravelRegionalReviewer(
  db: Db,
  targetRegion: 'sea' | 'africa',
  subjectEmployeeId: number,
  requestId?: number,
): Promise<number | null> {
  let inRegion = false;
  if (requestId) {
    const req = await db
      .selectFrom('wf.requests')
      .select('payload')
      .where('id', '=', requestId)
      .executeTakeFirst();
    const payload = (req?.payload ?? {}) as Record<string, unknown>;
    const regionValue = payload['destinationRegion'] ?? payload['region'];
    const reg = typeof regionValue === 'string' ? regionValue.toLowerCase() : '';
    inRegion = reg === targetRegion.toLowerCase();
  }
  if (!inRegion) return null;

  const settingKey = targetRegion === 'sea' ? 'te.sea_manager_employee_id' : 'te.africa_reviewer_employee_id';
  const reviewerRef = await getTypedSetting<string | null>(db, settingKey, 'string', null);
  if (!reviewerRef?.trim()) return null;

  const trimmed = reviewerRef.trim();
  const emp = await db
    .selectFrom('core.employees')
    .select('id')
    .where((eb) => eb.or([eb('ecode', '=', trimmed), eb('id', '=', Number(trimmed) || 0)]))
    .executeTakeFirst();
  if (!emp || emp.id === subjectEmployeeId) return null;

  const user = await db
    .selectFrom('core.users')
    .select('id')
    .where('employee_id', '=', emp.id)
    .where('is_active', '=', true)
    .executeTakeFirst();
  return user?.id ?? null;
}

/**
 * Resolves an active user for an employee referenced by a setting key.
 */
async function resolveSettingEmployee(db: Db, settingKey: string, subjectEmployeeId: number): Promise<number | null> {
  const ref = await getTypedSetting<string | null>(db, settingKey, 'string', null);
  if (!ref?.trim()) return null;
  const trimmed = ref.trim();
  const emp = await db
    .selectFrom('core.employees')
    .select('id')
    .where((eb) => eb.or([eb('ecode', '=', trimmed), eb('id', '=', Number(trimmed) || 0)]))
    .executeTakeFirst();
  if (!emp || emp.id === subjectEmployeeId) return null;
  const user = await db
    .selectFrom('core.users')
    .select('id')
    .where('employee_id', '=', emp.id)
    .where('is_active', '=', true)
    .executeTakeFirst();
  return user?.id ?? null;
}

async function isTravelAdminActor(db: Db, actorUserId: number, subjectEmployeeId: number): Promise<boolean> {
  const user = await db
    .selectFrom('core.users')
    .select(['id', 'employee_id'])
    .where('id', '=', actorUserId)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (!user || user.employee_id === subjectEmployeeId) return false;

  const adminRef = await getTypedSetting<string | null>(db, 'te.admin_employee_id', 'string', null);
  if (adminRef?.trim()) {
    const trimmed = adminRef.trim();
    const emp = await db
      .selectFrom('core.employees')
      .select('id')
      .where((eb) => eb.or([eb('ecode', '=', trimmed), eb('id', '=', Number(trimmed) || 0)]))
      .executeTakeFirst();
    if (emp?.id === user.employee_id) return true;
  }
  const hasRole = await db
    .selectFrom('core.user_roles as ur')
    .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
    .where('ur.user_id', '=', actorUserId)
    .where('r.code', 'in', ['super_admin', 'hr_head'])
    .select('r.id')
    .executeTakeFirst();
  return Boolean(hasRole);
}

/** May this actor act on this step? The named approver, or (role queue) any
 *  active holder of the step's role. */
export async function canActOnStep(
  db: Db, step: Pick<StepRow, 'approver_user_id' | 'approver_spec' | 'delegated_from'>,
  actorUserId: number, request: RequestRow,
): Promise<boolean> {
  if (step.approver_spec === 'travel_admin') {
    if (await isTravelAdminActor(db, actorUserId, request.subject_employee_id)) {
      return true;
    }
  }
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

