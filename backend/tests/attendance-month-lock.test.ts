import { prisma } from '#core/db/prisma'
import { afterAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as holidaysService from '../src/modules/attendance/holidays/holidays.service.js'
import * as locksService from '../src/modules/attendance/locks/locks.service.js'
import { holidaySetup } from './helpers/holidays.js'
import { createCompany } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The attendance month lock (the user, 2026-11-22): one lock for the whole group (Attendance Edit for all companies); the
// attendance month runs from the 26th (the seeded start day); a locked month refuses changes; it opens again with a reason.
// The test database is shared and never wiped: it locks a month long past (June 2025) and always opens it again.

const hr = userWith({ id: 0, employeeCode: 'HRLOCK' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day))

describe('the attendance month lock', () => {
  afterAll(async () => {
    // never leave June 2025 locked
    await prisma.attendanceMonthLock.updateMany({ where: { year: 2025, month: 6, unlockedAt: null }, data: { unlockedAt: new Date(), unlockedById: 0, unlockReason: 'Test clean-up', updatedById: 0 } })
    await prisma.$disconnect()
  })

  it('the attendance month runs from the 26th to the 25th', () => {
    expect(daysService.cycleOf(d(2026, 11, 25), 26)).toEqual({ year: 2026, month: 11 })
    expect(daysService.cycleOf(d(2026, 11, 26), 26)).toEqual({ year: 2026, month: 12 })
    expect(daysService.cycleOf(d(2025, 12, 28), 26)).toEqual({ year: 2026, month: 1 })
    expect(daysService.cycleRange(2026, 11, 26)).toEqual({ from: d(2026, 10, 26), to: d(2026, 11, 25) })
    expect(daysService.cycleRange(2026, 1, 26)).toEqual({ from: d(2025, 12, 26), to: d(2026, 1, 25) })
    expect(daysService.cycleRange(2026, 2, 1)).toEqual({ from: d(2026, 2, 1), to: d(2026, 2, 28) })
  })

  it('locks a month that is over; a locked month refuses changes; it opens again with a reason', async () => {
    const checklist = await locksService.getChecklist(hr, { year: 2025, month: 6 })
    expect(checklist).toMatchObject({ locked: false, from: d(2025, 5, 26), to: d(2025, 6, 25) })
    const locked = await locksService.lockMonth(hr, { year: 2025, month: 6 })
    expect(locked.locked).toBe(true)
    await expect(locksService.lockMonth(hr, { year: 2025, month: 6 })).rejects.toThrow('already locked')
    // a change to one of its days is refused
    await expect(daysService.assertOpenDays([d(2025, 6, 10)])).rejects.toThrow('locked attendance month')
    await expect(daysService.correctDay({ employeeCode: 'HRLOCK', date: d(2025, 6, 10), firstHalf: 'PRESENT', reason: 'Test' }, hr)).rejects.toThrow('locked attendance month')
    // a day of the next month is not
    await expect(daysService.assertOpenDays([d(2025, 6, 26)])).resolves.toBeUndefined()
    // found in the 2026-11-23 review: a holiday, or a schedule from an earlier date, changed the locked month's plan
    const lists = await holidaySetup(null)
    await expect(
      holidaysService.createHoliday({ date: d(2025, 6, 12), name: 'Test holiday', categoryId: lists.categoryId, holidayListIds: [lists.holidayListId] }, hr),
    ).rejects.toThrow('locked attendance month')
    await expect(daysService.assertNothingLockedFrom(d(2025, 6, 1))).rejects.toThrow('June 2025 is a locked attendance month')
    await expect(daysService.assertNothingLockedFrom(d(2025, 6, 26))).resolves.toBeUndefined()
    // a holiday list given from a joining day before it ("fill in", 2026-11-24) starts the day after the locked month
    expect(await daysService.firstOpenDayFrom(d(2025, 3, 1))).toEqual(d(2025, 6, 26))
    expect(await daysService.firstOpenDayFrom(d(2025, 7, 1))).toEqual(d(2025, 7, 1))
    // the start day cannot change while a month is locked
    await expect(locksService.setCycleStart(hr, { cycleStartDay: 1 })).rejects.toThrow('Open the locked months again first')
    const months = await locksService.listMonths(hr, 2025)
    expect(months.cycleStartDay).toBe(26)
    expect(months.months[5]).toMatchObject({ month: 6, name: 'June 2025', ended: true })
    expect(months.months[5]!.locked).not.toBeNull()
    // opened again: changes are allowed; the opening is kept
    await locksService.unlockMonth(hr, { year: 2025, month: 6, reason: 'A missed punch to fix' })
    await expect(daysService.assertOpenDays([d(2025, 6, 10)])).resolves.toBeUndefined()
    const after = await locksService.listMonths(hr, 2025)
    expect(after.months[5]!.locked).toBeNull()
    expect(after.months[5]!.reopened[0]).toMatchObject({ reason: 'A missed punch to fix' })
  })

  it('refuses a month not over yet, and anyone without Attendance Edit for all companies', async () => {
    const now = new Date()
    const current = daysService.cycleOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), 26)
    await expect(locksService.lockMonth(hr, current)).rejects.toThrow('not over yet')
    const companyHr = userWith({ id: 0, employeeCode: 'HRCO' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row((await createCompany()).id, null, null)] }])
    await expect(locksService.lockMonth(companyHr, { year: 2025, month: 7 })).rejects.toThrow('shared by every company')
  })

  // found in the 2026-11-23 review: two locks at once both passed "already locked" - one unlock left the month locked
  it('makes one lock of two at the same moment', async () => {
    const month = { year: 2024, month: 3 }
    const results = await Promise.allSettled([locksService.lockMonth(hr, month), locksService.lockMonth(hr, month)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.attendanceMonthLock.count({ where: { ...month, unlockedAt: null } })).toBe(1)
    await locksService.unlockMonth(hr, { ...month, reason: 'Test over' })
    expect((await locksService.getChecklist(hr, month)).locked).toBe(false)
  })
})
