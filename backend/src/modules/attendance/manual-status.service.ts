/** ATT-03/05/08/15/17, CORE-11: one truthful atomic HR correction, with original facts audited. */
import { sql, type Kysely, type Selectable } from 'kysely';
import { z } from 'zod';
import type { AttDayRecordsTable, Database, DayStatus } from '../../core/db/types.js';
import type { EmployeeScope } from '../../core/rbac/employee-scope.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { readSessionStatuses, validateSessionSummary, type SessionStatuses } from './session-status.js';
import { AttendanceMutationError, assertAttendanceMonthOpen, attendanceTransaction, lockAttendanceEmployee } from './attendance-mutation.js';
import { recloseDecidedWeekOffs } from '../../core/db/attendance-period.js';
import { getTypedSetting } from '../settings/index.js';

function snapshot(row: Selectable<AttDayRecordsTable>) {
  return { status: row.status, sessionStatuses: row.session_statuses, source: row.source,
    firstIn: row.first_in?.toISOString() ?? null, lastOut: row.last_out?.toISOString() ?? null,
    workedMinutes: row.worked_minutes, lateMinutes: row.late_minutes, earlyExitMinutes: row.early_exit_minutes,
    otMinutes: row.ot_minutes, penaltyFlag: row.penalty_flag, penaltyEvaluation: row.penalty_evaluation, leaveTypeId: row.leave_type_id,
    weekoffPaid: row.weekoff_paid, reason: row.override_reason };
}
export async function setManualStatus(db: Kysely<Database>, params: {
  employeeId: number; isoDate: string; status: DayStatus; sessionStatuses?: SessionStatuses | null;
  reason: string; actorUserId: number; scope?: EmployeeScope;
}): Promise<void> {
  const reason = params.reason.trim();
  if (reason.length < 5) throw new AttendanceMutationError('BAD_REQUEST', 'A meaningful correction reason is mandatory');
  if (!z.string().date().safeParse(params.isoDate).success) throw new AttendanceMutationError('BAD_REQUEST', 'Invalid attendance date');
  const sessions = readSessionStatuses(params.sessionStatuses);
  try { validateSessionSummary(params.status, sessions); }
  catch (error) { throw new AttendanceMutationError('BAD_REQUEST', error instanceof Error ? error.message : 'Invalid session results'); }
  await attendanceTransaction(db, async trx => {
    const employee = await lockAttendanceEmployee(trx, params.employeeId, params.scope);
    await assertAttendanceMonthOpen(trx, employee.company_id, params.isoDate);
    const previous = await trx.selectFrom('att.day_records').selectAll().where('employee_id', '=', params.employeeId)
      .where('work_date', '=', sql<Date>`${params.isoDate}::date`).forUpdate().executeTakeFirst();
    if (previous?.is_locked) throw new AttendanceMutationError('CONFLICT', 'Attendance day is locked');
    const leave = await trx.selectFrom('lv.applications').select('id').where('employee_id', '=', params.employeeId)
      .where('status', '=', 'approved').where('from_date', '<=', sql<Date>`${params.isoDate}::date`)
      .where('to_date', '>=', sql<Date>`${params.isoDate}::date`).executeTakeFirst();
    if ((previous !== undefined && previous.leave_type_id !== null) || leave) throw new AttendanceMutationError('CONFLICT', 'Resolve the approved leave through its workflow before correcting attendance');
    const overtime = await trx.selectFrom('att.overtime_entries').select('id').where('employee_id', '=', params.employeeId)
      .where('work_date', '=', sql<Date>`${params.isoDate}::date`)
      .where(eb => eb.or([eb('status', 'in', ['pending', 'approved', 'converted_comp_off']), eb('payroll_item_id', 'is not', null), eb('comp_off_credit_id', 'is not', null)]))
      .executeTakeFirst();
    if (overtime) throw new AttendanceMutationError('CONFLICT', 'Resolve the overtime or comp-off obligation before correcting attendance');
    const posted = await trx.insertInto('att.day_records').values({
      employee_id: params.employeeId, work_date: sql<Date>`${params.isoDate}::date`,
      status: params.status, source: 'manual', override_reason: reason,
      first_in: null, last_out: null, worked_minutes: null, late_minutes: 0, early_exit_minutes: 0,
      ot_minutes: 0, penalty_flag: false, penalty_evaluation: null, leave_type_id: null, weekoff_paid: null,
      session_statuses: sessions ? JSON.stringify(sessions) : null, computed_at: new Date(),
    }).onConflict(oc => oc.columns(['employee_id', 'work_date']).doUpdateSet({
      status: params.status, source: 'manual', override_reason: reason,
      first_in: null, last_out: null, worked_minutes: null, late_minutes: 0, early_exit_minutes: 0,
      ot_minutes: 0, penalty_flag: false, penalty_evaluation: null, leave_type_id: null, weekoff_paid: null,
      session_statuses: sessions ? JSON.stringify(sessions) : null, computed_at: new Date(),
    }).where('att.day_records.is_locked', '=', false)).returningAll().executeTakeFirst();
    if (!posted) throw new AttendanceMutationError('CONFLICT', 'Attendance changed or became locked; refresh before correcting');
    await recloseDecidedWeekOffs(trx, params.employeeId, [params.isoDate],
      await getTypedSetting(trx, 'att.weekoff_min_worked_days', 'number', 1));
    await writeAudit(trx, { actorUserId: params.actorUserId, action: 'update', entity: 'att.day_records',
      entityId: posted.id, subjectEmployeeId: params.employeeId, field: `manual_override:${params.isoDate}`,
      oldValue: previous ? JSON.stringify(snapshot(previous)) : null, newValue: JSON.stringify(snapshot(posted)) });
  });
}
