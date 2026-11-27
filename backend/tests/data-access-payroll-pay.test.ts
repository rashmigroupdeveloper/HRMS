import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma, SYSTEM_ACTOR, type DayStatus } from '#core/db/prisma'
import { attendanceService } from '#modules/attendance'
import { employeesService } from '#modules/employees'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { payrollService } from '#modules/payroll'
import * as calculationService from '../src/modules/payroll/calculation/calculation.service.js'
import * as inputsService from '../src/modules/payroll/inputs/inputs.service.js'
import * as peopleService from '../src/modules/payroll/people/people.service.js'
import { daysIn } from '../src/modules/payroll/people/people.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 3, the money (approved by the user 2026-11-27): what "Work out pay" earns each person, who may see the
// amounts (Payroll View alone shows whether pay is worked out, never the figures), held pay and inputs that make it
// stale. Every date comes from the run's period, so the test holds whatever start day the test database has. The
// attendance month of a far-off year cannot really be locked, so the lock's answer is put in its place. Made-up figures.

const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2094, 2, 1))
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
type Level = 'READ' | 'WRITE'
const payroll = (companyId: number | null, level: Level = 'WRITE', extra: { SALARY?: Level } = {}) =>
  userWith({ id: 0, employeeCode: 'PAYTEST' }, [{ access: { PAYROLL: level, ...extra }, rows: [row(companyId, null, null, level)] }])

describe('Payroll stage 3: the pay worked out', () => {
  let a: number, b: number
  let basic: number, allowance: number, incentive: number
  let e1: number, e2: number
  let runA: number, runB: number
  let from: Date, days: number
  let p1: number, p2: number

  const locked = () => vi.spyOn(attendanceService, 'payrollLockOf').mockResolvedValue({ locked: true, lockedAt: new Date(Date.UTC(2000, 0, 1)) })
  const workOut = async (viewer = payroll(a)) => calculationService.compute(viewer, { runId: runA, expectedComputedAt: (await payrollService.getRun(admin, { id: runA })).computedAt })
  // (a function: the companies are made in beforeAll)
  const withSalary = () => payroll(a, 'READ', { SALARY: 'READ' })
  const personOf = (viewer: ReturnType<typeof payroll>, personId: number) => peopleService.getPerson(viewer, { runId: runA, personId })

  async function attend(employeeId: number, halves: (i: number) => [DayStatus, DayStatus]) {
    await prisma.attendanceDay.createMany({
      data: Array.from({ length: days }, (_, i) => {
        const [firstHalf, secondHalf] = halves(i)
        return { employeeId, date: addDays(from, i), status: firstHalf, firstHalf, secondHalf, autoStatus: firstHalf, punchCount: 0, workedMinutes: 0, lateMinutes: 0, earlyMinutes: 0, createdById: 0, updatedById: 0 }
      }),
    })
  }

  beforeAll(async () => {
    const setup = await payrollService.getSetup(admin, { payMonth })
    from = setup.attendanceFrom
    days = daysIn(from, setup.attendanceTo)
    const companies = await Promise.all([createCompany(), createCompany()])
    a = companies[0].id; b = companies[1].id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    const [plantA, plantB] = [(await createPlant(a)).id, (await createPlant(b)).id]
    basic = (await salaryComponentsService.createSalaryComponent({ name: `Basic ${tag}`, kind: 'EARNING', displayOrder: 10 }, SYSTEM_ACTOR)).id
    allowance = (await salaryComponentsService.createSalaryComponent({ name: `Fixed allowance ${tag}`, kind: 'EARNING', displayOrder: 20, cutForUnpaidDays: false }, SYSTEM_ACTOR)).id
    incentive = (await salaryComponentsService.createSalaryComponent({ name: `Incentive ${tag}`, kind: 'EARNING', displayOrder: 90, enteredMonthly: true }, SYSTEM_ACTOR)).id
    e1 = (await createEmployee({ companyId: a, plantId: plantA })).id
    e2 = (await createEmployee({ companyId: a, plantId: plantA })).id
    const e3 = (await createEmployee({ companyId: b, plantId: plantB })).id
    // e1: 28,000 a month (Basic 14,000 cut for unpaid days, an allowance of 14,000 that is not); e2: no salary
    for (const employeeId of [e1, e3]) {
      await prisma.$transaction((tx) =>
        employeesService.saveSalary(
          employeeId,
          { effectiveFrom: new Date(Date.UTC(2026, 0, 1)), annualCtc: 336000, performancePayAnnual: null, currency: 'INR', reason: 'JOINING', jobChangeRequestId: null, approvedAt: null, approvedById: null, lines: [{ salaryComponentId: basic, monthlyAmount: 14000 }, { salaryComponentId: allowance, monthlyAmount: 14000 }] },
          false,
          SYSTEM_ACTOR,
          tx,
        ),
      )
    }
    // e1 absent one whole day; e2 and e3 present
    await attend(e1, (i) => (i === 2 ? ['ABSENT', 'ABSENT'] : ['PRESENT', 'PRESENT']))
    await attend(e2, () => ['PRESENT', 'PRESENT'])
    await attend(e3, () => ['PRESENT', 'PRESENT'])
    const input = (companyId: number) => ({ companyId, payMonth, expectedAttendanceFrom: from, expectedAttendanceTo: setup.attendanceTo })
    runA = (await payrollService.createRun(payroll(a), input(a))).id
    runB = (await payrollService.createRun(payroll(b), input(b))).id
    const members = await prisma.payrollRunEmployee.findMany({ where: { payrollRunId: runA }, select: { id: true, employeeId: true } })
    p1 = members.find((m) => m.employeeId === e1)!.id
    p2 = members.find((m) => m.employeeId === e2)!.id
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('nothing is worked out before "Work out pay"; company A never works out company B', async () => {
    expect(await payrollService.getRun(admin, { id: runA })).toMatchObject({ peopleHeld: null, peopleToWorkOutAgain: null, earnedGross: null })
    expect((await personOf(withSalary(), p1)).pay).toBeNull()
    locked()
    await expect(calculationService.compute(payroll(a), { runId: runB, expectedComputedAt: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(calculationService.compute(payroll(a, 'READ'), { runId: runA, expectedComputedAt: null })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('earns each line for the paid days, rounded to the rupee; an allowance not cut is paid in full; no salary = held', async () => {
    locked()
    expect(await workOut()).toMatchObject({ people: 2, peopleWithUnpaidDays: 1, peopleHeld: 1 })
    const basicEarned = Math.round((14000 * (days - 1)) / days)
    const one = await personOf(withSalary(), p1)
    expect(one.pay).toMatchObject({ status: 'WORKED_OUT', heldFor: [], periodDays: days, earnedGross: basicEarned + 14000 })
    expect(one.pay!.lines!.map((l) => [l.component.id, l.amount, l.fromInput])).toEqual([[basic, basicEarned, false], [allowance, 14000, false]])
    const two = await personOf(withSalary(), p2)
    expect(two.pay).toMatchObject({ status: 'HELD', heldFor: ['NO_SALARY'], lines: [], earnedGross: null })

    const list = await peopleService.listPeople(withSalary(), { runId: runA, page: 1, pageSize: 50 })
    expect(list.items.find((p) => p.id === p1)).toMatchObject({ payStatus: 'WORKED_OUT', earnedGross: basicEarned + 14000, flags: { payNotWorkedOut: false } })
    expect(list.items.find((p) => p.id === p2)).toMatchObject({ payStatus: 'HELD', heldFor: ['NO_SALARY'], earnedGross: null, flags: { payNotWorkedOut: true } })
    expect(list.counts.payNotWorkedOut).toBe(1)
    expect((await peopleService.listPeople(withSalary(), { runId: runA, flag: 'PAY_NOT_WORKED_OUT', page: 1, pageSize: 50 })).items.map((p) => p.id)).toEqual([p2])
    expect(await payrollService.getRun(withSalary(), { id: runA })).toMatchObject({ peopleHeld: 1, peopleToWorkOutAgain: 0, peopleToCheck: 1, earnedGross: basicEarned + 14000 })
  })

  it('Payroll alone sees whether pay is worked out, never the amounts', async () => {
    const viewer = payroll(a, 'READ')
    const one = await personOf(viewer, p1)
    expect(one.pay).toMatchObject({ status: 'WORKED_OUT', lines: null, earnedGross: null })
    const list = await peopleService.listPeople(viewer, { runId: runA, page: 1, pageSize: 50 })
    expect(list.items.every((p) => p.earnedGross === null)).toBe(true)
    expect(list.items.find((p) => p.id === p1)!.payStatus).toBe('WORKED_OUT')
    expect(await payrollService.getRun(viewer, { id: runA })).toMatchObject({ peopleHeld: 1, earnedGross: null })
    // Salary View over another company does not count
    const salaryElsewhere = userWith({ id: 0, employeeCode: 'PAYTEST' }, [{ access: { PAYROLL: 'READ' }, rows: [row(a, null, null, 'READ')] }, { access: { SALARY: 'READ' }, rows: [row(b, null, null, 'READ')] }])
    expect((await personOf(salaryElsewhere, p1)).pay).toMatchObject({ lines: null, earnedGross: null })
    await expect(peopleService.getPerson(payroll(b, 'READ', { SALARY: 'READ' }), { runId: runA, personId: p1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('an input changed after the pay was worked out makes that person "work out again"; working out pays it as typed', async () => {
    const { id } = await inputsService.createInput(payroll(a), { runId: runA, personId: p1, salaryComponentId: incentive, amount: 1234.5, note: 'Made-up incentive' })
    expect((await personOf(withSalary(), p1)).pay).toMatchObject({ status: 'AGAIN', lines: [], earnedGross: null })
    expect(await payrollService.getRun(withSalary(), { id: runA })).toMatchObject({ peopleToWorkOutAgain: 1, peopleToCheck: 2 })
    locked()
    await workOut()
    const again = await personOf(withSalary(), p1)
    expect(again.pay!.lines!.find((l) => l.component.id === incentive)).toMatchObject({ amount: 1234.5, fromInput: true })
    expect(again.pay!.earnedGross).toBe(Math.round((14000 * (days - 1)) / days) + 14000 + 1234.5)
    // a new note alone changes no amount; deleting the input does
    await inputsService.updateInput(payroll(a), { runId: runA, id, note: 'Made-up incentive, approved' })
    expect((await personOf(withSalary(), p1)).pay!.status).toBe('WORKED_OUT')
    await inputsService.deleteInput(payroll(a), { runId: runA, id })
    expect((await personOf(withSalary(), p1)).pay!.status).toBe('AGAIN')
  })

  it('the results stay out of the change history; refreshing the people removes them', async () => {
    expect(await prisma.auditLog.count({ where: { model: 'PayrollRunLine' } })).toBe(0)
    const run = await payrollService.getRun(admin, { id: runA })
    await peopleService.refresh(payroll(a), { runId: runA, expectedRefreshedAt: run.peopleRefreshedAt })
    expect(await prisma.payrollRunLine.count({ where: { runEmployee: { payrollRunId: runA } } })).toBe(0)
    expect(await payrollService.getRun(admin, { id: runA })).toMatchObject({ computedAt: null, peopleHeld: null, earnedGross: null })
  })
})
