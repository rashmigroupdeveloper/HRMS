import { prisma } from '#core/db/prisma'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { employeesService } from '#modules/employees'
import { dayKey, zonedInstant } from '#shared/utils/time'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as policiesService from '../src/modules/attendance/policies/policies.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Dated shifts and patterns (the user, 2026-11-23 - the review found that editing a shift's times or a pattern's days
// reworked days already passed whenever they were worked out again): a change applies from a date; the days before keep
// what they had, also when worked out again later.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 24 * 60 * 60 * 1000
const hr = userWith({ id: 0, employeeCode: 'HRDATED' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

// the Monday to Wednesday of the full week before last (every day has passed)
function lastWeek() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const monday = new Date(today.getTime() - (((today.getUTCDay() + 6) % 7) + 14) * DAY)
  return [0, 1, 2].map((i) => new Date(monday.getTime() + i * DAY)) as [Date, Date, Date]
}

describe('dated shifts and patterns', () => {
  const [mon, tue, wed] = lastWeek()
  let policyId: number

  beforeAll(async () => {
    // no grace, so the late minutes show the shift's start exactly
    policyId = (await policiesService.createPolicy({ name: `Dated shifts ${tag}`, graceMinutes: 0, fullDayMinutes: null, halfDayMinutes: 240, latesPerHalfDayCut: null, veryLateMinutes: null, veryEarlyMinutes: null }, hr)).id
  })
  afterAll(() => prisma.$disconnect())

  // an employee on a Monday-Friday pattern of this shift from the week before
  async function personOn(shiftId: number, name: string) {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    const pattern = await shiftsService.createPattern({ name: `${name} ${tag}`, days: [shiftId, shiftId, shiftId, shiftId, shiftId, 0, 0], halfDays: [] }, hr)
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode], patternId: pattern.id, startWeek: 1, policyId, effectiveFrom: new Date(mon.getTime() - 7 * DAY) }, hr)
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: mon, to: wed })
    return { employee, pattern, person: person! }
  }

  it("keeps a shift's old times for the days before a change, also when they are worked out again", async () => {
    const shift = await shiftsService.createShift({ code: `T${tag}`, name: `Times ${tag}`, start: 540, end: 1080, breakMinutes: 0 }, hr)
    const { employee, person } = await personOn(shift.id, 'Times')
    // in at 09:30 on Monday and Wednesday
    for (const day of [mon, wed]) {
      await prisma.punch.createMany({
        data: [570, 1080].map((m) => ({ employeeId: employee.id, employeeCode: employee.employeeCode, punchedAt: zonedInstant(day, m, person.timezone), source: 'UPLOAD' as const, createdById: 0, updatedById: 0 })),
      })
    }
    const late = async (d: Date) => (await prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: employee.id, date: d } }, select: { lateMinutes: true } })).lateMinutes
    await daysService.recompute([employee.id], mon, wed)
    expect([await late(mon), await late(wed)]).toEqual([30, 30])

    // the times need the date they apply from
    await expect(shiftsService.updateShift({ id: shift.id, start: 555 }, hr)).rejects.toThrow('Give the date')
    // starting at 09:15 from Wednesday: Wednesday is worked out again at once, Monday keeps 09:00
    const changed = await shiftsService.updateShift({ id: shift.id, start: 555, effectiveFrom: wed }, hr)
    expect(changed.versions.map((v) => v.start)).toEqual(['09:00', '09:15'])
    expect([await late(mon), await late(wed)]).toEqual([30, 15])
    // worked out again later (a punch, a holiday, a correction...): still each day's own times
    await daysService.recompute([employee.id], mon, wed)
    expect([await late(mon), await late(wed)]).toEqual([30, 15])
  })

  it("keeps a pattern's old days for the days before a change", async () => {
    const shift = await shiftsService.createShift({ code: `W${tag}`, name: `Week ${tag}`, start: 540, end: 1080, breakMinutes: 0 }, hr)
    const { employee, pattern, person } = await personOn(shift.id, 'Week')
    const kinds = async () => {
      const plan = (await daysService.loadPlans([person], mon, wed)).get(employee.id)!
      return [mon, tue, wed].map((d) => plan.get(dayKey(d))!.kind)
    }
    expect(await kinds()).toEqual(['WORK', 'WORK', 'WORK'])
    await expect(shiftsService.updatePattern({ id: pattern.id, days: [shift.id, 0, shift.id, shift.id, shift.id, 0, 0] }, hr)).rejects.toThrow('Give the date')
    // Tuesdays off from Tuesday on - then from Wednesday the Wednesdays off instead: that Tuesday keeps the first change
    await shiftsService.updatePattern({ id: pattern.id, days: [shift.id, 0, shift.id, shift.id, shift.id, 0, 0], effectiveFrom: tue }, hr)
    await shiftsService.updatePattern({ id: pattern.id, days: [shift.id, shift.id, 0, shift.id, shift.id, 0, 0], effectiveFrom: wed }, hr)
    expect(await kinds()).toEqual(['WORK', 'WEEKLY_OFF', 'WEEKLY_OFF'])
    // the days already worked out were worked out again: Wednesday (no punches) is an off day, not an absence
    const day = await prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: employee.id, date: wed } }, select: { status: true } })
    expect(day.status).toBe('WEEKLY_OFF')
  })

  it('keeps a shift that a later version of a pattern names', async () => {
    const now = new Date()
    const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 4))
    const first = await shiftsService.createShift({ code: `F${tag}`, name: `First ${tag}`, start: 540, end: 1080, breakMinutes: 0 }, hr)
    const later = await shiftsService.createShift({ code: `L${tag}`, name: `Later ${tag}`, start: 600, end: 1140, breakMinutes: 0 }, hr)
    const pattern = await shiftsService.createPattern({ name: `Later ${tag}`, days: [first.id, 0, 0, 0, 0, 0, 0], halfDays: [] }, hr)
    await shiftsService.updatePattern({ id: pattern.id, days: [later.id, 0, 0, 0, 0, 0, 0], effectiveFrom: nextYear }, hr)
    await expect(shiftsService.updateShift({ id: later.id, isActive: false }, hr)).rejects.toThrow('is used by')
    await expect(shiftsService.updateShift({ id: first.id, isActive: false }, hr)).rejects.toThrow('is used by')
  })
})
