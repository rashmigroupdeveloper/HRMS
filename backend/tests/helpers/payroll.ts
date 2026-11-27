import { prisma, SYSTEM_ACTOR, type StatutoryParameter, type StatutoryRole } from '#core/db/prisma'

// Payroll stage 4 test data: MADE-UP statutory settings - never real rates. Settings are one list for the whole group and
// the test database is never wiped, so each test file keeps to its own far-off years and its own made-up State codes
// (two capital letters no real State has, e.g. "ZP"): a rate starting on 1 January of one file's year applies to every
// later year too, so the file with the later years sets every parameter itself.

const by = { createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }
const day = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1))

export type MadeUpRates = Partial<Record<StatutoryParameter, number>>

// Round made-up values for every parameter; the ESIC ceilings are low, so ordinary test salaries are not covered unless
// a test raises them
export const MADE_UP: Record<StatutoryParameter, number> = {
  PF_EMPLOYEE_RATE: 10,
  PF_EMPLOYER_RATE: 10,
  EPS_RATE: 7,
  EDLI_RATE: 1,
  PF_WAGE_CEILING: 10000,
  EPS_AGE_LIMIT: 50,
  ESIC_EMPLOYEE_RATE: 1,
  ESIC_EMPLOYER_RATE: 3,
  ESIC_WAGE_CEILING: 20000,
  ESIC_WAGE_CEILING_DISABLED: 25000,
  TAX_STANDARD_DEDUCTION: 50000,
  TAX_REBATE_INCOME_LIMIT: 500000,
  TAX_REBATE_MAX: 20000,
  TAX_CESS_RATE: 4,
  TAX_SURCHARGE_FROM: 5000000,
}

// Every rate from 1 January of `fromYear` (the tax values from 1 April of it), a nil professional tax and labour welfare
// fund for the made-up State, and 0% new-regime slabs for the tax year from 1 April of `fromYear` - so a run of March of
// `fromYear + 1` (ESIC period from 1 October before it) finds everything. `rates` / `taxRatePercent` override the defaults.
export async function madeUpSettings(fromYear: number, stateCode: string, options: { rates?: MadeUpRates; taxRatePercent?: number } = {}) {
  const values = { ...MADE_UP, ...options.rates }
  for (const [parameter, value] of Object.entries(values) as [StatutoryParameter, number][]) {
    const effectiveFrom = parameter.startsWith('TAX_') ? day(fromYear, 4) : day(fromYear, 1)
    await prisma.statutoryRate.upsert({
      where: { parameter_effectiveFrom: { parameter, effectiveFrom } },
      create: { parameter, effectiveFrom, value, reference: 'made up for tests', ...by },
      update: { value, ...by },
    })
  }
  await prisma.professionalTaxSlab.deleteMany({ where: { stateCode, effectiveFrom: day(fromYear, 1) } })
  await prisma.professionalTaxSlab.create({ data: { stateCode, effectiveFrom: day(fromYear, 1), wagesFrom: 0, amount: 0, reference: 'made up for tests', ...by } })
  await prisma.labourWelfareRate.upsert({
    where: { stateCode_effectiveFrom: { stateCode, effectiveFrom: day(fromYear, 1) } },
    create: { stateCode, effectiveFrom: day(fromYear, 1), employeeAmount: 0, employerAmount: 0, months: [], reference: 'made up for tests', ...by },
    update: { employeeAmount: 0, employerAmount: 0, months: [] },
  })
  await prisma.incomeTaxSlab.deleteMany({ where: { regime: 'NEW', taxYearFrom: day(fromYear, 4) } })
  await prisma.incomeTaxSlab.create({ data: { regime: 'NEW', taxYearFrom: day(fromYear, 4), incomeFrom: 0, ratePercent: options.taxRatePercent ?? 0, reference: 'made up for tests', ...by } })
}

// One component per statutory role (a role is unique in the whole database): the existing one, or a test one
export async function roleComponents() {
  const employee = new Set<StatutoryRole>(['PF_EMPLOYEE', 'ESIC_EMPLOYEE', 'PROFESSIONAL_TAX', 'LWF_EMPLOYEE', 'INCOME_TAX'])
  const roles: StatutoryRole[] = ['PF_EMPLOYEE', 'ESIC_EMPLOYEE', 'PROFESSIONAL_TAX', 'LWF_EMPLOYEE', 'INCOME_TAX', 'PF_EMPLOYER', 'EPS', 'EDLI', 'ESIC_EMPLOYER', 'LWF_EMPLOYER']
  const ids = new Map<StatutoryRole, number>()
  for (const role of roles) {
    const found = await prisma.salaryComponent.findUnique({ where: { statutoryRole: role }, select: { id: true } })
    const component =
      found ??
      (await prisma.salaryComponent.create({
        data: { name: `Test ${role}`, kind: employee.has(role) ? 'DEDUCTION' : 'EMPLOYER_CONTRIBUTION', displayOrder: 500, statutoryRole: role, enteredMonthly: role === 'INCOME_TAX', ...by },
        select: { id: true },
      }))
    ids.set(role, component.id)
  }
  return ids
}

// A made-up work location in a made-up State, and an employee's job timeline placed there
export async function workLocationIn(stateCode: string) {
  const tag = Math.random().toString(36).slice(2, 8)
  return prisma.workLocation.create({ data: { name: `Test location ${stateCode} ${tag}`, stateCode, ...by }, select: { id: true } })
}
export async function placeAt(employeeId: number, workLocationId: number) {
  await prisma.employeeJobRecord.updateMany({ where: { employeeId }, data: { workLocationId } })
}
