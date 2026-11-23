import { prisma } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// No schedule is built into the code (the user, 2026-11-22 / 2026-11-23): employees with none given follow the default
// schedule pattern - a normal pattern, always there, that cannot be retired (only moved to another pattern); a shift a
// pattern in use names cannot be retired either. The default is never moved here: other test files run at the same time
// against the same database.

describe('the default schedule pattern', () => {
  const hr = userWith({ id: 0, employeeCode: 'HRDEF' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
  const tag = Math.random().toString(36).slice(2, 7).toUpperCase()

  it('is a real pattern that employees with no schedule follow, and cannot be retired', async () => {
    const defaults = (await shiftsService.listPatterns(hr, true)).filter((p) => p.isDefault && p.isActive)
    expect(defaults).toHaveLength(1)
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    const day = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: day, to: day })
    const plan = (await daysService.loadPlans([person!], day, day)).get(employee.id)!.values().next().value!
    expect(plan.pattern).toBe(defaults[0]!.name)
    await expect(shiftsService.updatePattern({ id: defaults[0]!.id, isActive: false }, hr)).rejects.toThrow('cannot be retired')
    expect((await prisma.rosterPattern.findUniqueOrThrow({ where: { id: defaults[0]!.id }, select: { isActive: true } })).isActive).toBe(true)
  })

  it('keeps a shift that a pattern in use names', async () => {
    const shift = await shiftsService.createShift({ code: `D${tag}`, name: `Default test ${tag}`, start: 540, end: 1080, breakMinutes: 0 }, hr)
    await shiftsService.createPattern({ name: `Default test week ${tag}`, days: [shift.id, 0, 0, 0, 0, 0, 0], halfDays: [] }, hr)
    await expect(shiftsService.updateShift({ id: shift.id, isActive: false }, hr)).rejects.toThrow('is used by')
  })
})
