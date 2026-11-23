import { prisma } from '#core/db/prisma'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { employeesService } from '#modules/employees'
import { zonedInstant } from '#shared/utils/time'
import { afterAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// A night shift followed by a morning shift (found in the 2026-11-23 review): the night's out at 06:05 and the morning's in
// at 06:10 both went to the morning (nearest), so the night lost its out punch. The punches around the hand-over are now
// split by order.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 86_400_000
const hr = userWith({ id: 0, employeeCode: 'HRNIGHT' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

describe('a night shift then a morning shift', () => {
  afterAll(() => prisma.$disconnect())

  it('gives the night its out punch and the morning its in punch', async () => {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const mon = new Date(today.getTime() - (((today.getUTCDay() + 6) % 7) + 14) * DAY)
    const tue = new Date(mon.getTime() + DAY)
    const night = await shiftsService.createShift({ code: `N${tag}`, name: `Night ${tag}`, start: 1320, end: 360, breakMinutes: 0 }, hr)
    const morning = await shiftsService.createShift({ code: `E${tag}`, name: `Early ${tag}`, start: 360, end: 840, breakMinutes: 0 }, hr)
    const pattern = await shiftsService.createPattern({ name: `Night then early ${tag}`, days: [night.id, morning.id, 0, 0, 0, 0, 0], halfDays: [] }, hr)
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode], patternId: pattern.id, startWeek: 1, effectiveFrom: new Date(mon.getTime() - 7 * DAY) }, hr)
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: mon, to: tue })
    const at = (day: Date, minute: number) => zonedInstant(day, minute, person!.timezone)
    // Monday 21:58 in, Tuesday 06:05 out of the night; 06:10 in, 14:02 out of the morning
    await prisma.punch.createMany({
      data: [at(mon, 1318), at(tue, 365), at(tue, 370), at(tue, 842)].map((punchedAt) => ({ employeeId: employee.id, employeeCode: employee.employeeCode, punchedAt, source: 'UPLOAD' as const, createdById: 0, updatedById: 0 })),
    })
    await daysService.recompute([employee.id], mon, tue)
    const dayOf = (date: Date) => prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: employee.id, date } }, select: { firstIn: true, lastOut: true, status: true } })
    expect(await dayOf(mon)).toMatchObject({ firstIn: at(mon, 1318), lastOut: at(tue, 365), status: 'PRESENT' })
    expect(await dayOf(tue)).toMatchObject({ firstIn: at(tue, 370), lastOut: at(tue, 842), status: 'PRESENT' })
  })
})
