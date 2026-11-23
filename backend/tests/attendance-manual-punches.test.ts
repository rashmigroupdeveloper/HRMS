import { prisma } from '#core/db/prisma'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
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

// Found in the 2026-11-23 review: two recomputes of the same employee at once (the nightly close and HR's correction, two
// uploads) both read, then both deleted and wrote the days - one failed on the duplicate days or wrote older results
describe('working the same days out twice at once', () => {
  it('finishes both, one after the other', async () => {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    await punchesService.addManualPunches({ employeeCode: employee.employeeCode, date: day, times: [9 * 60, 18 * 60] }, hr)
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => daysService.recompute([employee.id], day, day)))
    expect(results.filter((r) => r.status === 'rejected').map((r) => String((r as PromiseRejectedResult).reason))).toEqual([])
    expect(await prisma.attendanceDay.count({ where: { employeeId: employee.id, date: day } })).toBe(1)
  })
})

// Found in the 2026-11-23 review: two taps a minute apart counted as in and out - a 1-minute day, absent - so the
// missed-punch request did not fit the day
describe('two taps at the door', () => {
  it('is a missed punch, not a 1-minute day', async () => {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    await punchesService.addManualPunches({ employeeCode: employee.employeeCode, date: day, times: [9 * 60, 9 * 60 + 1] }, hr)
    const worked = await prisma.attendanceDay.findUnique({ where: { employeeId_date: { employeeId: employee.id, date: day } }, select: { firstHalf: true, secondHalf: true, punchCount: true } })
    expect(worked).toEqual({ firstHalf: 'MISSED_PUNCH', secondHalf: 'MISSED_PUNCH', punchCount: 2 })
  })
})

// Found in the 2026-11-23 review: the day board showed everyone absent on a day still to come
describe('the day board for a day to come', () => {
  it('shows "not in yet", never absent', async () => {
    const companyId = (await createCompany()).id
    await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    const viewer = userWith({ id: 0, employeeCode: 'BOARD' }, [{ access: { ATTENDANCE: 'READ' }, rows: [row(companyId, null, null, 'READ')] }])
    const now = new Date()
    // a Wednesday next week - a working day
    const nextWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7 + ((3 - now.getUTCDay() + 7) % 7)))
    const board = await daysService.getBoard(viewer, { scope: 'ALL', companyIds: [companyId], date: nextWeek })
    expect(board.items.length).toBeGreaterThan(0)
    expect(board.summary.absent).toBe(0)
    expect(board.summary.notIn).toBe(board.items.length)
  })
})
