import { prisma } from '#core/db/prisma'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as punchesService from '../src/modules/attendance/punches/punches.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Punches typed by hand for testing (the user, 2026-11-22): one employee, one day; the same punch is kept once, the day is
// worked out, and the data access applies.

const hr = userWith({ id: 0, employeeCode: 'HRMAN' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
// a past weekday, so the times are not in the future
const day = new Date(Date.UTC(2026, 0, 6))

describe('punches typed by hand (testing)', () => {
  let employee: { id: number; employeeCode: string }
  let companyId: number

  beforeAll(async () => {
    companyId = (await createCompany()).id
    employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
  })
  afterAll(() => prisma.$disconnect())

  it('adds the punches once and works the day out', async () => {
    const input = { employeeCode: employee.employeeCode, date: day, times: [9 * 60 + 2, 18 * 60 + 10] }
    expect(await punchesService.addManualPunches(input, hr)).toEqual({ added: 2, duplicates: 0 })
    expect(await punchesService.addManualPunches(input, hr)).toEqual({ added: 0, duplicates: 2 })
    const punches = await prisma.punch.findMany({ where: { employeeId: employee.id }, select: { device: true } })
    expect(punches.map((p) => p.device)).toEqual(['Manual entry (testing)', 'Manual entry (testing)'])
    const worked = await prisma.attendanceDay.findUnique({ where: { employeeId_date: { employeeId: employee.id, date: day } }, select: { punchCount: true } })
    expect(worked?.punchCount).toBe(2)
  })

  it('needs Attendance setup covering the employee', async () => {
    const otherCompany = userWith({ id: 0, employeeCode: 'HRMANB' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row((await createCompany()).id, null, null)] }])
    await expect(punchesService.addManualPunches({ employeeCode: employee.employeeCode, date: day, times: [600] }, otherCompany)).rejects.toThrow('No employee found')
  })
})
