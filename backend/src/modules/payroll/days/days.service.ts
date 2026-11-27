import { ORPCError } from '@orpc/server'
import type { ActorId, DayStatus, DbClient, PayClass } from '#core/db/prisma'
import { attendanceService } from '#modules/attendance'
import { formatDate } from '#shared/utils/dates'
import { dayKey, eachDay } from '#shared/utils/time'
import * as peopleService from '../people/people.service.js'
import * as daysRepository from './days.repository.js'

// Payroll stage 3, the days (approved 2026-11-27): which days each person of a run is paid for. The run takes its OWN
// copy of the locked attendance - one row per person and day, each half paid, unpaid or unclear, with what attendance
// said - because an attendance month can be opened again after a run is paid. The money worked out from these days is
// in payroll/calculation; "Work out pay" takes the days and works out the amounts in one step.

// --- The rule (pure - unit tested) ---
// Payroll follows attendance half by half and adds no rule of its own (the user, 2026-11-27):
// - paid: present, on duty, weekly off, holiday, and leave of a paid type;
// - unpaid: absent, missed punch (still open when the month was locked), and leave of a type without pay;
// - unclear: attendance has no day, or the half is "on leave" with no approved leave found - listed for HR, never
//   guessed into paid or unpaid.
// So an absent Saturday (first half worked, second half off) costs half a day, as leave counts it, and an off day
// between two absences stays paid (no "sandwich" rule). A half the late rule made absent is an absent half here like
// any other, so it costs pay unless it is regularized or corrected before the lock (the user, 2026-11-27 - how many
// lates cost a half is the attendance policy's "late cut every N" setting; 1 = every late after the grace).

const PAID = new Set<DayStatus>(['PRESENT', 'ON_DUTY', 'WEEKLY_OFF', 'HOLIDAY'])
const UNPAID = new Set<DayStatus>(['ABSENT', 'MISSED_PUNCH'])

export function classOfHalf(half: attendanceService.PayrollHalf | undefined): { payClass: PayClass; status: DayStatus | null; leaveCode: string | null } {
  if (!half) return { payClass: 'UNCLEAR', status: null, leaveCode: null }
  if (half.status === 'LEAVE') return { payClass: half.leave ? (half.leave.paid ? 'PAID' : 'UNPAID') : 'UNCLEAR', status: 'LEAVE', leaveCode: half.leave?.code ?? null }
  // (a half is never "half day" - that is a whole day's status; should one arrive it is not guessed)
  return { payClass: PAID.has(half.status) ? 'PAID' : UNPAID.has(half.status) ? 'UNPAID' : 'UNCLEAR', status: half.status, leaveCode: null }
}

type Span = { id: number; employeeId: number; segments: { fromDate: Date; toDate: Date }[] }

// A row for every day each person is in the company in the run's period (the days of their segments), classed by the
// rule above from attendance's days
export function buildDays(people: Span[], attendance: attendanceService.PayrollDay[]): daysRepository.DayRow[] {
  const dayOf = new Map(attendance.map((day) => [`${day.employeeId}:${dayKey(day.date)}`, day]))
  const rows: daysRepository.DayRow[] = []
  for (const person of people) {
    for (const segment of person.segments) {
      for (const date of eachDay(segment.fromDate, segment.toDate)) {
        const day = dayOf.get(`${person.employeeId}:${dayKey(date)}`)
        const first = classOfHalf(day?.first)
        const second = classOfHalf(day?.second)
        rows.push({
          payrollRunEmployeeId: person.id,
          date,
          firstHalf: first.payClass,
          secondHalf: second.payClass,
          firstStatus: first.status,
          secondStatus: second.status,
          firstLeaveCode: first.leaveCode,
          secondLeaveCode: second.leaveCode,
        })
      }
    }
  }
  return rows
}

// --- The attendance lock of a run's period ---

// Whether the run's whole period is locked in attendance now, and whether the days the run holds are older than that
// lock (attendance was opened and locked again after they were taken - they may no longer match)
export async function lockStateOf(run: { attendanceFrom: Date; attendanceTo: Date; computedAt: Date | null }, db?: DbClient) {
  const { from, to } = peopleService.payPeriodOf(run)
  const lock = await attendanceService.payrollLockOf(from, to, db)
  return {
    attendanceLocked: lock.locked,
    daysOutdated: run.computedAt !== null && (!lock.locked || (lock.lockedAt !== null && lock.lockedAt > run.computedAt)),
  }
}

// --- Taking the days, for "Work out pay" (payroll/calculation) ---

// Takes the run's days from attendance again, inside the caller's transaction: every person's days in their segments,
// replacing what the run held. Only from a period that is locked in attendance (its days no longer change) - the caller
// has checked the run is a draft the viewer may change. Returns the rows written.
export async function takeDays(run: { id: number; attendanceFrom: Date; attendanceTo: Date }, actorId: ActorId, tx: DbClient) {
  const { from, to } = peopleService.payPeriodOf(run)
  const lock = await attendanceService.payrollLockOf(from, to, tx)
  if (!lock.locked) {
    throw new ORPCError('CONFLICT', {
      message: `Attendance from ${formatDate(from)} to ${formatDate(to)} is not locked yet - lock the attendance month first (Attendance setup, Month lock), then work out the pay`,
    })
  }
  const people = await daysRepository.listSpans(run.id, tx)
  const attendance = await attendanceService.listPayrollDays(people.map((p) => p.employeeId), from, to)
  const rows = buildDays(people, attendance)
  await daysRepository.replaceDays(run.id, rows, actorId, tx)
  return rows
}
