import { assertGroupWide, SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { addDays } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as locksRepository from './locks.repository.js'
import type { cycleStartInput, monthLockInput, unlockMonthInput } from './locks.schema.js'

// The attendance month lock (the user, 2026-11-22 - for payroll): one lock for the whole group, so it needs Attendance
// setup Edit for all companies (its own area since 2026-11-22). Before locking, a checklist shows what is still open (missed punches, shift changes waiting,
// punches of unknown codes) - it warns, it does not block; the month's days are worked out once more, then locked:
// nothing in it changes until it is opened again, with a reason (days.service refuses the changes). The attendance month
// runs from the settings' start day (RML: the 26th - "November" = 26 Oct - 25 Nov).

const WHAT = 'The attendance month lock'

function rangeOf(year: number, month: number, startDay: number) {
  return daysService.cycleRange(year, month, startDay)
}

// A year's attendance months: their days, whether locked (who, when) and earlier openings
export async function listMonths(viewer: CurrentUser, year: number) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', WHAT)
  const [startDay, locks] = await Promise.all([locksRepository.findCycleStartDay(), locksRepository.listLocks(year)])
  const person = await employeesService.lookupPeople(locks.flatMap((l) => [l.lockedById, l.unlockedById]))
  const now = today()
  return {
    cycleStartDay: startDay,
    months: Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const { from, to } = rangeOf(year, month, startDay)
      const own = locks.filter((l) => l.month === month)
      const open = own.find((l) => l.unlockedAt === null)
      return {
        year,
        month,
        name: daysService.monthName(year, month),
        from,
        to,
        // a month can be locked once it is over
        ended: to < now,
        locked: open ? { at: open.lockedAt, by: person(open.lockedById) } : null,
        // the times it was opened again
        reopened: own.filter((l) => l.unlockedAt).map((l) => ({ lockedAt: l.lockedAt, lockedBy: person(l.lockedById), unlockedAt: l.unlockedAt, unlockedBy: person(l.unlockedById), reason: l.unlockReason })),
      }
    }),
  }
}

// What is still open in a month (a warning before locking)
export async function getChecklist(viewer: CurrentUser, { year, month }: z.infer<typeof monthLockInput>) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', WHAT)
  const startDay = await locksRepository.findCycleStartDay()
  const { from, to } = rangeOf(year, month, startDay)
  const [missedPunches, pendingShiftChanges, unmatchedPunches, open] = await Promise.all([
    locksRepository.countMissedPunches(from, to),
    locksRepository.countPendingShiftChanges(from, to),
    locksRepository.countUnmatchedPunches(from, addDays(to, 1)),
    locksRepository.findOpenLock(year, month),
  ])
  return { year, month, name: daysService.monthName(year, month), from, to, locked: !!open, missedPunches, pendingShiftChanges, unmatchedPunches }
}

// Locks a month that is over: its days are worked out once more for everyone, then nothing in it changes
export async function lockMonth(viewer: CurrentUser, { year, month }: z.infer<typeof monthLockInput>) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', WHAT)
  const startDay = await locksRepository.findCycleStartDay()
  const { from, to } = rangeOf(year, month, startDay)
  if (to >= today()) throw new ORPCError('BAD_REQUEST', { message: `${daysService.monthName(year, month)} is not over yet (it ends on ${to.toISOString().slice(0, 10)})` })
  if (await locksRepository.findOpenLock(year, month)) throw new ORPCError('CONFLICT', { message: `${daysService.monthName(year, month)} is already locked` })
  // everyone employed in the month - the whole group (the lock is for every company)
  const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, from, to })
  await daysService.recompute(
    people.map((p) => p.id),
    from,
    to,
  )
  // checked again while holding the month: two locks at once (a double click, two HR people) make one lock - before
  // (2026-11-23) both were saved and one "unlock" left the month locked
  await prisma.$transaction(async (tx) => {
    await locksRepository.holdMonth(year, month, tx)
    if (await locksRepository.findOpenLock(year, month, tx)) throw new ORPCError('CONFLICT', { message: `${daysService.monthName(year, month)} is already locked` })
    await locksRepository.createLock({ year, month, lockedAt: new Date(), lockedById: viewer.employeeId }, viewer.employeeId, tx)
  })
  return getChecklist(viewer, { year, month })
}

// Opens a locked month again, with the reason (it can be locked again after the fix)
export async function unlockMonth(viewer: CurrentUser, { year, month, reason }: z.infer<typeof unlockMonthInput>) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', WHAT)
  const open = await locksRepository.findOpenLock(year, month)
  if (!open) throw new ORPCError('NOT_FOUND', { message: `${daysService.monthName(year, month)} is not locked` })
  await locksRepository.unlock(open.id, { unlockedAt: new Date(), unlockedById: viewer.employeeId, unlockReason: reason }, viewer.employeeId)
  return getChecklist(viewer, { year, month })
}

// The day an attendance month starts - not while a month is locked (its days would move)
export async function setCycleStart(viewer: CurrentUser, { cycleStartDay }: z.infer<typeof cycleStartInput>) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'The attendance month')
  if (await locksRepository.countOpenLocks()) throw new ORPCError('CONFLICT', { message: 'Open the locked months again first - changing the start day moves their days' })
  return prisma.$transaction((tx) => locksRepository.setCycleStartDay(cycleStartDay, viewer.employeeId, tx))
}
