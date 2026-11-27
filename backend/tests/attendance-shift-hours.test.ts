import { prisma } from '#core/db/prisma'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { employeesService } from '#modules/employees'
import { zonedInstant } from '#shared/utils/time'
import { afterAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The home page's day card (2026-11-27): attendance.overview's `today.shiftHours` - when the day's shift runs, a night
// shift ending the next day, and nothing on a weekly off.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 86_400_000
const hr = userWith({ id: 0, employeeCode: 'HRHOURS' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

describe("today's shift hours", () => {
  afterAll(() => prisma.$disconnect())

  it('gives the shift start and end, the next day for a night shift, and null on a weekly off', async () => {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const mon = new Date(today.getTime() - (((today.getUTCDay() + 6) % 7) + 14) * DAY)
    const tue = new Date(mon.getTime() + DAY)
    const wed = new Date(tue.getTime() + DAY)
    const night = await shiftsService.createShift({ code: `NH${tag}`, name: `Night hours ${tag}`, start: 1320, end: 360, breakMinutes: 0 }, hr)
    const general = await shiftsService.createShift({ code: `GH${tag}`, name: `General hours ${tag}`, start: 540, end: 1080, breakMinutes: 60 }, hr)
    const pattern = await shiftsService.createPattern({ name: `Hours week ${tag}`, days: [night.id, general.id, 0, 0, 0, 0, 0], halfDays: [] }, hr)
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode], patternId: pattern.id, startWeek: 1, effectiveFrom: new Date(mon.getTime() - 7 * DAY) }, hr)
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: mon, to: wed })
    const at = (day: Date, minute: number) => zonedInstant(day, minute, person!.timezone)

    expect((await daysService.getDayOf(person!, mon)).shiftHours).toEqual({ start: '22:00', end: '06:00', startsAt: at(mon, 1320), endsAt: at(tue, 360) })
    expect((await daysService.getDayOf(person!, tue)).shiftHours).toEqual({ start: '09:00', end: '18:00', startsAt: at(tue, 540), endsAt: at(tue, 1080) })
    expect((await daysService.getDayOf(person!, wed)).shiftHours).toBeNull()
  })

  // "attendance not tracked" (2026-11-27): known from the marker itself, before any day is worked out
  it('says when attendance is not tracked on the day, with no day worked out yet', async () => {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    const day = new Date(Date.UTC(2099, 0, 6))
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: day, to: day })
    expect((await daysService.getDayOf(person!, day)).notTracked).toBe(false)
    await prisma.attendanceExemption.create({ data: { employeeId: employee.id, fromDate: new Date(Date.UTC(2099, 0, 1)), toDate: null, reason: 'Field sales - does not punch', createdById: 0, updatedById: 0 } })
    const view = await daysService.getDayOf(person!, day)
    expect(view).toMatchObject({ notTracked: true, status: null })
    expect((await daysService.getDayOf(person!, new Date(Date.UTC(2098, 11, 31)))).notTracked).toBe(false)
  })
})
