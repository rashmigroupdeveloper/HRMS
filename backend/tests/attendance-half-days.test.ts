import { prisma } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { zonedInstant } from '#shared/utils/time'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as holidaysService from '../src/modules/attendance/holidays/holidays.service.js'
import * as listsService from '../src/modules/attendance/holiday-lists/holiday-lists.service.js'
import * as policiesService from '../src/modules/attendance/policies/policies.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { followList, holidaySetup } from './helpers/holidays.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Half-day sessions (the user, 2026-11-22 - RML's Saturday is a half day, 09:00-13:00 of a 09:00-18:00 shift): each day
// has two halves; a half-day weekday works only the first half; HR corrects a half, the other keeps following the punches.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 24 * 60 * 60 * 1000
// the Saturday of `weeksBack` weeks ago (at least two days ago, so every day of that week has passed)
function saturday(weeksBack: number) {
  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const back = ((day.getUTCDay() + 1) % 7) + 7 * weeksBack
  return new Date(day.getTime() - (back < 2 ? back + 7 : back) * DAY)
}

describe('half-day sessions', () => {
  let employee: { id: number; employeeCode: string }
  let timezone: string
  let shiftId: number
  let patternId: number
  let companyId: number
  const sat1 = saturday(1)
  const sat2 = saturday(2)
  const monday = new Date(sat2.getTime() + 2 * DAY)
  const tuesday = new Date(monday.getTime() + DAY)
  const wednesday = new Date(monday.getTime() + 2 * DAY)
  const thursday = new Date(monday.getTime() + 3 * DAY)
  const friday = new Date(monday.getTime() + 4 * DAY)

  async function punch(day: Date, ...clocks: string[]) {
    await prisma.punch.createMany({
      data: clocks.map((c) => {
        const [h, m] = c.split(':').map(Number) as [number, number]
        return { employeeId: employee.id, employeeCode: employee.employeeCode, punchedAt: zonedInstant(day, h * 60 + m, timezone), source: 'UPLOAD' as const, createdById: 0, updatedById: 0 }
      }),
    })
  }
  const dayOf = (date: Date) => prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: employee.id, date } }, select: { status: true, firstHalf: true, secondHalf: true, workedMinutes: true } })
  const sat3 = saturday(3)
  const sat4 = saturday(4)
  const work = () => daysService.recompute([employee.id], sat4, sat1)
  let holidays: { categoryId: number; holidayListId: number }
  // a holiday in the employee's list (`portion`: the part of the day off)
  const holidayOn = (date: Date, name: string, portion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' = 'FULL_DAY') =>
    prisma.holiday.create({
      data: { date, name, portion, categoryId: holidays.categoryId, createdById: 0, updatedById: 0, lists: { create: { holidayListId: holidays.holidayListId, createdById: 0, updatedById: 0 } } },
    })

  beforeAll(async () => {
    companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    employee = await createEmployee({ companyId, plantId })
    // the employee's holiday list (2026-11-24 - a day's holiday comes from it)
    holidays = await holidaySetup(companyId)
    await followList([employee.id], holidays.holidayListId)
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: sat2, to: sat1 })
    timezone = person!.timezone
    const hr = userWith({ id: 0, employeeCode: 'HRATT' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
    // the test's own shift (never the shared GEN): 09:00-18:00, break 30, first half to 13:00
    const shift = await shiftsService.createShift({ code: `H${tag}`, name: `Half days ${tag}`, start: 540, end: 1080, breakMinutes: 30, halfSplit: 780 }, hr)
    shiftId = shift.id
    expect(shift.halfSplit).toBe('13:00')
    // and its own policy: grace 10, a full day = the whole shift (from the first in to the last out - the user,
    // 2026-11-22), half day 4h, no late rules
    const policy = await policiesService.createPolicy(
      { name: `Half days ${tag}`, graceMinutes: 10, fullDayMinutes: null, halfDayMinutes: 240, latesPerHalfDayCut: null, veryLateMinutes: null, veryEarlyMinutes: null },
      hr,
    )
    // its own schedule pattern (2026-11-23): Monday-Friday the shift, Saturday its first half only, Sunday off
    const pattern = await shiftsService.createPattern({ name: `Half days ${tag}`, days: [shiftId, shiftId, shiftId, shiftId, shiftId, shiftId, 0], halfDays: [6] }, hr)
    patternId = pattern.id
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode], patternId, startWeek: 1, policyId: policy.id, effectiveFrom: new Date(sat4.getTime() - 7 * DAY) }, hr)
  })
  afterAll(() => prisma.$disconnect())

  it('a Saturday half day: stayed 4h from the first in (in 9:10, out 13:10) = present + weekly off; out earlier = absent + weekly off', async () => {
    await punch(sat2, '09:10', '13:10')
    await punch(sat1, '09:10', '13:05')
    await work()
    expect(await dayOf(sat2)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'WEEKLY_OFF', status: 'PRESENT', workedMinutes: 240 })
    expect(await dayOf(sat1)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'WEEKLY_OFF', status: 'ABSENT' })
  })

  it('a full day needs the whole 9h from the first in (in 9:10, out 18:10); out at 18:00 is a half day', async () => {
    await punch(thursday, '09:10', '18:10')
    await punch(friday, '09:10', '18:00')
    await work()
    // the hours worked shown leave the break out
    expect(await dayOf(thursday)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'PRESENT', status: 'PRESENT', workedMinutes: 510 })
    // 8h50m: more than a half day - the afternoon (13:00-18:00) has more of it than the morning (9:10-13:00)
    expect(await dayOf(friday)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT', status: 'HALF_DAY' })
  })

  it('a weekday with half the time: the half where it was worked is present', async () => {
    await punch(monday, '09:00', '13:30')
    await punch(tuesday, '13:30', '18:00')
    await work()
    expect(await dayOf(monday)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'ABSENT', status: 'HALF_DAY' })
    expect(await dayOf(tuesday)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT', status: 'HALF_DAY' })
  })

  it('HR corrects one half - the other keeps following the punches', async () => {
    const hr = userWith({ id: 0, employeeCode: 'HRATT' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
    await expect(daysService.correctDay({ employeeCode: employee.employeeCode, date: wednesday, reason: 'Nothing set' }, hr)).rejects.toThrow()
    await daysService.correctDay({ employeeCode: employee.employeeCode, date: wednesday, secondHalf: 'PRESENT', reason: 'On a client visit in the afternoon' }, hr)
    expect(await dayOf(wednesday)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT', status: 'HALF_DAY' })
    // the morning's punches come later: the first half follows them, the corrected afternoon stays
    await punch(wednesday, '09:00', '13:30')
    await work()
    expect(await dayOf(wednesday)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'PRESENT', status: 'PRESENT' })
    // correcting the first half later keeps the second half's correction (2026-11-23, the review: it was wiped)
    await daysService.correctDay({ employeeCode: employee.employeeCode, date: wednesday, firstHalf: 'ON_DUTY', reason: 'At the plant gate meeting' }, hr)
    const kept = await prisma.attendanceCorrection.findUniqueOrThrow({ where: { employeeId_date: { employeeId: employee.id, date: wednesday } }, select: { firstHalf: true, secondHalf: true } })
    expect(kept).toEqual({ firstHalf: 'ON_DUTY', secondHalf: 'PRESENT' })
    // the first half back to the punches (null); then the second too - no correction is left
    await daysService.correctDay({ employeeCode: employee.employeeCode, date: wednesday, firstHalf: null, reason: 'Was not on duty after all' }, hr)
    const where = { employeeId_date: { employeeId: employee.id, date: wednesday } }
    expect(await prisma.attendanceCorrection.findUniqueOrThrow({ where, select: { firstHalf: true, secondHalf: true } })).toEqual({ firstHalf: null, secondHalf: 'PRESENT' })
    await daysService.correctDay({ employeeCode: employee.employeeCode, date: wednesday, secondHalf: null, reason: 'The punches are right' }, hr)
    expect(await prisma.attendanceCorrection.findUnique({ where })).toBeNull()
  })

  it('a holiday on a Saturday is a holiday; a Saturday set on the roster is a whole day', async () => {
    await holidayOn(sat3, `Test holiday ${tag}`)
    await prisma.rosterEntry.create({ data: { employeeId: employee.id, date: sat4, shiftId, publishedAt: new Date(), publishedById: 0, createdById: 0, updatedById: 0 } })
    // 09:00-13:00 on a whole (rostered) day: 4h - a half day, the morning
    await punch(sat4, '09:00', '13:00')
    await work()
    expect(await dayOf(sat3)).toMatchObject({ firstHalf: 'HOLIDAY', secondHalf: 'HOLIDAY', status: 'HOLIDAY' })
    expect(await dayOf(sat4)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'ABSENT', status: 'HALF_DAY' })
  })

  // half-day holidays (the user, 2026-11-24): that half is a holiday, the other is worked - present for the half-day hours;
  // on a Saturday (first half worked) a first-half holiday makes the whole day off
  it('a half-day holiday: that half is a holiday, the other half is worked', async () => {
    const sat5 = saturday(5)
    const [mon5, tue5, wed5] = [2, 3, 4].map((n) => new Date(sat5.getTime() + n * DAY)) as [Date, Date, Date]
    await holidayOn(mon5, `Morning off ${tag}`, 'FIRST_HALF')
    await holidayOn(tue5, `Afternoon off ${tag}`, 'SECOND_HALF')
    await holidayOn(wed5, `Afternoon off 2 ${tag}`, 'SECOND_HALF')
    await holidayOn(sat5, `Saturday morning off ${tag}`, 'FIRST_HALF')
    await punch(mon5, '13:00', '18:00')
    await punch(tue5, '09:00', '13:05')
    await daysService.recompute([employee.id], sat5, wed5)
    expect(await dayOf(mon5)).toMatchObject({ firstHalf: 'HOLIDAY', secondHalf: 'PRESENT', status: 'PRESENT' })
    expect(await dayOf(tue5)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'HOLIDAY', status: 'PRESENT' })
    // nobody came on the working half: absent
    expect(await dayOf(wed5)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'HOLIDAY', status: 'ABSENT' })
    // a Saturday (first half worked): its first half off makes the whole day a holiday
    expect(await dayOf(sat5)).toMatchObject({ firstHalf: 'HOLIDAY', secondHalf: 'HOLIDAY', status: 'HOLIDAY' })
  })

  // a holiday added later (2026-11-24): the months already worked out are worked out again; a month never worked out
  // (before attendance started) stays empty - never filled with absent days
  it('a holiday added later works out again only the months already worked out', async () => {
    const hr = userWith({ id: 0, employeeCode: 'HRHOL2' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
    const mon3 = new Date(sat3.getTime() + 2 * DAY)
    const add = (date: Date, name: string) => holidaysService.createHoliday({ date, name, categoryId: holidays.categoryId, holidayListIds: [holidays.holidayListId] }, hr)
    await add(mon3, `Added later ${tag}`)
    expect(await dayOf(mon3)).toMatchObject({ firstHalf: 'HOLIDAY', secondHalf: 'HOLIDAY', status: 'HOLIDAY' })
    // February 2026 (joined 1 January): never worked out for this employee
    const feb = { gte: new Date(Date.UTC(2026, 1, 1)), lte: new Date(Date.UTC(2026, 1, 28)) }
    await add(new Date(Date.UTC(2026, 1, 10)), `Long ago ${tag}`)
    expect(await prisma.attendanceDay.count({ where: { employeeId: employee.id, date: feb } })).toBe(0)
  })

  // giving someone another list from a past date (2026-11-24): the months already worked out follow the new list - the old
  // list's holiday is a working day again, the new list's a holiday
  it("works out again the days already worked out when someone's holiday list changes", async () => {
    const hr = userWith({ id: 0, employeeCode: 'HRHOL3' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
    const mon3 = new Date(sat3.getTime() + 2 * DAY)
    const tue3 = new Date(sat3.getTime() + 3 * DAY)
    expect(await dayOf(mon3)).toMatchObject({ status: 'HOLIDAY' })
    const other = await holidaySetup(companyId)
    await holidaysService.createHoliday({ date: tue3, name: `Other list ${tag}`, categoryId: other.categoryId, holidayListIds: [other.holidayListId] }, hr)
    await listsService.assignHolidayList({ employeeCodes: [employee.employeeCode], holidayListId: other.holidayListId, effectiveFrom: sat4 }, hr)
    expect(await dayOf(tue3)).toMatchObject({ firstHalf: 'HOLIDAY', secondHalf: 'HOLIDAY', status: 'HOLIDAY' })
    expect((await dayOf(mon3)).status).not.toBe('HOLIDAY')
  })

  it('the day overall from two halves', () => {
    expect(daysService.dayStatusOf('PRESENT', 'PRESENT')).toBe('PRESENT')
    expect(daysService.dayStatusOf('PRESENT', 'ABSENT')).toBe('HALF_DAY')
    expect(daysService.dayStatusOf('PRESENT', 'WEEKLY_OFF')).toBe('PRESENT')
    expect(daysService.dayStatusOf('ABSENT', 'WEEKLY_OFF')).toBe('ABSENT')
    expect(daysService.dayStatusOf('MISSED_PUNCH', 'WEEKLY_OFF')).toBe('MISSED_PUNCH')
    expect(daysService.dayStatusOf('WEEKLY_OFF', 'HOLIDAY')).toBe('HOLIDAY')
  })

  it('refuses a first half outside the shift and a half day without a shift', async () => {
    await expect(
      policiesService.createPolicy({ name: `Bad ${tag}`, graceMinutes: 0, fullDayMinutes: 200, halfDayMinutes: 240, latesPerHalfDayCut: null, veryLateMinutes: null, veryEarlyMinutes: null }, userWith({ id: 0, employeeCode: 'HRATT' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])),
    ).rejects.toThrow('half day cannot need more')
    const hr = userWith({ id: 0, employeeCode: 'HRATT' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
    await expect(shiftsService.updateShift({ id: shiftId, halfSplit: 1200, effectiveFrom: new Date(Date.UTC(2026, 0, 1)) }, hr)).rejects.toThrow('first half must end')
    await expect(shiftsService.updatePattern({ id: patternId, halfDays: [7], effectiveFrom: new Date(Date.UTC(2026, 0, 1)) }, hr)).rejects.toThrow('half day must be a day with a shift')
  })
})
