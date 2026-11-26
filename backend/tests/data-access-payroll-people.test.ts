import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { payrollService } from '#modules/payroll'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { employeesService } from '#modules/employees'
import * as peopleService from '../src/modules/payroll/people/people.service.js'
import * as inputsService from '../src/modules/payroll/inputs/inputs.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 2 (approved 2026-11-26): who is in a run, the salary copy, monthly inputs - and whose records they are.
// Made-up figures only.

const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2092, 2, 1))
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
type Level = 'READ' | 'WRITE'
const payroll = (companyId: number | null, level: Level = 'WRITE', plantId: number | null = null, extra: { SALARY?: Level } = {}, id = 0) =>
  userWith({ id, employeeCode: 'PAYTEST' }, [{ access: { PAYROLL: level, ...extra }, rows: [row(companyId, plantId, null, level)] }])

describe('Payroll stage 2: people, salary copy, inputs', () => {
  let a: number, b: number, plantA: number, plantB: number
  let basic: number, special: number, canteen: number, notMonthly: number
  let e1: number, e2: number, e3: number, e4: number
  let runA: number, runB: number
  let personE1: number, personE2: number

  async function runInput(companyId: number) {
    const setup = await payrollService.getSetup(admin, { payMonth })
    return { companyId, payMonth, expectedAttendanceFrom: setup.attendanceFrom, expectedAttendanceTo: setup.attendanceTo }
  }
  async function giveSalary(employeeId: number, effectiveFrom: Date, annualCtc: number) {
    const monthly = annualCtc / 12
    await prisma.$transaction((tx) =>
      employeesService.saveSalary(
        employeeId,
        { effectiveFrom, annualCtc, performancePayAnnual: null, currency: 'INR', reason: 'JOINING', jobChangeRequestId: null, approvedAt: null, approvedById: null, lines: [{ salaryComponentId: basic, monthlyAmount: monthly / 2 }, { salaryComponentId: special, monthlyAmount: monthly / 2 }] },
        false,
        SYSTEM_ACTOR,
        tx,
      ),
    )
  }

  beforeAll(async () => {
    const companies = await Promise.all([createCompany(), createCompany()])
    a = companies[0].id; b = companies[1].id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    plantA = (await createPlant(a)).id; plantB = (await createPlant(b)).id
    basic = (await salaryComponentsService.createSalaryComponent({ name: `Basic ${tag}`, kind: 'EARNING', displayOrder: 10 }, SYSTEM_ACTOR)).id
    special = (await salaryComponentsService.createSalaryComponent({ name: `Special ${tag}`, kind: 'EARNING', displayOrder: 60 }, SYSTEM_ACTOR)).id
    canteen = (await salaryComponentsService.createSalaryComponent({ name: `Canteen ${tag}`, code: `CANTEEN_${tag}`, kind: 'DEDUCTION', displayOrder: 230, enteredMonthly: true }, SYSTEM_ACTOR)).id
    notMonthly = (await salaryComponentsService.createSalaryComponent({ name: `PT ${tag}`, kind: 'DEDUCTION', displayOrder: 220 }, SYSTEM_ACTOR)).id
    e1 = (await createEmployee({ companyId: a, plantId: plantA })).id
    e2 = (await createEmployee({ companyId: a, plantId: plantA })).id
    e3 = (await createEmployee({ companyId: b, plantId: plantB })).id
    e4 = (await createEmployee({ companyId: a, plantId: plantA })).id
    await giveSalary(e1, new Date(Date.UTC(2026, 0, 1)), 480000)
    await giveSalary(e1, new Date(Date.UTC(2092, 2, 16)), 528000)
    await giveSalary(e3, new Date(Date.UTC(2026, 0, 1)), 360000)
    await giveSalary(e4, new Date(Date.UTC(2026, 0, 1)), 300000)
    runA = (await payrollService.createRun(payroll(a), await runInput(a))).id
    runB = (await payrollService.createRun(payroll(b), await runInput(b))).id
  })
  afterAll(() => prisma.$disconnect())

  it('creating a run copies its people and their salary stretches', async () => {
    const list = await peopleService.listPeople(payroll(a, 'READ', null, { SALARY: 'READ' }), { runId: runA, page: 1, pageSize: 50 })
    const byCode = new Map(list.items.map((p) => [p.employeeCode, p]))
    const codes = await prisma.employee.findMany({ where: { id: { in: [e1, e2, e3, e4] } }, select: { id: true, employeeCode: true } })
    const code = (id: number) => codes.find((c) => c.id === id)!.employeeCode
    expect(byCode.has(code(e3))).toBe(false)
    expect(byCode.get(code(e1))).toMatchObject({ days: 31, segments: 2, monthlyGross: 44000, annualCtc: 528000, flags: { changed: true, noSalary: false } })
    expect(byCode.get(code(e2))).toMatchObject({ days: 31, segments: 1, annualCtc: null, flags: { noSalary: true } })
    expect(list.counts).toMatchObject({ all: 3, noSalary: 1, changed: 1 })
    personE1 = byCode.get(code(e1))!.id
    personE2 = byCode.get(code(e2))!.id
    const run = await payrollService.getRun(admin, { id: runA })
    expect(run).toMatchObject({ people: 3, peopleWithoutSalary: 1, inputs: 0, canChange: true, payFrom: payMonth })
    expect(run.peopleRefreshedAt).toBeInstanceOf(Date)
  })

  it('salary figures need Salary View over the whole company as well as Payroll (the user, 2026-11-26)', async () => {
    const noSalary = await peopleService.listPeople(payroll(a, 'READ'), { runId: runA, page: 1, pageSize: 50 })
    expect(noSalary.salaryHidden).toBe(true)
    expect(noSalary.items.every((p) => p.monthlyGross === null && p.annualCtc === null)).toBe(true)
    const person = await peopleService.getPerson(payroll(a, 'READ'), { runId: runA, personId: personE1 })
    expect(person.salaryHidden).toBe(true)
    expect(person.segments.map((s) => s.salary)).toEqual([null, null])
    expect(person.segments.map((s) => s.hasSalary)).toEqual([true, true])
    // a role whose rows cover one plant only: no whole-company Payroll at all, so not even the run
    const plantRole = userWith({ id: 0, employeeCode: 'P' }, [{ access: { PAYROLL: 'READ', SALARY: 'READ' }, rows: [row(a, plantA, null, 'READ')] }])
    await expect(peopleService.getPerson(plantRole, { runId: runA, personId: personE1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const withSalary = await peopleService.getPerson(payroll(a, 'READ', null, { SALARY: 'READ' }), { runId: runA, personId: personE1 })
    expect(withSalary.segments[0]).toMatchObject({ days: 15, salary: { annualCtc: 480000, monthlyGross: 40000 } })
  })

  it('company A never sees, refreshes or types inputs in company B; plant-level and View-only cannot change', async () => {
    const outside = payroll(a)
    await expect(peopleService.listPeople(outside, { runId: runB, page: 1, pageSize: 50 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(peopleService.getPerson(outside, { runId: runB, personId: personE1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(peopleService.refresh(outside, { runId: runB, expectedRefreshedAt: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(inputsService.listInputs(outside, { runId: runB, page: 1, pageSize: 50 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // a person of run A asked through run B is not found either
    await expect(peopleService.getPerson(payroll(b), { runId: runB, personId: personE1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Payroll Edit for one plant only (the whole-company rule): nothing
    const plantLevel = payroll(a, 'WRITE', plantA)
    await expect(peopleService.listPeople(plantLevel, { runId: runA, page: 1, pageSize: 50 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(inputsService.createInput(plantLevel, { runId: runA, personId: personE1, salaryComponentId: canteen, amount: 100, note: 'canteen' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // View over the whole company cannot change
    const viewOnly = payroll(a, 'READ')
    await expect(peopleService.refresh(viewOnly, { runId: runA, expectedRefreshedAt: null })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(inputsService.createInput(viewOnly, { runId: runA, personId: personE1, salaryComponentId: canteen, amount: 100, note: 'canteen' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('inputs: only components entered monthly, never for oneself, a warning on a repeat, recorded in the change history', async () => {
    const editor = payroll(a)
    await expect(inputsService.createInput(editor, { runId: runA, personId: personE1, salaryComponentId: notMonthly, amount: 200, note: 'tax' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(inputsService.createInput(editor, { runId: runA, personId: personE1, salaryComponentId: basic, amount: 200, note: 'basic' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(inputsService.createInput(payroll(a, 'WRITE', null, {}, e1), { runId: runA, personId: personE1, salaryComponentId: canteen, amount: 800, note: 'own' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const first = await inputsService.createInput(editor, { runId: runA, personId: personE1, salaryComponentId: canteen, amount: 800, note: 'November canteen' })
    expect(first.duplicate).toBe(false)
    const second = await inputsService.createInput(editor, { runId: runA, personId: personE1, salaryComponentId: canteen, amount: 800, note: 'again' })
    expect(second.duplicate).toBe(true)
    await inputsService.updateInput(editor, { runId: runA, id: second.id, amount: 450.5 })
    await inputsService.deleteInput(editor, { runId: runA, id: second.id })
    await expect(inputsService.updateInput(editor, { runId: runB, id: first.id, amount: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const listed = await inputsService.listInputs(payroll(a, 'READ'), { runId: runA, page: 1, pageSize: 50 })
    expect(listed.items).toMatchObject([{ id: first.id, amount: 800, note: 'November canteen', salaryComponent: { id: canteen } }])
    expect(await prisma.auditLog.count({ where: { model: 'PayrollInput', recordId: first.id } })).toBeGreaterThan(0)
    expect(await prisma.auditLog.count({ where: { model: { in: ['PayrollRunEmployee', 'PayrollRunSalarySegment', 'PayrollRunSalaryLine'] } } })).toBe(0)
  })

  it('refresh: a stale screen is refused; leavers drop out unless they have inputs', async () => {
    await expect(peopleService.refresh(payroll(a), { runId: runA, expectedRefreshedAt: new Date(Date.UTC(2000, 0, 1)) })).rejects.toMatchObject({ code: 'CONFLICT' })
    await inputsService.createInput(payroll(a), { runId: runA, personId: personE2, salaryComponentId: canteen, amount: 300, note: 'canteen' })
    const left = new Date(Date.UTC(2092, 1, 20))
    await prisma.employee.updateMany({ where: { id: { in: [e2, e4] } }, data: { dateOfLeaving: left, status: 'EXITED' } })
    const before = await payrollService.getRun(admin, { id: runA })
    const result = await peopleService.refresh(payroll(a), { runId: runA, expectedRefreshedAt: before.peopleRefreshedAt })
    expect(result.people).toBe(1)
    const list = await peopleService.listPeople(payroll(a, 'READ'), { runId: runA, page: 1, pageSize: 50 })
    expect(list.items.map((p) => p.id).sort()).toEqual([personE1, personE2].sort())
    expect(list.items.find((p) => p.id === personE2)).toMatchObject({ days: 0, segments: 0, inputs: 1, flags: { notInPeriod: true } })
    expect((await peopleService.listPeople(payroll(a, 'READ'), { runId: runA, flag: 'NOT_IN_PERIOD', page: 1, pageSize: 50 })).total).toBe(1)
  })

  it('an "entered monthly" component is never part of a salary breakup', async () => {
    await expect(salaryComponentsService.checkBreakup([{ salaryComponentId: canteen, monthlyAmount: 1000 }], 12000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const incentive = await salaryComponentsService.createSalaryComponent({ name: `Incentive ${tag}`, kind: 'EARNING', displayOrder: 96, enteredMonthly: true }, SYSTEM_ACTOR)
    await expect(salaryComponentsService.checkBreakup([{ salaryComponentId: incentive.id, monthlyAmount: 1000 }], 12000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    // an earning keeps what it was created with; a deduction can switch; an employer contribution never is
    await expect(salaryComponentsService.updateSalaryComponent({ id: basic, enteredMonthly: true }, SYSTEM_ACTOR)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(salaryComponentsService.createSalaryComponent({ name: `ER ${tag}`, kind: 'EMPLOYER_CONTRIBUTION', displayOrder: 111, enteredMonthly: true }, SYSTEM_ACTOR)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect((await salaryComponentsService.updateSalaryComponent({ id: notMonthly, enteredMonthly: true }, SYSTEM_ACTOR)).enteredMonthly).toBe(true)
  })
})
