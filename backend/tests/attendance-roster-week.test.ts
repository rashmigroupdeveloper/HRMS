import { prisma } from '#core/db/prisma'
import { afterAll, describe, expect, it } from 'vitest'
import * as rostersService from '../src/modules/attendance/rosters/rosters.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The roster's 48-hour warning (found in the 2026-11-23 review): it added up only the days on screen, so a Sunday shown
// alone never warned about the six days before it.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 86_400_000
const hr = userWith({ id: 0, employeeCode: 'HRROSTER' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

describe('the 48-hour warning', () => {
  afterAll(() => prisma.$disconnect())

  it('counts the whole week, also the days not on screen', async () => {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    // the Sunday of the week after next
    const sunday = new Date(today.getTime() + (13 - ((today.getUTCDay() + 6) % 7)) * DAY)
    const shift = await shiftsService.createShift({ code: `W${tag}`, name: `Long ${tag}`, start: 540, end: 1080, breakMinutes: 0 }, hr)
    // Monday to Saturday, 9 hours each: 54 hours
    const pattern = await shiftsService.createPattern({ name: `Six long days ${tag}`, days: [shift.id, shift.id, shift.id, shift.id, shift.id, shift.id, 0], halfDays: [] }, hr)
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode], patternId: pattern.id, startWeek: 1, effectiveFrom: new Date(sunday.getTime() - 20 * DAY) }, hr)
    // test data: the Sunday set to work on the roster (a draft)
    await prisma.rosterEntry.create({ data: { employeeId: employee.id, date: sunday, shiftId: shift.id, createdById: 0, updatedById: 0 } })
    const grid = await rostersService.getGrid(hr, { from: sunday, to: sunday, search: employee.employeeCode })
    expect(grid.rows[0]!.cells[0]!.warnings).toContain('63h this week (more than 48h)')
  })
})
