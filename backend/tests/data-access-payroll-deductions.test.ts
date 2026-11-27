import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { attendanceService } from '#modules/attendance'
import { employeesSchemas, employeesService } from '#modules/employees'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { payrollService } from '#modules/payroll'
import * as calculationService from '../src/modules/payroll/calculation/calculation.service.js'
import * as inputsService from '../src/modules/payroll/inputs/inputs.service.js'
import * as peopleService from '../src/modules/payroll/people/people.service.js'
import { daysIn } from '../src/modules/payroll/people/people.service.js'
import * as statutoryService from '../src/modules/payroll/statutory/statutory.service.js'
import * as openingsService from '../src/modules/payroll/tax-openings/tax-openings.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { madeUpSettings, placeAt, roleComponents, workLocationIn } from './helpers/payroll.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 4 (approved by the user 2026-11-27): the statutory settings (group-wide), opening tax figures (whose
// records), and what "Work out pay" deducts, holds and shows. MADE-UP rates only, from 2097 (helpers/payroll.ts); the
// run is March 2098, so whatever start day the test database has, its period and ESIC period find them.

const by = { createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }
const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2098, 2, 1))
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
type Level = 'READ' | 'WRITE'
const payroll = (companyId: number | null, level: Level = 'WRITE', extra: { SALARY?: Level } = {}, id = 0) =>
  userWith({ id, employeeCode: 'PAYTEST' }, [{ access: { PAYROLL: level, ...extra }, rows: [row(companyId, null, null, level)] }])

describe('Payroll stage 4: deductions and net pay', () => {
  let a: number, b: number
  let basic: number, hra: number, canteen: number
  let roles: Map<string, number>
  let pf: number, noPlace: number, oldRegime: number, heavy: number, noSlabs: number, other: number
  let runA: number
  let personOf: Map<number, number>
  let from: Date

  const locked = () => vi.spyOn(attendanceService, 'payrollLockOf').mockResolvedValue({ locked: true, lockedAt: new Date(Date.UTC(2000, 0, 1)) })
  const workOut = async () => calculationService.compute(payroll(a), { runId: runA, expectedComputedAt: (await payrollService.getRun(admin, { id: runA })).computedAt })
  const salaryViewer = () => payroll(a, 'READ', { SALARY: 'READ' })
  const person = (employeeId: number, viewer = salaryViewer()) => peopleService.getPerson(viewer, { runId: runA, personId: personOf.get(employeeId)! })
  const byComponent = (lines: { component: { id: number }; amount: number; base: number | null }[] | null) => Object.fromEntries((lines ?? []).map((l) => [l.component.id, [l.amount, l.base]]))

  beforeAll(async () => {
    // made-up settings from 2097: ESIC ceiling 21,000; 10% tax from 0 (the rebate still wipes small incomes); State ZD
    // with professional tax 200 from a gross of 10,000 and LWF 10 / 20 in March; State ZQ has no slabs at all
    await madeUpSettings(2097, 'ZD', { rates: { ESIC_WAGE_CEILING: 21000 }, taxRatePercent: 10 })
    await prisma.professionalTaxSlab.deleteMany({ where: { stateCode: 'ZD', effectiveFrom: new Date(Date.UTC(2097, 0, 1)) } })
    await prisma.professionalTaxSlab.createMany({
      data: [
        { stateCode: 'ZD', effectiveFrom: new Date(Date.UTC(2097, 0, 1)), wagesFrom: 0, wagesTo: 9999, amount: 0, reference: 'made up', ...by },
        { stateCode: 'ZD', effectiveFrom: new Date(Date.UTC(2097, 0, 1)), wagesFrom: 10000, amount: 200, reference: 'made up', ...by },
      ],
    })
    await prisma.labourWelfareRate.update({ where: { stateCode_effectiveFrom: { stateCode: 'ZD', effectiveFrom: new Date(Date.UTC(2097, 0, 1)) } }, data: { employeeAmount: 10, employerAmount: 20, months: [3] } })
    await prisma.professionalTaxSlab.deleteMany({ where: { stateCode: 'ZQ' } })
    roles = await roleComponents()

    const setup = await payrollService.getSetup(admin, { payMonth })
    from = setup.attendanceFrom
    const days = daysIn(from, setup.attendanceTo)
    const companies = await Promise.all([createCompany(), createCompany()])
    a = companies[0].id; b = companies[1].id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    const [plantA, plantB] = [(await createPlant(a)).id, (await createPlant(b)).id]
    basic = (await salaryComponentsService.createSalaryComponent({ name: `Basic ${tag}`, kind: 'EARNING', displayOrder: 10, pfWage: true }, SYSTEM_ACTOR)).id
    hra = (await salaryComponentsService.createSalaryComponent({ name: `HRA ${tag}`, kind: 'EARNING', displayOrder: 20 }, SYSTEM_ACTOR)).id
    canteen = (await salaryComponentsService.createSalaryComponent({ name: `Canteen ${tag}`, kind: 'DEDUCTION', displayOrder: 230, enteredMonthly: true }, SYSTEM_ACTOR)).id

    const make = async (companyId: number, plantId: number) => {
      const { id } = await createEmployee({ companyId, plantId })
      await prisma.employee.update({ where: { id }, data: { dateOfBirth: new Date(Date.UTC(2070, 0, 1)), gender: 'MALE' } })
      await prisma.$transaction((tx) =>
        employeesService.saveSalary(
          id,
          { effectiveFrom: new Date(Date.UTC(2026, 0, 1)), annualCtc: 240000, performancePayAnnual: null, currency: 'INR', reason: 'JOINING', jobChangeRequestId: null, approvedAt: null, approvedById: null, lines: [{ salaryComponentId: basic, monthlyAmount: 15000 }, { salaryComponentId: hra, monthlyAmount: 5000 }] },
          false,
          SYSTEM_ACTOR,
          tx,
        ),
      )
      await prisma.attendanceDay.createMany({
        data: Array.from({ length: days }, (_, i) => ({ employeeId: id, date: addDays(from, i), status: 'PRESENT', firstHalf: 'PRESENT', secondHalf: 'PRESENT', autoStatus: 'PRESENT', punchCount: 0, workedMinutes: 0, lateMinutes: 0, earlyMinutes: 0, ...by })),
      })
      return id
    }
    pf = await make(a, plantA)
    noPlace = await make(a, plantA)
    oldRegime = await make(a, plantA)
    heavy = await make(a, plantA)
    noSlabs = await make(a, plantA)
    other = await make(b, plantB)
    const [zd, zq] = [await workLocationIn('ZD'), await workLocationIn('ZQ')]
    for (const id of [pf, oldRegime, heavy, other]) await placeAt(id, zd.id)
    await placeAt(noSlabs, zq.id)
    // pf: a PF member (Form 11 "PF applicable"); oldRegime: on the old tax regime (HR's payroll facts)
    await prisma.employeeStatutory.create({ data: { employeeId: pf, pfApplicable: true, ...by } })
    const code = async (id: number) => (await prisma.employee.findUniqueOrThrow({ where: { id }, select: { employeeCode: true } })).employeeCode
    await employeesService.updateStatutoryNumbers({ employeeCode: await code(oldRegime), taxRegime: 'OLD' }, admin)

    runA = (await payrollService.createRun(payroll(a), { companyId: a, payMonth, expectedAttendanceFrom: from, expectedAttendanceTo: setup.attendanceTo })).id
    await inputsService.createInput(payroll(a), { runId: runA, personId: (await prisma.payrollRunEmployee.findFirstOrThrow({ where: { payrollRunId: runA, employeeId: heavy }, select: { id: true } })).id, salaryComponentId: canteen, amount: 15000, note: 'Made-up recovery' })
    const members = await prisma.payrollRunEmployee.findMany({ where: { payrollRunId: runA }, select: { id: true, employeeId: true } })
    personOf = new Map(members.map((m) => [m.employeeId, m.id]))
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('the statutory settings are one list: Payroll View reads them, only Payroll Edit for every company changes them', async () => {
    const list = await statutoryService.listSettings(payroll(a, 'READ'))
    expect(list.canChange).toBe(false)
    expect(list.rates.some((r) => r.parameter === 'PF_WAGE_CEILING')).toBe(true)
    const rate = { parameter: 'EDLI_RATE' as const, effectiveFrom: new Date(Date.UTC(2099, 0, 1)), value: 1, reference: 'made up' }
    await expect(statutoryService.saveRate(payroll(a), rate)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(statutoryService.saveRate(payroll(null, 'READ'), rate)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // gaps between slabs are refused
    await expect(statutoryService.savePtSlabs(admin, { stateCode: 'ZX', effectiveFrom: new Date(Date.UTC(2099, 0, 1)), reference: 'made up', slabs: [{ gender: null, wagesFrom: 0, wagesTo: 100, amount: 0, specialMonth: null, specialAmount: null }, { gender: null, wagesFrom: 200, wagesTo: null, amount: 10, specialMonth: null, specialAmount: null }] })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(statutoryService.saveRate(admin, { ...rate, parameter: 'TAX_CESS_RATE' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('opening tax figures: whole-company Payroll scope by the employee\'s company, never one\'s own, View cannot change', async () => {
    const code = async (id: number) => (await prisma.employee.findUniqueOrThrow({ where: { id }, select: { employeeCode: true } })).employeeCode
    const figures = (employeeCode: string) => ({ employeeCode, taxYearFrom: new Date(Date.UTC(2097, 3, 1)), throughPayMonth: new Date(Date.UTC(2097, 3, 1)), taxableIncome: 0, taxDeducted: 0 })
    await expect(openingsService.saveOpening(payroll(a), figures(await code(other)))).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(openingsService.saveOpening(payroll(a, 'READ'), figures(await code(pf)))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(openingsService.saveOpening(payroll(a, 'WRITE', {}, pf), figures(await code(pf)))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const saved = await openingsService.saveOpening(payroll(b), figures(await code(other)))
    expect((await openingsService.listOpenings(payroll(a, 'READ'), { taxYearFrom: new Date(Date.UTC(2097, 3, 1)), page: 1, pageSize: 50 })).items.map((r) => r.id)).not.toContain(saved.id)
    const own = (await openingsService.listOpenings(payroll(b, 'READ'), { taxYearFrom: new Date(Date.UTC(2097, 3, 1)), page: 1, pageSize: 50 })).items.find((r) => r.id === saved.id)
    // Payroll alone: who and up to when, never the amounts (salary figures need Salary View too)
    expect(own).toMatchObject({ taxableIncome: null, taxDeducted: null, amountsHidden: true, canChange: false })
    const withSalary = (await openingsService.listOpenings(payroll(b, 'READ', { SALARY: 'READ' }), { taxYearFrom: new Date(Date.UTC(2097, 3, 1)), page: 1, pageSize: 50 })).items.find((r) => r.id === saved.id)
    expect(withSalary).toMatchObject({ taxableIncome: 0, taxDeducted: 0, amountsHidden: false })
    await expect(openingsService.deleteOpening(payroll(a), { id: saved.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await openingsService.deleteOpening(payroll(b), { id: saved.id })
  })

  it('works out PF, ESIC, professional tax, LWF and the net; holds what it cannot work out, with why', async () => {
    locked()
    const result = await workOut()
    expect(result).toMatchObject({ people: 5, peopleHeld: 4 })
    const one = await person(pf)
    // PF on Basic 15,000 capped at 10,000: 1,000 / employer 300 EPF + 700 EPS / EDLI 100; ESIC (20,000 <= 21,000) on 20,000:
    // 200 (up) and 600; professional tax 200; LWF in March 10 / 20; tax wiped by the rebate
    expect(byComponent(one.pay!.lines)).toMatchObject({
      [basic]: [15000, null], [hra]: [5000, null],
      [roles.get('PF_EMPLOYEE')!]: [1000, 10000], [roles.get('PF_EMPLOYER')!]: [300, 10000], [roles.get('EPS')!]: [700, 10000], [roles.get('EDLI')!]: [100, 10000],
      [roles.get('ESIC_EMPLOYEE')!]: [200, 20000], [roles.get('ESIC_EMPLOYER')!]: [600, 20000],
      [roles.get('PROFESSIONAL_TAX')!]: [200, 20000], [roles.get('LWF_EMPLOYEE')!]: [10, null], [roles.get('LWF_EMPLOYER')!]: [20, null],
    })
    expect(byComponent(one.pay!.lines)[roles.get('INCOME_TAX')!]).toBeUndefined()
    expect(one.pay).toMatchObject({ status: 'WORKED_OUT', earnedGross: 20000, deductions: 1410, netPay: 18590, employerContributions: 1720 })

    expect((await person(noPlace)).pay).toMatchObject({ status: 'HELD', heldFor: ['NO_WORK_LOCATION'], lines: [], netPay: null })
    expect((await person(oldRegime)).pay).toMatchObject({ status: 'HELD', heldFor: ['TAX_TO_TYPE'] })
    const overHalf = await person(heavy)
    expect(overHalf.pay).toMatchObject({ status: 'HELD', heldFor: ['OVER_HALF'] })
    expect(overHalf.pay!.heldNote).toContain('more than half')
    expect((await person(noSlabs)).pay).toMatchObject({ status: 'HELD', heldFor: ['NO_RATE'] })

    const list = await peopleService.listPeople(salaryViewer(), { runId: runA, page: 1, pageSize: 50 })
    expect(list.items.find((p) => p.id === personOf.get(pf))).toMatchObject({ netPay: 18590, deductions: 1410, flags: { noPf: false } })
    expect(list.counts).toMatchObject({ payNotWorkedOut: 4, noPf: 0 })
    expect(await payrollService.getRun(salaryViewer(), { id: runA })).toMatchObject({ peopleHeld: 4, netPay: 18590, deductions: 1410, employerContributions: 1720, peopleWithoutPf: 0 })
  })

  it('Payroll alone sees who is held and why, never deductions or net', async () => {
    const viewer = payroll(a, 'READ')
    expect((await person(pf, viewer)).pay).toMatchObject({ status: 'WORKED_OUT', lines: null, deductions: null, netPay: null, employerContributions: null })
    const held = (await person(heavy, viewer)).pay!
    expect(held).toMatchObject({ status: 'HELD', heldFor: ['OVER_HALF'] })
    // the note says why, never with an amount
    expect(held.heldNote).not.toMatch(/\d/)
    expect((await peopleService.listPeople(viewer, { runId: runA, page: 1, pageSize: 50 })).items.every((p) => p.netPay === null && p.deductions === null)).toBe(true)
    expect(await payrollService.getRun(viewer, { id: runA })).toMatchObject({ netPay: null, deductions: null, peopleHeld: 4 })
  })

  it('a typed TDS replaces the worked-out one; a changed input clears the hold until worked out again', async () => {
    const oldPerson = personOf.get(oldRegime)!
    await inputsService.createInput(payroll(a), { runId: runA, personId: oldPerson, salaryComponentId: roles.get('INCOME_TAX')!, amount: 750, note: 'Made-up TDS, old regime' })
    expect((await person(oldRegime)).pay).toMatchObject({ status: 'AGAIN', heldFor: [] })
    // a statutory amount other than income tax is never typed
    await expect(inputsService.createInput(payroll(a), { runId: runA, personId: oldPerson, salaryComponentId: roles.get('PF_EMPLOYEE')!, amount: 10, note: 'PF' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    locked()
    await workOut()
    const typed = await person(oldRegime)
    expect(typed.pay!.status).toBe('WORKED_OUT')
    expect(byComponent(typed.pay!.lines)[roles.get('INCOME_TAX')!]).toEqual([750, null])
    // not a PF member: listed so a missing tick is seen
    expect((await peopleService.listPeople(salaryViewer(), { runId: runA, flag: 'NO_PF', page: 1, pageSize: 50 })).items.map((p) => p.id)).toEqual([oldPerson])
  })

  it('the payroll facts are HR\'s: the candidate\'s statutory answers cannot carry them; nothing of stage 4 rebuilt is in the change history', async () => {
    const parsed = employeesSchemas.statutorySchema.parse({ pfApplicable: true, pfOnFullWages: true, epsMember: false, taxRegime: 'OLD' }) as Record<string, unknown>
    expect(parsed).toEqual({ pfApplicable: true })
    expect(await prisma.auditLog.count({ where: { model: 'PayrollRunLine' } })).toBe(0)
    // the settings are people's decisions: recorded
    expect(await prisma.auditLog.count({ where: { model: 'StatutoryRate' } })).toBeGreaterThan(0)
  })
})
