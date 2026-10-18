/** ATT-03/04/12, CORE-10/11: scoped, audited scheme changes and derived-data invalidation. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { EmployeeScope } from '../../core/rbac/employee-scope.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { AttendanceMutationError, assertAttendanceMonthOpen, attendanceTransaction, lockAttendanceEmployee } from './attendance-mutation.js';

export async function assignEmployeeScheme(db: Kysely<Database>, params: {
  employeeId: number; weekdayShiftCode: string; saturdayShiftCode?: string | null | undefined;
  actorUserId: number; scope: EmployeeScope;
}): Promise<void> {
  await attendanceTransaction(db, async trx => {
    const employee = await lockAttendanceEmployee(trx, params.employeeId, params.scope);
    const codes = [params.weekdayShiftCode, ...(params.saturdayShiftCode ? [params.saturdayShiftCode] : [])];
    const shifts = await trx.selectFrom('att.shifts').select(['id', 'code', 'is_active']).where('code', 'in', codes).execute();
    const lookup = (code: string) => {
      const shift = shifts.find(s => s.code === code);
      if (!shift?.is_active) throw new AttendanceMutationError('BAD_REQUEST', `Select an active configured shift: ${code}`);
      return shift.id;
    };
    const weekdayId = lookup(params.weekdayShiftCode);
    const saturdayId = params.saturdayShiftCode ? lookup(params.saturdayShiftCode) : null;
    const previous = await trx.selectFrom('att.employee_shifts').selectAll().where('employee_id', '=', employee.id).executeTakeFirst();
    if (previous?.weekday_shift_id === weekdayId && previous.saturday_shift_id === saturdayId) return;

    // Explicit rosters override a scheme. Closed facts must never be requeued.
    const affected = await trx.selectFrom('att.day_records as d').select('d.work_date')
      .where('d.employee_id', '=', employee.id).where('d.is_locked', '=', false)
      .where(sql<boolean>`NOT EXISTS (SELECT 1 FROM att.rosters r WHERE r.employee_id = d.employee_id AND r.work_date = d.work_date)`)
      .where(sql<boolean>`NOT EXISTS (SELECT 1 FROM att.month_locks m WHERE m.company_id = ${employee.company_id} AND m.month = date_trunc('month', d.work_date)::date)`)
      .orderBy('d.work_date').execute();
    const months = [...new Set(affected.map(d => formatDbDate(d.work_date).slice(0, 7) + '-01'))];
    for (const month of months) await assertAttendanceMonthOpen(trx, employee.company_id, month);
    await trx.insertInto('att.employee_shifts').values({ employee_id: employee.id, weekday_shift_id: weekdayId,
      saturday_shift_id: saturdayId, updated_by: params.actorUserId })
      .onConflict(oc => oc.column('employee_id').doUpdateSet({ weekday_shift_id: weekdayId, saturday_shift_id: saturdayId, updated_by: params.actorUserId })).execute();
    if (affected.length > 0) await trx.insertInto('att.recompute_queue')
      .values(affected.map(d => ({ employee_id: employee.id, work_date: d.work_date })))
      .onConflict(oc => oc.columns(['employee_id', 'work_date']).doNothing()).execute();
    if (employee.reporting_manager_id !== null) {
      for (const month of months) {
        const latest = await trx.selectFrom('att.manager_month_approvals').select('event_type')
          .where('company_id', '=', employee.company_id).where('manager_employee_id', '=', employee.reporting_manager_id)
          .where('month', '=', sql<Date>`${month}::date`).orderBy('id', 'desc').executeTakeFirst();
        if (latest?.event_type === 'approve') await trx.insertInto('att.manager_month_approvals').values({
          company_id: employee.company_id, manager_employee_id: employee.reporting_manager_id,
          month: sql<Date>`${month}::date`, event_type: 'invalidate', approved_by_user_id: null,
          note: 'Employee shift scheme changed after approval',
        }).execute();
      }
    }
    await writeAudit(trx, { actorUserId: params.actorUserId, action: 'update', entity: 'att.employee_shifts',
      entityId: employee.id, subjectEmployeeId: employee.id, field: 'shift_scheme',
      oldValue: previous ? JSON.stringify({ weekdayShiftId: previous.weekday_shift_id, saturdayShiftId: previous.saturday_shift_id }) : null,
      newValue: JSON.stringify({ weekdayShiftId: weekdayId, saturdayShiftId: saturdayId, queuedDays: affected.length }) });
  });
}
