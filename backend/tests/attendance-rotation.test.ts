import { prisma } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as rostersService from '../src/modules/attendance/rosters/rosters.service.js'
import { assignShiftInput } from '../src/modules/attendance/shifts/shifts.schema.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Schedule patterns and a rare roster (the user, 2026-11-22 / 2026-11-23): an employee follows a pattern - it decides
// every day without any roster row, lined up with Monday-Sunday from the week chosen; the roster keeps only real changes
// (a day set back to the pattern's is taken out).

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 24 * 60 * 60 * 1000
// far in the future: no attendance month is locked there and nothing is worked out yet
// a Monday, far in the future: no attendance month is locked there and nothing is worked out yet
const start = new Date(Date.UTC(2031, 0, 6))
const day = (n: number) => new Date(start.getTime() + n * DAY)
const hr = userWith({ id: 0, employeeCode: 'HRROT' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

describe('rotations and the rare roster', () => {
  let employee: { id: number; employeeCode: string }
  let a: number
  let b: number

  const plans = async (from: Date, to: Date) => {
    const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from, to })
    const days = (await daysService.loadPlans(people, from, to)).get(employee.id)!
    return [...days.values()].map((p) => (p.kind === 'WORK' ? p.shift?.id : p.kind))
  }
  const rows = () => prisma.rosterEntry.count({ where: { employeeId: employee.id } })

  beforeAll(async () => {
    const companyId = (await createCompany()).id
    employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    a = (await shiftsService.createShift({ code: `RA${tag}`, name: `Rotation A ${tag}`, start: 360, end: 840, breakMinutes: 30 }, hr)).id
    b = (await shiftsService.createShift({ code: `RB${tag}`, name: `Rotation B ${tag}`, start: 840, end: 1320, breakMinutes: 30 }, hr)).id
    // two weeks: A Monday-Friday, then B Monday-Friday, weekends off - starting in its second week
    const pattern = await shiftsService.createPattern({ name: `A week B week ${tag}`, days: [a, a, a, a, a, 0, 0, b, b, b, b, b, 0, 0], halfDays: [] }, hr)
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode], patternId: pattern.id, startWeek: 2, effectiveFrom: start }, hr)
  })
  afterAll(() => prisma.$disconnect())

  it('works out every day from the pattern, with no roster row', async () => {
    expect(await plans(day(0), day(9))).toEqual([b, b, b, b, b, 'WEEKLY_OFF', 'WEEKLY_OFF', a, a, a])
    expect(await rows()).toBe(0)
  })

  it('keeps only real changes on the roster', async () => {
    // B on day 1 is the rotation's own day - nothing is kept
    await rostersService.saveCells(hr, { cells: [{ employeeCode: employee.employeeCode, date: day(1), shiftId: b }] })
    expect(await rows()).toBe(0)
    // A on day 1 is a change - kept as a draft
    await rostersService.saveCells(hr, { cells: [{ employeeCode: employee.employeeCode, date: day(1), shiftId: a }] })
    expect(await rows()).toBe(1)
    // back to B (the default) - the row is taken out
    expect(await rostersService.saveCells(hr, { cells: [{ employeeCode: employee.employeeCode, date: day(1), shiftId: b }] })).toEqual({ saved: 1, removed: 1 })
    expect(await rows()).toBe(0)
    // an approved change back to the pattern's day (Saturday off) takes a published day out too
    await rostersService.setPublishedDay(employee.id, day(5), a, 0)
    expect(await plans(day(5), day(5))).toEqual([a])
    await rostersService.setPublishedDay(employee.id, day(5), null, 0)
    expect(await rows()).toBe(0)
  })

  it('needs a pattern, and lines a 7 / 14 / 21-day pattern up with Monday-Sunday from the week chosen', () => {
    const base = { employeeCodes: ['X1'], effectiveFrom: start }
    expect(assignShiftInput.safeParse({ ...base }).success).toBe(false)
    expect(assignShiftInput.parse({ ...base, patternId: 1 }).startWeek).toBe(1)
    expect(shiftsService.patternDayOf(start, 1, 7)).toBe(1)
    expect(shiftsService.patternDayOf(day(6), 1, 7)).toBe(7)
    expect(shiftsService.patternDayOf(start, 2, 14)).toBe(8)
    expect(shiftsService.patternDayOf(day(2), 3, 21)).toBe(17)
  })
})
