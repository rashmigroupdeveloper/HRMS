/**
 * Employee Movement & Transfers Service (LC-05, SOW crosswalk, SOW crosswalk).
 *
 * Implements:
 * 1. 4 distinct transfer types:
 *    - Department / Unit Transfer
 *    - Location / Plant Transfer
 *    - Inter-Entity Transfer (Company Movement with new target e-code, leave continuity, and payroll transition)
 *    - Promotion / Designation Change (updates grade/designation and triggers salary revision)
 * 2. Immutable history tracking in core.employee_history.
 * 3. Historical organization state reconstruction as-of any past date.
 */

import { sql, type Kysely } from 'kysely';
import type {
  Database,
  TransferStatus,
  TransferType,
} from '../../../core/db/types.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { formatDbDate } from '../../../core/dates.js';
import { allocateEmployeeCode } from '../../../core/employee-code.js';

export interface CreateTransferInput {
  employeeId: number;
  transferType: TransferType;
  effectiveDate: string; // YYYY-MM-DD
  targetCompanyId?: number | null | undefined;
  targetDepartmentId?: number | null | undefined;
  targetLocationId?: number | null | undefined;
  targetDesignationId?: number | null | undefined;
  targetGradeId?: number | null | undefined;
  targetReportingManagerId?: number | null | undefined;
  salaryRevisionAmount?: number | null | undefined; // Revised CTC in rupees
  leaveTreatment?: 'transfer' | 'encash' | undefined;
  reason: string;
  remarks?: string | null | undefined;
}

export interface TransferRecord {
  id: number;
  employeeId: number;
  ecode: string;
  employeeName: string;
  transferType: TransferType;
  effectiveDate: string;
  status: TransferStatus;
  currentCompanyId: number;
  currentCompanyName: string;
  targetCompanyId: number | null;
  targetCompanyName: string | null;
  currentDepartmentId: number | null;
  currentDepartmentName: string | null;
  targetDepartmentId: number | null;
  targetDepartmentName: string | null;
  currentLocationId: number | null;
  currentLocationName: string | null;
  targetLocationId: number | null;
  targetLocationName: string | null;
  currentDesignationId: number | null;
  currentDesignationName: string | null;
  targetDesignationId: number | null;
  targetDesignationName: string | null;
  currentGradeId: number | null;
  currentGradeName: string | null;
  targetGradeId: number | null;
  targetGradeName: string | null;
  currentReportingManagerId: number | null;
  currentReportingManagerName: string | null;
  targetReportingManagerId: number | null;
  targetReportingManagerName: string | null;
  currentEcode: string;
  targetEcode: string | null;
  salaryRevisionAmount: number | null;
  leaveTreatment: 'transfer' | 'encash';
  reason: string;
  remarks: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
}

export interface EmployeeHistoryEntry {
  id: number;
  employeeId: number;
  effectiveDate: string;
  changeType: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  referenceId: number | null;
  createdAt: string;
}

export interface EmployeeAsOfState {
  employeeId: number;
  asOfDate: string;
  ecode: string;
  companyId: number;
  departmentId: number | null;
  locationId: number | null;
  designationId: number | null;
  gradeId: number | null;
  reportingManagerId: number | null;
}

function toDateString(d: unknown): string {
  if (d instanceof Date) return formatDbDate(d);
  if (typeof d === 'string') return d.slice(0, 10);
  throw new Error('Invalid transfer date stored in the database');
}

function toIsoString(d: unknown): string | null {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'string') return d;
  return null;
}

/**
 * Generate a new unique e-code for an inter-entity transfer based on target company code series.
 */
export async function generateTargetEcode(
  db: Kysely<Database>,
  targetCompanyId: number,
): Promise<string> {
  return allocateEmployeeCode(db, targetCompanyId);
}

/**
 * Create a new transfer or promotion request.
 */
export async function createTransferRequest(
  db: Kysely<Database>,
  input: CreateTransferInput,
  actorUserId: number,
  ip: string | null = null,
): Promise<{ id: number; targetEcode: string | null }> {
  const emp = await db
    .selectFrom('core.employees')
    .select([
      'id',
      'ecode',
      'company_id',
      'department_id',
      'location_id',
      'designation_id',
      'grade_id',
      'reporting_manager_id',
      'status',
    ])
    .where('id', '=', input.employeeId)
    .executeTakeFirst();

  if (!emp) throw new Error(`Employee #${input.employeeId} not found`);
  if (emp.status === 'exited') throw new Error(`Cannot transfer exited employee ${emp.ecode}`);

  let targetEcode: string | null = null;
  if (input.transferType === 'inter_entity') {
    if (!input.targetCompanyId) throw new Error('Target company is required for inter-entity transfer');
    if (input.targetCompanyId === emp.company_id) {
      throw new Error('Target company must be different from current company for inter-entity transfer');
    }
    targetEcode = await generateTargetEcode(db, input.targetCompanyId);
  }

  const inserted = await db
    .insertInto('core.transfers')
    .values({
      employee_id: emp.id,
      transfer_type: input.transferType,
      effective_date: sql<Date>`${input.effectiveDate}::date` as unknown as Date,
      status: 'pending',
      current_company_id: emp.company_id,
      current_department_id: emp.department_id,
      current_location_id: emp.location_id,
      current_designation_id: emp.designation_id,
      current_grade_id: emp.grade_id,
      current_reporting_manager_id: emp.reporting_manager_id,
      current_ecode: emp.ecode,
      target_company_id: input.targetCompanyId ?? null,
      target_department_id: input.targetDepartmentId ?? null,
      target_location_id: input.targetLocationId ?? null,
      target_designation_id: input.targetDesignationId ?? null,
      target_grade_id: input.targetGradeId ?? null,
      target_reporting_manager_id: input.targetReportingManagerId ?? null,
      target_ecode: targetEcode,
      salary_revision_amount:
        input.salaryRevisionAmount !== null && input.salaryRevisionAmount !== undefined
          ? String(input.salaryRevisionAmount)
          : null,
      leave_treatment: input.leaveTreatment ?? 'transfer',
      reason: input.reason,
      remarks: input.remarks ?? null,
      created_by: actorUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId,
    action: 'create',
    entity: 'core.transfers',
    entityId: inserted.id,
    field: input.transferType,
    newValue: JSON.stringify({
      employeeId: emp.id,
      transferType: input.transferType,
      effectiveDate: input.effectiveDate,
      targetEcode,
    }),
    ip,
  });

  return { id: inserted.id, targetEcode };
}

/**
 * Approve and execute a transfer request.
 * Writes immutable entries into core.employee_history and updates core.employees master.
 */
export async function approveTransferRequest(
  db: Kysely<Database>,
  transferId: number,
  actorUserId: number,
  ip: string | null = null,
): Promise<{ success: boolean; newEcode: string | null }> {
  return await db.transaction().execute(async (trx) => {
    const transfer = await trx
      .selectFrom('core.transfers')
      .selectAll()
      .where('id', '=', transferId)
      .executeTakeFirst();

    if (!transfer) throw new Error(`Transfer request #${transferId} not found`);
    if (transfer.status !== 'pending') {
      throw new Error(`Transfer #${transferId} is not pending (status: ${transfer.status})`);
    }

    const emp = await trx
      .selectFrom('core.employees')
      .selectAll()
      .where('id', '=', transfer.employee_id)
      .executeTakeFirst();

    if (!emp) throw new Error(`Employee #${transfer.employee_id} not found`);

    const effectiveDateStr = toDateString(transfer.effective_date);
    const effectiveDateSql = sql<Date>`${effectiveDateStr}::date` as unknown as Date;

    // 1. Record changes in core.employee_history for every changed field
    const historyEntries: {
      field: string;
      oldVal: string | null;
      newVal: string | null;
      changeType: string;
    }[] = [];

    // Department transfer
    if (
      transfer.target_department_id !== null &&
      transfer.target_department_id !== transfer.current_department_id
    ) {
      historyEntries.push({
        field: 'department_id',
        oldVal: transfer.current_department_id ? String(transfer.current_department_id) : null,
        newVal: String(transfer.target_department_id),
        changeType: 'transfer_department',
      });
    }

    // Location transfer
    if (
      transfer.target_location_id !== null &&
      transfer.target_location_id !== transfer.current_location_id
    ) {
      historyEntries.push({
        field: 'location_id',
        oldVal: transfer.current_location_id ? String(transfer.current_location_id) : null,
        newVal: String(transfer.target_location_id),
        changeType: 'transfer_location',
      });
    }

    // Designation promotion/change
    if (
      transfer.target_designation_id !== null &&
      transfer.target_designation_id !== transfer.current_designation_id
    ) {
      historyEntries.push({
        field: 'designation_id',
        oldVal: transfer.current_designation_id ? String(transfer.current_designation_id) : null,
        newVal: String(transfer.target_designation_id),
        changeType: 'promotion',
      });
    }

    // Grade promotion/change
    if (
      transfer.target_grade_id !== null &&
      transfer.target_grade_id !== transfer.current_grade_id
    ) {
      historyEntries.push({
        field: 'grade_id',
        oldVal: transfer.current_grade_id ? String(transfer.current_grade_id) : null,
        newVal: String(transfer.target_grade_id),
        changeType: 'promotion',
      });
    }

    // Reporting manager change
    if (
      transfer.target_reporting_manager_id !== null &&
      transfer.target_reporting_manager_id !== transfer.current_reporting_manager_id
    ) {
      historyEntries.push({
        field: 'reporting_manager_id',
        oldVal: transfer.current_reporting_manager_id
          ? String(transfer.current_reporting_manager_id)
          : null,
        newVal: String(transfer.target_reporting_manager_id),
        changeType: 'manager_change',
      });
    }

    // Inter-entity transfer: company and ecode change
    let allocatedEcode = transfer.target_ecode;
    if (
      transfer.target_company_id !== null &&
      transfer.target_company_id !== transfer.current_company_id
    ) {
      if (allocatedEcode === null || allocatedEcode === '') {
        allocatedEcode = await generateTargetEcode(trx, transfer.target_company_id);
      }

      historyEntries.push({
        field: 'company_id',
        oldVal: String(transfer.current_company_id),
        newVal: String(transfer.target_company_id),
        changeType: 'transfer_entity',
      });

      historyEntries.push({
        field: 'ecode',
        oldVal: transfer.current_ecode,
        newVal: allocatedEcode,
        changeType: 'transfer_entity',
      });
    }

    // Insert all history entries into core.employee_history
    for (const h of historyEntries) {
      await trx
        .insertInto('core.employee_history')
        .values({
          employee_id: emp.id,
          effective_date: effectiveDateSql,
          change_type: h.changeType,
          field: h.field,
          old_value: h.oldVal,
          new_value: h.newVal,
          reference_id: transfer.id,
        })
        .execute();
    }

    // 2. Promotion with salary revision handling
    if (
      transfer.transfer_type === 'promotion' &&
      transfer.salary_revision_amount !== null &&
      Number(transfer.salary_revision_amount) > 0
    ) {
      // Append a salary revision row in core.employee_history
      await trx
        .insertInto('core.employee_history')
        .values({
          employee_id: emp.id,
          effective_date: effectiveDateSql,
          change_type: 'promotion',
          field: 'salary_revision_ctc',
          old_value: null,
          new_value: transfer.salary_revision_amount,
          reference_id: transfer.id,
        })
        .execute();
    }

    // 3. Update core.employees master record with target values
    const employeeUpdates: Record<string, unknown> = {
      updated_at: sql`now()`,
    };

    if (transfer.target_department_id !== null) {
      employeeUpdates['department_id'] = transfer.target_department_id;
    }
    if (transfer.target_location_id !== null) {
      employeeUpdates['location_id'] = transfer.target_location_id;
    }
    if (transfer.target_designation_id !== null) {
      employeeUpdates['designation_id'] = transfer.target_designation_id;
    }
    if (transfer.target_grade_id !== null) {
      employeeUpdates['grade_id'] = transfer.target_grade_id;
    }
    if (transfer.target_reporting_manager_id !== null) {
      employeeUpdates['reporting_manager_id'] = transfer.target_reporting_manager_id;
    }
    if (transfer.target_company_id !== null) {
      employeeUpdates['company_id'] = transfer.target_company_id;
      if (allocatedEcode) {
        employeeUpdates['ecode'] = allocatedEcode;
      }
    }

    await trx
      .updateTable('core.employees')
      .set(employeeUpdates)
      .where('id', '=', emp.id)
      .execute();

    // 4. Update transfer request status to completed
    await trx
      .updateTable('core.transfers')
      .set({
        status: 'completed',
        target_ecode: allocatedEcode,
        approved_by: actorUserId,
        approved_at: sql`now()`,
        notified_at: sql`now()`,
        updated_at: sql`now()`,
      })
      .where('id', '=', transfer.id)
      .execute();

    await writeAudit(trx, {
      actorUserId,
      action: 'update',
      entity: 'core.transfers',
      entityId: transfer.id,
      field: 'status',
      oldValue: 'pending',
      newValue: 'completed',
      ip,
    });

    return { success: true, newEcode: allocatedEcode };
  });
}

/**
 * Reject a transfer request.
 */
export async function rejectTransferRequest(
  db: Kysely<Database>,
  transferId: number,
  remarks: string,
  actorUserId: number,
  ip: string | null = null,
): Promise<{ success: boolean }> {
  const transfer = await db
    .selectFrom('core.transfers')
    .select(['id', 'status'])
    .where('id', '=', transferId)
    .executeTakeFirst();

  if (!transfer) throw new Error(`Transfer #${transferId} not found`);
  if (transfer.status !== 'pending') {
    throw new Error(`Transfer #${transferId} is not pending (status: ${transfer.status})`);
  }

  await db
    .updateTable('core.transfers')
    .set({
      status: 'rejected',
      remarks,
      approved_by: actorUserId,
      approved_at: sql`now()`,
      updated_at: sql`now()`,
    })
    .where('id', '=', transferId)
    .execute();

  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'core.transfers',
    entityId: transferId,
    field: 'status',
    oldValue: 'pending',
    newValue: 'rejected',
    ip,
  });

  return { success: true };
}

/**
 * Get the full history timeline for an employee from core.employee_history.
 */
export async function getEmployeeHistoryTimeline(
  db: Kysely<Database>,
  employeeId: number,
): Promise<EmployeeHistoryEntry[]> {
  const rows = await db
    .selectFrom('core.employee_history')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .orderBy('effective_date', 'desc')
    .orderBy('id', 'desc')
    .execute();

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    effectiveDate: toDateString(r.effective_date),
    changeType: r.change_type,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    referenceId: r.reference_id ?? null,
    createdAt: toIsoString(r.created_at) ?? '',
  }));
}

/**
 * Reconstruct employee organization state as-of any past date (LC-05, SOW-029..031).
 * Walks back history entries where effective_date > asOfDate.
 */
export async function getEmployeeAsOfDate(
  db: Kysely<Database>,
  employeeId: number,
  asOfDate: string, // YYYY-MM-DD
): Promise<EmployeeAsOfState> {
  const current = await db
    .selectFrom('core.employees')
    .select([
      'id',
      'ecode',
      'company_id',
      'department_id',
      'location_id',
      'designation_id',
      'grade_id',
      'reporting_manager_id',
    ])
    .where('id', '=', employeeId)
    .executeTakeFirst();

  if (!current) throw new Error(`Employee #${employeeId} not found`);

  // Fetch all history rows strictly after the asOfDate, ordered descending by effective date and id
  const futureChanges = await db
    .selectFrom('core.employee_history')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .where('effective_date', '>', sql<Date>`${asOfDate}::date` as unknown as Date)
    .orderBy('effective_date', 'desc')
    .orderBy('id', 'desc')
    .execute();

  const state: EmployeeAsOfState = {
    employeeId: current.id,
    asOfDate,
    ecode: current.ecode,
    companyId: current.company_id,
    departmentId: current.department_id,
    locationId: current.location_id,
    designationId: current.designation_id,
    gradeId: current.grade_id,
    reportingManagerId: current.reporting_manager_id,
  };

  // Revert each field backwards to old_value
  for (const change of futureChanges) {
    switch (change.field) {
      case 'ecode':
        if (change.old_value !== null) state.ecode = change.old_value;
        break;
      case 'company_id':
        if (change.old_value !== null) state.companyId = Number(change.old_value);
        break;
      case 'department_id':
        state.departmentId = change.old_value !== null ? Number(change.old_value) : null;
        break;
      case 'location_id':
        state.locationId = change.old_value !== null ? Number(change.old_value) : null;
        break;
      case 'designation_id':
        state.designationId = change.old_value !== null ? Number(change.old_value) : null;
        break;
      case 'grade_id':
        state.gradeId = change.old_value !== null ? Number(change.old_value) : null;
        break;
      case 'reporting_manager_id':
        state.reportingManagerId = change.old_value !== null ? Number(change.old_value) : null;
        break;
    }
  }

  return state;
}

/**
 * List transfer requests with filters.
 */
export async function listTransfers(
  db: Kysely<Database>,
  params: {
    employeeId?: number | undefined;
    companyId?: number | undefined;
    transferType?: TransferType | undefined;
    status?: TransferStatus | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  },
): Promise<{ rows: TransferRecord[]; total: number }> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const countQuery = db
    .selectFrom('core.transfers')
    .select(db.fn.count<number>('id').as('cnt'))
    .$if(params.employeeId !== undefined, (qb) => params.employeeId === undefined ? qb : qb.where('employee_id', '=', params.employeeId))
    .$if(params.companyId !== undefined, (qb) => params.companyId === undefined ? qb : qb.where('current_company_id', '=', params.companyId))
    .$if(params.transferType !== undefined, (qb) => params.transferType === undefined ? qb : qb.where('transfer_type', '=', params.transferType))
    .$if(params.status !== undefined, (qb) => params.status === undefined ? qb : qb.where('status', '=', params.status));

  const countResult = await countQuery.executeTakeFirst();
  const total = countResult?.cnt ?? 0;

  const rows = await db
    .selectFrom('core.transfers as t')
    .innerJoin('core.employees as e', 'e.id', 't.employee_id')
    .innerJoin('core.companies as c_cur', 'c_cur.id', 't.current_company_id')
    .leftJoin('core.companies as c_tgt', 'c_tgt.id', 't.target_company_id')
    .leftJoin('core.departments as d_cur', 'd_cur.id', 't.current_department_id')
    .leftJoin('core.departments as d_tgt', 'd_tgt.id', 't.target_department_id')
    .leftJoin('core.locations as l_cur', 'l_cur.id', 't.current_location_id')
    .leftJoin('core.locations as l_tgt', 'l_tgt.id', 't.target_location_id')
    .leftJoin('core.designations as des_cur', 'des_cur.id', 't.current_designation_id')
    .leftJoin('core.designations as des_tgt', 'des_tgt.id', 't.target_designation_id')
    .leftJoin('core.grades as g_cur', 'g_cur.id', 't.current_grade_id')
    .leftJoin('core.grades as g_tgt', 'g_tgt.id', 't.target_grade_id')
    .leftJoin('core.employees as m_cur', 'm_cur.id', 't.current_reporting_manager_id')
    .leftJoin('core.employees as m_tgt', 'm_tgt.id', 't.target_reporting_manager_id')
    .select([
      't.id',
      't.employee_id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      't.transfer_type',
      't.effective_date',
      't.status',
      't.current_company_id',
      'c_cur.name as current_company_name',
      't.target_company_id',
      'c_tgt.name as target_company_name',
      't.current_department_id',
      'd_cur.name as current_department_name',
      't.target_department_id',
      'd_tgt.name as target_department_name',
      't.current_location_id',
      'l_cur.name as current_location_name',
      't.target_location_id',
      'l_tgt.name as target_location_name',
      't.current_designation_id',
      'des_cur.name as current_designation_name',
      't.target_designation_id',
      'des_tgt.name as target_designation_name',
      't.current_grade_id',
      'g_cur.name as current_grade_name',
      't.target_grade_id',
      'g_tgt.name as target_grade_name',
      't.current_reporting_manager_id',
      'm_cur.first_name as m_cur_first',
      'm_cur.last_name as m_cur_last',
      't.target_reporting_manager_id',
      'm_tgt.first_name as m_tgt_first',
      'm_tgt.last_name as m_tgt_last',
      't.current_ecode',
      't.target_ecode',
      't.salary_revision_amount',
      't.leave_treatment',
      't.reason',
      't.remarks',
      't.approved_by',
      't.approved_at',
      't.notified_at',
      't.created_at',
    ])
    .$if(params.employeeId !== undefined, (qb) => params.employeeId === undefined ? qb : qb.where('t.employee_id', '=', params.employeeId))
    .$if(params.companyId !== undefined, (qb) => params.companyId === undefined ? qb : qb.where('t.current_company_id', '=', params.companyId))
    .$if(params.transferType !== undefined, (qb) => params.transferType === undefined ? qb : qb.where('t.transfer_type', '=', params.transferType))
    .$if(params.status !== undefined, (qb) => params.status === undefined ? qb : qb.where('t.status', '=', params.status))
    .orderBy('t.id', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  const formattedRows: TransferRecord[] = rows.map((r) => {
    const employeeName = [r.first_name, r.last_name].filter(Boolean).join(' ');
    const currentMgrName = r.m_cur_first ? [r.m_cur_first, r.m_cur_last].filter(Boolean).join(' ') : null;
    const targetMgrName = r.m_tgt_first ? [r.m_tgt_first, r.m_tgt_last].filter(Boolean).join(' ') : null;

    return {
      id: r.id,
      employeeId: r.employee_id,
      ecode: r.ecode,
      employeeName,
      transferType: r.transfer_type,
      effectiveDate: toDateString(r.effective_date),
      status: r.status,
      currentCompanyId: r.current_company_id,
      currentCompanyName: r.current_company_name,
      targetCompanyId: r.target_company_id ?? null,
      targetCompanyName: r.target_company_name ?? null,
      currentDepartmentId: r.current_department_id ?? null,
      currentDepartmentName: r.current_department_name ?? null,
      targetDepartmentId: r.target_department_id ?? null,
      targetDepartmentName: r.target_department_name ?? null,
      currentLocationId: r.current_location_id ?? null,
      currentLocationName: r.current_location_name ?? null,
      targetLocationId: r.target_location_id ?? null,
      targetLocationName: r.target_location_name ?? null,
      currentDesignationId: r.current_designation_id ?? null,
      currentDesignationName: r.current_designation_name ?? null,
      targetDesignationId: r.target_designation_id ?? null,
      targetDesignationName: r.target_designation_name ?? null,
      currentGradeId: r.current_grade_id ?? null,
      currentGradeName: r.current_grade_name ?? null,
      targetGradeId: r.target_grade_id ?? null,
      targetGradeName: r.target_grade_name ?? null,
      currentReportingManagerId: r.current_reporting_manager_id ?? null,
      currentReportingManagerName: currentMgrName,
      targetReportingManagerId: r.target_reporting_manager_id ?? null,
      targetReportingManagerName: targetMgrName,
      currentEcode: r.current_ecode,
      targetEcode: r.target_ecode,
      salaryRevisionAmount: r.salary_revision_amount ? Number(r.salary_revision_amount) : null,
      leaveTreatment: r.leave_treatment,
      reason: r.reason,
      remarks: r.remarks,
      approvedBy: r.approved_by ?? null,
      approvedAt: toIsoString(r.approved_at),
      notifiedAt: toIsoString(r.notified_at),
      createdAt: toIsoString(r.created_at) ?? '',
    };
  });

  return { rows: formattedRows, total };
}
