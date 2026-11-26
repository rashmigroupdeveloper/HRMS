import { ORPCError } from '@orpc/server'
import { prisma, type DayStatus, type DbClient, type PayClass } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { attendanceService } from '#modules/attendance'
import { formatDate } from '#shared/utils/dates'
import { dayKey, eachDay } from '#shared/utils/time'
import * as payrollRepository from '../payroll.repository.js'
import * as peopleService from '../people/people.service.js'
import * as daysRepository from './days.repository.js'
import type { ComputeInput } from './days.schema.js'

// Payroll stage 3, the days (approved 2026-11-27): which days each person of a run is paid for. The run takes its OWN
// copy of the locked attendance - one row per person and day, each half paid, unpaid or unclear, with what attendance
// said - because an attendance month can be opened again after a run is paid. Nothing here is money: what a day is
// worth, rounding and which components are cut wait for a greytHR salary register to agree against (BACKLOG item 31).

// --- The rule (pure - unit tested) ---
// Payroll follows attendance half by half and adds no rule of its own (the user, 2026-11-27):
// - paid: present, on duty, weekly off, holiday, and leave of a paid type;
// - unpaid: absent, missed punch (still open when the month was locked), and leave of a type without pay;
// - unclear: attendance has no day, or the half is "on leave" with no approved leave found - listed for HR, never
//   guessed into paid or unpaid.
// So an absent Saturday (first half worked, second half off) costs half a day, as leave counts it, and an off day
// between two absences stays paid (no "sandwich" rule). A half the late rule made absent is an absent half here like
// any other - whether that penalty may reach pay is still open (BACKLOG item 31), to settle before any amount is cut.

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

// --- Working the days out, from the API ---

// Takes the run's days from attendance again: every person's days in their segments, replacing what the run held. Only
// while the run is a draft, only from a period that is locked in attendance (its days no longer change), only by
// someone with Payroll Edit over the whole company.
export async function compute(viewer: CurrentUser, { runId, expectedComputedAt }: ComputeInput) {
  return prisma.$transaction(
    async (tx) => {
      const run = await peopleService.draftRunFor(viewer, runId, 'Working out a payroll run', tx)
      if ((run.computedAt?.getTime() ?? null) !== (expectedComputedAt?.getTime() ?? null)) {
        throw new ORPCError('CONFLICT', { message: 'Someone worked out this run in the meantime - reload it to see the latest days' })
      }
      const { from, to } = peopleService.payPeriodOf(run)
      const lock = await attendanceService.payrollLockOf(from, to, tx)
      if (!lock.locked) {
        throw new ORPCError('CONFLICT', {
          message: `Attendance from ${formatDate(from)} to ${formatDate(to)} is not locked yet - lock the attendance month first (Attendance setup, Month lock), then work out the days`,
        })
      }
      const people = await daysRepository.listSpans(run.id, tx)
      const attendance = await attendanceService.listPayrollDays(people.map((p) => p.employeeId), from, to)
      const rows = buildDays(people, attendance)
      await daysRepository.replaceDays(run.id, rows, viewer.employeeId, tx)
      await payrollRepository.markComputed(run.id, viewer.employeeId, tx)
      const has = (payClass: PayClass) => new Set(rows.filter((r) => r.firstHalf === payClass || r.secondHalf === payClass).map((r) => r.payrollRunEmployeeId)).size
      return { people: people.length, days: rows.length, peopleWithUnpaidDays: has('UNPAID'), peopleWithUnclearDays: has('UNCLEAR') }
    },
    { timeout: 120_000 },
  )
}
