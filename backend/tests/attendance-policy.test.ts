import { prisma } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { zonedInstant } from '#shared/utils/time'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as policiesService from '../src/modules/attendance/policies/policies.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { followList, holidaySetup } from './helpers/holidays.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The attendance policy (the user, 2026-11-22): the rules apart from the shift - every Nth late day of a month loses its
// first half; very late in / very early out make that half absent; the reason is kept in the day's note; only someone with
// Attendance Edit for all companies changes a policy.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 24 * 60 * 60 * 1000
const hr = userWith({ id: 0, employeeCode: 'HRPOL' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

// the Monday to Friday of the full week before last (every day has passed); all in one calendar month when possible
function lastWeek() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const monday = new Date(today.getTime() - (((today.getUTCDay() + 6) % 7) + 14) * DAY)
  return [0, 1, 2, 3, 4].map((i) => new Date(monday.getTime() + i * DAY))
}

describe('the attendance policy', () => {
  let employee: { id: number; employeeCode: string }
  let timezone: string
  let patternId: number
  let policyId: number
  let companyIdOf: number
  let plantIdOf: number
  const week = lastWeek()

  async function punch(day: Date, ...clocks: string[]) {
    await prisma.punch.createMany({
      data: clocks.map((c) => {
        const [h, m] = c.split(':').map(Number) as [number, number]
        return { employeeId: employee.id, employeeCode: employee.employeeCode, punchedAt: zonedInstant(day, h * 60 + m, timezone), source: 'UPLOAD' as const, createdById: 0, updatedById: 0 }
      }),
    })
  }
  const dayOf = (date: Date) => prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: employee.id, date } }, select: { status: true, firstHalf: true, secondHalf: true, note: true, lateMinutes: true } })

  beforeAll(async () => {
    const companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    companyIdOf = companyId
    plantIdOf = plantId
    employee = await createEmployee({ companyId, plantId })
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: week[0]!, to: week[4]! })
    timezone = person!.timezone
    const shift = await shiftsService.createShift({ code: `P${tag}`, name: `Policy ${tag}`, start: 540, end: 1080, breakMinutes: 30, halfSplit: 780 }, hr)
    // grace 10; every 2nd late day loses its first half; in more than 2h late = first half absent; out more than 3h early =
    // second half absent; a full day 8h from in to out
    const policy = await policiesService.createPolicy(
      { name: `Policy ${tag}`, graceMinutes: 10, fullDayMinutes: 480, halfDayMinutes: 240, latesPerHalfDayCut: 2, veryLateMinutes: 120, veryEarlyMinutes: 180 },
      hr,
    )
    const pattern = await shiftsService.createPattern({ name: `Policy ${tag}`, days: [shift.id, shift.id, shift.id, shift.id, shift.id, shift.id, 0], halfDays: [] }, hr)
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode], patternId: pattern.id, startWeek: 1, policyId: policy.id, effectiveFrom: new Date(week[0]!.getTime() - 7 * DAY) }, hr)
    patternId = pattern.id
    policyId = policy.id
  })
  afterAll(() => prisma.$disconnect())

  it('every 2nd late day of the month loses its first half; very late / very early make that half absent', async () => {
    const [mon, tue, wed, thu, fri] = week as [Date, Date, Date, Date, Date]
    await punch(mon, '09:20', '18:00') // 1st late (8h40m stayed)
    await punch(tue, '09:05', '18:00') // in the grace - not late
    await punch(wed, '09:25', '18:00') // 2nd late - the penalty
    await punch(thu, '11:30', '20:00') // 2h30m late - first half absent (it is also the 3rd late)
    await punch(fri, '09:00', '14:30') // out 3h30m early - second half absent; 5h30m stayed = a half day anyway
    await daysService.recompute([employee.id], mon, fri)
    expect(await dayOf(mon)).toMatchObject({ status: 'PRESENT', lateMinutes: 10, note: null })
    expect(await dayOf(tue)).toMatchObject({ status: 'PRESENT', lateMinutes: 0 })
    // (lates count per attendance month - the 26th to the 25th)
    if (daysService.cycleOf(mon, 26).month === daysService.cycleOf(wed, 26).month) expect(await dayOf(wed)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT', status: 'HALF_DAY', note: '2nd late this month - first half absent' })
    expect(await dayOf(thu)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT', note: 'In 2h 30m late - first half absent' })
    expect(await dayOf(fri)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'ABSENT' })
  })

  // a first-half holiday (Holi morning off): arriving late for the second half counts as a late day, and when it is the
  // Nth it is the second half - the half worked - that is absent (the user, 2026-11-25)
  it('counts a late arrival after a morning holiday, and the penalty takes that afternoon', async () => {
    const [mon, tue] = week.map((d) => new Date(d.getTime() - 7 * DAY)) as [Date, Date]
    const person = await createEmployee({ companyId: companyIdOf, plantId: plantIdOf })
    await shiftsService.assignShift({ employeeCodes: [person.employeeCode], patternId, startWeek: 1, policyId, effectiveFrom: new Date(mon.getTime() - 7 * DAY) }, hr)
    const lists = await holidaySetup(companyIdOf)
    await followList([person.id], lists.holidayListId)
    await prisma.holiday.create({
      data: { date: tue, name: `Holi ${tag}`, portion: 'FIRST_HALF', categoryId: lists.categoryId, createdById: 0, updatedById: 0, lists: { create: { holidayListId: lists.holidayListId, createdById: 0, updatedById: 0 } } },
    })
    const tap = (day: Date, ...clocks: string[]) =>
      prisma.punch.createMany({
        data: clocks.map((c) => {
          const [h, m] = c.split(':').map(Number) as [number, number]
          return { employeeId: person.id, employeeCode: person.employeeCode, punchedAt: zonedInstant(day, h * 60 + m, timezone), source: 'UPLOAD' as const, createdById: 0, updatedById: 0 }
        }),
      })
    await tap(mon, '09:20', '18:00') // 1st late
    await tap(tue, '13:40', '18:00') // the afternoon's start is 13:00: 40 minutes late - the 2nd
    await daysService.recompute([person.id], mon, tue)
    const day = await prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: person.id, date: tue } }, select: { firstHalf: true, secondHalf: true, lateMinutes: true, note: true } })
    expect(day.lateMinutes).toBe(30)
    if (daysService.cycleOf(mon, 26).month === daysService.cycleOf(tue, 26).month) {
      expect(day).toMatchObject({ firstHalf: 'HOLIDAY', secondHalf: 'ABSENT', note: '2nd late this month - second half absent' })
    }
  })

  it('only Attendance Edit for all companies changes a policy; the default cannot be retired', async () => {
    const companyHr = userWith({ id: 0, employeeCode: 'HRCO' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row((await createCompany()).id, null, null)] }])
    await expect(
      policiesService.createPolicy({ name: `Co ${tag}`, graceMinutes: 0, fullDayMinutes: null, halfDayMinutes: 240, latesPerHalfDayCut: null, veryLateMinutes: null, veryEarlyMinutes: null }, companyHr),
    ).rejects.toThrow('shared by every company')
    const standard = (await policiesService.listPolicies(hr)).find((p) => p.isDefault)!
    await expect(policiesService.updatePolicy({ id: standard.id, isActive: false }, hr)).rejects.toThrow('cannot be retired')
  })

  // dated policy changes (the user, 2026-11-23): a change from a date reworks the days from then; the days before keep the
  // rules they had, even when worked out again later
  it('applies a change from its date only, and keeps the old rules for the days before', async () => {
    const [mon, , wed] = week as [Date, Date, Date]
    const companyId = (await createCompany()).id
    const person = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    const shift = await shiftsService.createShift({ code: `V${tag}`, name: `Dated ${tag}`, start: 540, end: 1080, breakMinutes: 0 }, hr)
    const policy = await policiesService.createPolicy({ name: `Dated ${tag}`, graceMinutes: 10, fullDayMinutes: null, halfDayMinutes: 240, latesPerHalfDayCut: null, veryLateMinutes: null, veryEarlyMinutes: null }, hr)
    const pattern = await shiftsService.createPattern({ name: `Dated ${tag}`, days: [shift.id, shift.id, shift.id, shift.id, shift.id, 0, 0], halfDays: [] }, hr)
    await shiftsService.assignShift({ employeeCodes: [person.employeeCode], patternId: pattern.id, startWeek: 1, policyId: policy.id, effectiveFrom: new Date(mon.getTime() - 7 * DAY) }, hr)
    const [p] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [person.id], from: mon, to: wed })
    for (const d of [mon, wed]) {
      await prisma.punch.createMany({
        data: [545, 1080].map((m) => ({ employeeId: person.id, employeeCode: person.employeeCode, punchedAt: zonedInstant(d, m, p!.timezone), source: 'UPLOAD' as const, createdById: 0, updatedById: 0 })),
      })
    }
    const late = async (d: Date) => (await prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: person.id, date: d } }, select: { lateMinutes: true } })).lateMinutes
    await daysService.recompute([person.id], mon, wed)
    // in at 09:05 with 10 minutes' grace: not late
    expect([await late(mon), await late(wed)]).toEqual([0, 0])
    // no grace from Wednesday: the change reworks Wednesday at once; Monday keeps the old rules
    await expect(policiesService.updatePolicy({ id: policy.id, graceMinutes: 0 }, hr)).rejects.toThrow()
    const changed = await policiesService.updatePolicy({ id: policy.id, graceMinutes: 0, effectiveFrom: wed }, hr)
    expect(changed.versions.map((v) => v.graceMinutes)).toEqual([10, 0])
    expect([await late(mon), await late(wed)]).toEqual([0, 5])
    // worked out again later: still the rules of each day
    await daysService.recompute([person.id], mon, wed)
    expect([await late(mon), await late(wed)]).toEqual([0, 5])
  })
})
