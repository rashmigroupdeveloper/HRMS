import { z } from 'zod';
/** LV-03 / WF-01: application and revision use the same authoritative rules. */
import { DomainError } from '../../core/errors/index.js';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { addDaysIso } from '../../core/dates.js';
import { findHoliday, loadHolidaySubject } from '../../core/db/holiday-calendar.js';
import { genderCode, getLeaveType, getBalance, type LeaveTypeRow } from './leave-core.service.js';
import { assertNoLeaveBlackout } from './leave-blackout.js';
import { evaluateLeaveCoverage } from './coverage-check.service.js';
type Db = Kysely<Database>;

interface SpanDay {
  iso: string;
  /** counts toward the requested days (sandwich rule applied) */
  counted: boolean;
  /** 0.5 for the half-day edges, else 1 */
  weight: number;
  /** a half-day edge → the day record is written as HD, not L/CO */
  isHalf: boolean;
  /** gets a leave day-record on approval (any working, non-holiday/WO day) */
  writesRecord: boolean;
  /** why the day is off — null on a working day */
  skipReason: 'holiday' | 'week_off' | null;
}

/** Sandwich rule (LV-03): 'exclude' skips holidays/week-offs inside the span;
 *  'include' counts them but never overwrites their H/WO day record. */
export async function computeLeaveSpan(
  db: Db,
  employee: { id: number; location_id: number | null },
  type: Pick<LeaveTypeRow, 'sandwich_rule'>,
  fromDate: string,
  toDate: string,
  fromHalf: boolean,
  toHalf: boolean,
): Promise<{ days: number; span: SpanDay[] }> {
  const span: SpanDay[] = [];
  const who = await loadHolidaySubject(db, employee.id);
  for (let iso = fromDate; iso <= toDate; iso = addDaysIso(iso, 1)) {
    const holiday = await findHoliday(db, who, iso);
    let skipReason: 'holiday' | 'week_off' | null = holiday !== undefined ? 'holiday' : null;
    if (skipReason === null) {
      const roster = await db
        .selectFrom('att.rosters')
        .select('is_week_off')
        .where('employee_id', '=', employee.id)
        .where('work_date', '=', sql<Date>`${iso}::date`)
        .executeTakeFirst();
      const weekOff = roster ? roster.is_week_off : new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
      if (weekOff) skipReason = 'week_off';
    }

    const offDay = skipReason !== null;
    const counted = type.sandwich_rule === 'include' || !offDay;
    const isHalf = (iso === fromDate && fromHalf) || (iso === toDate && toHalf);
    span.push({
      iso,
      counted,
      weight: isHalf ? 0.5 : 1,
      isHalf,
      // Every working day of the leave gets a record (full → L/CO, half → HD),
      // so payroll counts it. Only holidays/week-offs are left untouched.
      writesRecord: counted && !offDay,
      skipReason,
    });
  }
  const days = span.filter((d) => d.counted).reduce((acc, d) => acc + d.weight, 0);
  return { days, span };
}

export interface ApplyLeaveParams {
  employeeId: number;
  requestedByUserId: number;
  leaveTypeCode: string;
  fromDate: string;
  toDate: string;
  fromHalf?: boolean | undefined;
  toHalf?: boolean | undefined;
  reason?: string | undefined;
}

export async function validateLeaveApplication(db: Db, params: ApplyLeaveParams, excludeApplicationId?: number, preview = false) {
  z.string().date().parse(params.fromDate); z.string().date().parse(params.toDate);
  if (params.fromDate > params.toDate) throw new DomainError('fromDate must be on or before toDate');
  const type = await getLeaveType(db, params.leaveTypeCode);
  const fromHalf = params.fromHalf ?? false;
  const toHalf = params.toHalf ?? false;
  if ((fromHalf || toHalf) && !type.allow_half_day) throw new DomainError(`${type.code} does not allow half days`);
  if (fromHalf && toHalf && params.fromDate === params.toDate) throw new DomainError('A single day cannot be two halves');

  const employee = await db
    .selectFrom('core.employees')
    .select(['id', 'location_id', 'gender', 'category'])
    .where('id', '=', params.employeeId)
    .executeTakeFirstOrThrow();
  // P-07: employee gender is stored as 'Female'/'Male', leave types use 'F'/'M'.
  if (type.applicable_gender !== null && genderCode(employee.gender) !== genderCode(type.applicable_gender)) {
    throw new DomainError(`${type.name} is not applicable for this employee`);
  }
  if (type.applicable_categories !== null && (employee.category === null || !type.applicable_categories.includes(employee.category))) {
    throw new DomainError(`${type.name} is not applicable for this employee category`);
  }

  const locked = await db
    .selectFrom('att.day_records')
    .select('id')
    .where('employee_id', '=', params.employeeId)
    .where('work_date', '>=', sql<Date>`${params.fromDate}::date`)
    .where('work_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('is_locked', '=', true)
    .executeTakeFirst();
  if (locked) throw new DomainError('The period is locked for payroll — contact HR');

  const overlap = await db
    .selectFrom('lv.applications')
    .select('id')
    .where('employee_id', '=', params.employeeId)
    .where('id', '!=', excludeApplicationId ?? -1)
    .where('status', 'in', ['pending', 'approved'])
    .where('from_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('to_date', '>=', sql<Date>`${params.fromDate}::date`)
    .executeTakeFirst();
  if (overlap) throw new DomainError('An open or approved leave already covers these dates');

  const attendance = await db.selectFrom('att.regularizations as reg').innerJoin('wf.requests as request', 'request.id', 'reg.workflow_request_id')
    .select('reg.id').where('reg.employee_id', '=', params.employeeId)
    .where('request.status', 'in', ['pending', 'sent_back', 'approved'])
    .where('reg.from_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('reg.to_date', '>=', sql<Date>`${params.fromDate}::date`).executeTakeFirst();
  if (attendance) throw new DomainError('An attendance request already covers these dates. Ask HR to reconcile it before applying for leave.');

  const { days } = await computeLeaveSpan(db, employee, type, params.fromDate, params.toDate, fromHalf, toHalf);
  if (days <= 0) throw new DomainError('The requested span contains no countable leave days');
  if (type.max_per_request !== null && days > Number(type.max_per_request)) {
    throw new DomainError(`${type.code} allows at most ${Number(type.max_per_request)} days per request`);
  }
  if (type.is_paid && !preview) {
    const { available } = await getBalance(db, params.employeeId, type.id);
    const previous = excludeApplicationId === undefined ? undefined : await db.selectFrom('lv.applications')
      .select(['days', 'leave_type_id']).where('id', '=', excludeApplicationId).executeTakeFirst();
    const reservation = previous?.leave_type_id === type.id ? Number(previous.days) : 0;
    if (available + reservation < days) throw new DomainError(`Insufficient ${type.code} balance: ${available} available, ${days} requested`);
  }

  if (!preview) await assertNoLeaveBlackout(db, {
    locationId: employee.location_id,
    from: params.fromDate,
    to: params.toDate,
  });

  const coverage = await evaluateLeaveCoverage(db, {
    employeeId: params.employeeId,
    from: params.fromDate,
    to: params.toDate,
    fromHalf,
    toHalf,
  });
  if (coverage.blocked && !preview) {
    throw new DomainError(coverage.warnings[0] ?? 'Leave blocked by team coverage (SHF-08)');
  }

  return { type, fromHalf, toHalf, days };
}
