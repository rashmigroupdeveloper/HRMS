import { describe, expect, it } from 'vitest'
import type { StatutoryParameter, StatutoryRole } from '#core/db/prisma'
import * as statutoryService from '../statutory/statutory.service.js'
import { esicPeriodStart, monthlyTds, slabTax, taxYearOf, workOutDeductions, type ComponentInfo, type Context, type Person } from './deductions.service.js'

// The deductions of payroll stage 4 (the user, 2026-11-27) - with MADE-UP rates and slabs: nothing here is a real rate.

const d = (text: string) => new Date(`${text}T00:00:00Z`)
// components: earnings 1 Basic (PF wage), 2 HRA, 3 Incentive (not taxable); deductions and employer contributions by role
const BASIC = 1
const HRA = 2
const BONUS = 3
const CANTEEN = 30
const ROLES: StatutoryRole[] = ['PF_EMPLOYEE', 'ESIC_EMPLOYEE', 'PROFESSIONAL_TAX', 'LWF_EMPLOYEE', 'INCOME_TAX', 'PF_EMPLOYER', 'EPS', 'EDLI', 'ESIC_EMPLOYER', 'LWF_EMPLOYER']
const roleId = (role: StatutoryRole) => 100 + ROLES.indexOf(role)
const EMPLOYEE_ROLES = new Set<StatutoryRole>(['PF_EMPLOYEE', 'ESIC_EMPLOYEE', 'PROFESSIONAL_TAX', 'LWF_EMPLOYEE', 'INCOME_TAX'])
const components = new Map<number, ComponentInfo>([
  [BASIC, { kind: 'EARNING', pfWage: true, esiWage: true, taxable: true, statutoryRole: null }],
  [HRA, { kind: 'EARNING', pfWage: false, esiWage: true, taxable: true, statutoryRole: null }],
  [BONUS, { kind: 'EARNING', pfWage: false, esiWage: false, taxable: false, statutoryRole: null }],
  [CANTEEN, { kind: 'DEDUCTION', pfWage: false, esiWage: false, taxable: false, statutoryRole: null }],
  ...ROLES.map((role): [number, ComponentInfo] => [roleId(role), { kind: EMPLOYEE_ROLES.has(role) ? 'DEDUCTION' : 'EMPLOYER_CONTRIBUTION', pfWage: false, esiWage: false, taxable: false, statutoryRole: role }]),
])

// made-up values, from 1 Jan 2089 (tax values from 1 April 2090)
const rate = (parameter: StatutoryParameter, value: number, from = '2089-01-01') => ({ id: 0, parameter, effectiveFrom: d(from), value, reference: 'made up', createdAt: d(from), createdById: 0, updatedAt: d(from), updatedById: 0 })
const RATES = [
  rate('PF_EMPLOYEE_RATE', 10),
  rate('PF_EMPLOYER_RATE', 10),
  rate('EPS_RATE', 7),
  rate('EDLI_RATE', 1),
  rate('PF_WAGE_CEILING', 10000),
  rate('EPS_AGE_LIMIT', 50),
  rate('ESIC_EMPLOYEE_RATE', 1),
  rate('ESIC_EMPLOYER_RATE', 3),
  rate('ESIC_WAGE_CEILING', 20000),
  rate('ESIC_WAGE_CEILING_DISABLED', 30000),
  rate('TAX_STANDARD_DEDUCTION', 50000, '2090-04-01'),
  rate('TAX_REBATE_INCOME_LIMIT', 500000, '2090-04-01'),
  rate('TAX_REBATE_MAX', 20000, '2090-04-01'),
  rate('TAX_CESS_RATE', 4, '2090-04-01'),
  rate('TAX_SURCHARGE_FROM', 5000000, '2090-04-01'),
]
const audit = { id: 0, reference: 'made up', createdAt: d('2090-01-01'), createdById: 0, updatedAt: d('2090-01-01'), updatedById: 0 }
const SETTINGS: statutoryService.Settings = {
  rates: RATES,
  ptSlabs: [
    { ...audit, stateCode: 'ZA', effectiveFrom: d('2089-01-01'), gender: null, wagesFrom: 0, wagesTo: 9999, amount: 0, specialMonth: null, specialAmount: null },
    { ...audit, stateCode: 'ZA', effectiveFrom: d('2089-01-01'), gender: null, wagesFrom: 10000, wagesTo: null, amount: 150, specialMonth: 2, specialAmount: 250 },
    { ...audit, stateCode: 'ZA', effectiveFrom: d('2089-01-01'), gender: 'FEMALE', wagesFrom: 0, wagesTo: 19999, amount: 0, specialMonth: null, specialAmount: null },
    { ...audit, stateCode: 'ZA', effectiveFrom: d('2089-01-01'), gender: 'FEMALE', wagesFrom: 20000, wagesTo: null, amount: 150, specialMonth: null, specialAmount: null },
  ],
  lwf: [{ ...audit, stateCode: 'ZA', effectiveFrom: d('2089-01-01'), employeeAmount: 5, employerAmount: 15, months: [6, 12] }],
  // made-up new-regime slabs: 0 up to 3 lakh, 10% to 6 lakh, 20% above
  taxSlabs: [
    { ...audit, regime: 'NEW', taxYearFrom: d('2090-04-01'), incomeFrom: 0, incomeTo: 300000, ratePercent: 0 },
    { ...audit, regime: 'NEW', taxYearFrom: d('2090-04-01'), incomeFrom: 300000, incomeTo: 600000, ratePercent: 10 },
    { ...audit, regime: 'NEW', taxYearFrom: d('2090-04-01'), incomeFrom: 600000, incomeTo: null, ratePercent: 20 },
  ],
}

// the June 2090 run: 26 May - 25 June (31 days)
const ctx = (extra: Partial<Context> = {}): Context => ({
  from: d('2090-05-26'),
  to: d('2090-06-25'),
  payMonth: d('2090-06-01'),
  settings: SETTINGS,
  components,
  roleComponent: new Map(ROLES.map((role) => [role, roleId(role)])),
  ...extra,
})
const person = (extra: Partial<Person> = {}): Person => ({
  earnings: [{ salaryComponentId: BASIC, amount: 15000 }, { salaryComponentId: HRA, amount: 5000 }],
  deductionInputs: [],
  employmentType: 'PERMANENT',
  stateCode: 'ZA',
  monthlyTaxable: 20000,
  dateOfBirth: d('2060-01-01'),
  gender: 'MALE',
  isPhysicallyDisabled: false,
  dateOfJoining: d('2085-01-01'),
  dateOfLeaving: null,
  statutory: { pfApplicable: true, pfOnFullWages: false, epsMember: true, taxRegime: 'NEW' },
  salaries: [{ effectiveFrom: d('2085-01-01'), lines: [{ salaryComponentId: BASIC, monthlyAmount: 15000 }, { salaryComponentId: HRA, monthlyAmount: 5000 }] }],
  opening: null,
  earlier: new Map(),
  ...extra,
})
const byRole = (lines: { salaryComponentId: number; amount: number; base: number | null }[]) =>
  Object.fromEntries(lines.map((l) => [components.get(l.salaryComponentId)?.statutoryRole ?? l.salaryComponentId, [l.amount, l.base]]))

describe('looking a rate up', () => {
  it('a change inside a pay period is split by days', () => {
    // 10,000 until 16 June, 20,000 from 17 June: 22 days at the old, 9 at the new over 31 days
    const rates = [rate('PF_WAGE_CEILING', 10000), rate('PF_WAGE_CEILING', 20000, '2090-06-17')]
    expect(statutoryService.valueOver(rates, 'PF_WAGE_CEILING', d('2090-05-26'), d('2090-06-25'))).toBeCloseTo((10000 * 22 + 20000 * 9) / 31, 6)
    expect(statutoryService.valueOver(rates, 'PF_WAGE_CEILING', d('2088-12-20'), d('2089-01-10'))).toBeNull()
  })
  it('the tax year and the ESIC period of a pay month', () => {
    expect(taxYearOf(d('2090-03-01'))).toEqual(d('2089-04-01'))
    expect(taxYearOf(d('2090-04-01'))).toEqual(d('2090-04-01'))
    expect([esicPeriodStart(d('2090-04-01')), esicPeriodStart(d('2090-09-01')), esicPeriodStart(d('2090-10-01')), esicPeriodStart(d('2091-03-01'))]).toEqual([d('2090-04-01'), d('2090-04-01'), d('2090-10-01'), d('2090-10-01')])
  })
})

describe('PF', () => {
  it('on the PF wages up to the ceiling; the employer share split into EPS and EPF; EDLI on the capped wages', () => {
    const lines = byRole(workOutDeductions(person(), ctx()).lines)
    // Basic 15,000 capped at 10,000: employee 10% = 1,000; employer 10% = 1,000 of which EPS 7% = 700, EPF 300; EDLI 1%
    expect(lines).toMatchObject({ PF_EMPLOYEE: [1000, 10000], PF_EMPLOYER: [300, 10000], EPS: [700, 10000], EDLI: [100, 10000] })
  })
  it('on full wages with the joint option; no EPS past the age limit or outside the scheme', () => {
    expect(byRole(workOutDeductions(person({ statutory: { pfApplicable: true, pfOnFullWages: true, epsMember: true, taxRegime: 'NEW' } }), ctx()).lines)).toMatchObject({ PF_EMPLOYEE: [1500, 15000], PF_EMPLOYER: [800, 15000], EPS: [700, 10000] })
    // 50 by 26 May 2090
    expect(byRole(workOutDeductions(person({ dateOfBirth: d('2040-01-01') }), ctx()).lines)).toMatchObject({ PF_EMPLOYER: [1000, 10000], EPS: [0, 0] })
    expect(byRole(workOutDeductions(person({ statutory: { pfApplicable: true, pfOnFullWages: false, epsMember: false, taxRegime: 'NEW' } }), ctx()).lines)).toMatchObject({ EPS: [0, 0] })
  })
  it('none without "PF applicable"; a missing birth date or rate holds the person', () => {
    expect(byRole(workOutDeductions(person({ statutory: null }), ctx()).lines).PF_EMPLOYEE).toBeUndefined()
    expect(workOutDeductions(person({ dateOfBirth: null }), ctx())).toMatchObject({ heldFor: ['NO_RATE'], lines: [] })
    const noCeiling = workOutDeductions(person(), ctx({ settings: { ...SETTINGS, rates: RATES.filter((r) => r.parameter !== 'PF_WAGE_CEILING') } }))
    expect(noCeiling.heldFor).toEqual(['NO_RATE'])
    expect(noCeiling.notes[0]).toContain('the PF wage ceiling')
  })
})

describe('ESIC', () => {
  it('covered by the salary at the start of the ESIC period; each share rounded up on the earned ESI wages', () => {
    // ESI wages 20,000 a month on 1 April - within the ceiling; earned 20,000 (bonus not an ESI wage)
    const pay = person({ earnings: [...person().earnings, { salaryComponentId: BONUS, amount: 999 }] })
    expect(byRole(workOutDeductions(pay, ctx()).lines)).toMatchObject({ ESIC_EMPLOYEE: [200, 20000], ESIC_EMPLOYER: [600, 20000] })
    // 1% of 19,950.50 = 199.505 -> 200 (up)
    expect(byRole(workOutDeductions(person({ earnings: [{ salaryComponentId: BASIC, amount: 14950.5 }, { salaryComponentId: HRA, amount: 5000 }] }), ctx()).lines).ESIC_EMPLOYEE).toEqual([200, 19950.5])
  })
  it('an increment after 1 April keeps them covered until the period ends; above the ceiling on 1 April, never', () => {
    const raised = person({ salaries: [...person().salaries, { effectiveFrom: d('2090-05-01'), lines: [{ salaryComponentId: BASIC, monthlyAmount: 30000 }] }], earnings: [{ salaryComponentId: BASIC, amount: 30000 }] })
    expect(byRole(workOutDeductions(raised, ctx()).lines).ESIC_EMPLOYEE).toEqual([300, 30000])
    const high = person({ salaries: [{ effectiveFrom: d('2085-01-01'), lines: [{ salaryComponentId: BASIC, monthlyAmount: 25000 }] }] })
    expect(byRole(workOutDeductions(high, ctx()).lines).ESIC_EMPLOYEE).toBeUndefined()
    // a person with a disability: the higher ceiling
    expect(byRole(workOutDeductions({ ...high, isPhysicallyDisabled: true }, ctx()).lines).ESIC_EMPLOYEE).toBeDefined()
  })
  it('not for consultants or apprentices', () => {
    expect(byRole(workOutDeductions(person({ employmentType: 'APPRENTICE' }), ctx()).lines).ESIC_EMPLOYEE).toBeUndefined()
  })
})

describe('professional tax and LWF', () => {
  it('the slab by the earned gross, the special month, the slabs by gender', () => {
    expect(byRole(workOutDeductions(person(), ctx()).lines).PROFESSIONAL_TAX).toEqual([150, 20000])
    // (February 2090 is in the tax year of 2089, which has no slabs here: the TDS is typed)
    const february = ctx({ from: d('2090-01-26'), to: d('2090-02-25'), payMonth: d('2090-02-01') })
    expect(byRole(workOutDeductions(person({ deductionInputs: [{ salaryComponentId: roleId('INCOME_TAX'), amount: 100 }] }), february).lines).PROFESSIONAL_TAX).toEqual([250, 20000])
    const small = person({ earnings: [{ salaryComponentId: BASIC, amount: 9999.99 }] })
    expect(byRole(workOutDeductions(small, ctx()).lines).PROFESSIONAL_TAX).toBeUndefined()
    // a woman: her own slabs (nil below 20,000)
    expect(byRole(workOutDeductions(person({ gender: 'FEMALE', earnings: [{ salaryComponentId: BASIC, amount: 15000 }] }), ctx()).lines).PROFESSIONAL_TAX).toBeUndefined()
    expect(workOutDeductions(person({ gender: null }), ctx()).heldFor).toEqual(['NO_RATE'])
  })
  it('LWF only in its months', () => {
    expect(byRole(workOutDeductions(person(), ctx()).lines)).toMatchObject({ LWF_EMPLOYEE: [5, null], LWF_EMPLOYER: [15, null] })
    expect(byRole(workOutDeductions(person(), ctx({ from: d('2090-06-26'), to: d('2090-07-25'), payMonth: d('2090-07-01') })).lines).LWF_EMPLOYEE).toBeUndefined()
  })
  it('a State with no slabs, no work location or a location with no State holds; consultants pay neither', () => {
    expect(workOutDeductions(person({ stateCode: 'ZB' }), ctx()).heldFor).toEqual(['NO_RATE'])
    expect(workOutDeductions(person({ stateCode: undefined }), ctx()).heldFor).toEqual(['NO_WORK_LOCATION'])
    expect(workOutDeductions(person({ stateCode: null }), ctx()).heldFor).toEqual(['NO_RATE'])
    const consultant = workOutDeductions(person({ employmentType: 'CONSULTANT', statutory: null, deductionInputs: [{ salaryComponentId: roleId('INCOME_TAX'), amount: 2000 }] }), ctx())
    expect(byRole(consultant.lines)).toEqual({ INCOME_TAX: [2000, null] })
  })
})

describe('income tax (TDS)', () => {
  it('slab tax', () => {
    expect(slabTax(SETTINGS.taxSlabs, 250000)).toBe(0)
    // 10% of 3 lakh + 20% of 1 lakh
    expect(slabTax(SETTINGS.taxSlabs, 700000)).toBe(5000000)
  })
  it('the year\'s tax on the projected salary over the months left; the rebate and the marginal relief', () => {
    // 50,000 a month from April: 6 lakh - 50,000 standard = 5.5 lakh taxable -> 25,000 tax; above the 5 lakh limit, so
    // the marginal relief caps it at 50,000 - no change; +4% cess = 26,000; nothing deducted yet; June: 10 months left
    const p = person({ earnings: [{ salaryComponentId: BASIC, amount: 50000 }], monthlyTaxable: 50000, statutory: null, stateCode: 'ZA' })
    expect(monthlyTds(p, ctx(), 5_000_000)).toEqual({ amount: 2600, base: 550000 })
    // 40,000 a month: 4.8 lakh - 50,000 = 4.3 lakh <= 5 lakh: rebate up to 20,000 wipes the 13,000
    expect(monthlyTds(person({ monthlyTaxable: 40000 }), ctx(), 4_000_000)).toEqual({ amount: 0, base: 430000 })
    // marginal relief: 5.1 lakh taxable -> slab tax 21,000, capped at 10,000 above the limit -> 10,400 with cess
    const relief = monthlyTds(person({ monthlyTaxable: 46666.67 }), ctx(), toPaiseOf(46666.67))
    // 10,000 + 4% cess = 10,400 over the 10 months June - March
    expect(relief).toEqual({ amount: 1040, base: 510000 })
  })
  it('the opening figures and earlier months count; a month with no figures is counted at the salary, not as nothing', () => {
    const p = person({ monthlyTaxable: 50000, opening: { throughPayMonth: d('2090-04-01'), taxableIncome: 50000, taxDeducted: 1000 } })
    // April from the opening figures (1,000 deducted), May unknown -> 50,000, June 50,000, 9 months more: 6 lakh -> 26,000
    // with cess; left 25,000 over 10 months
    expect(monthlyTds(p, ctx(), 5_000_000)).toEqual({ amount: 2500, base: 550000 })
    const withMay = person({ monthlyTaxable: 50000, earlier: new Map([['2090-05', { taxable: 50000, tds: 3000, workedOut: true }]]) })
    // April unknown -> 50,000; May known with 3,000 deducted: 23,000 left over 10 months
    expect(monthlyTds(withMay, ctx(), 5_000_000)).toEqual({ amount: 2300, base: 550000 })
  })
  it('stops at a known leaving date', () => {
    // leaves in August: April - August = 2.5 lakh -> below the rebate: nothing
    expect(monthlyTds(person({ monthlyTaxable: 50000, dateOfLeaving: d('2090-08-20') }), ctx(), 5_000_000)).toEqual({ amount: 0, base: 200000 })
  })
  it('a typed TDS replaces it; the old regime and a consultant without one hold; missing slabs hold', () => {
    const typed = workOutDeductions(person({ deductionInputs: [{ salaryComponentId: roleId('INCOME_TAX'), amount: 1234 }] }), ctx())
    expect(byRole(typed.lines).INCOME_TAX).toEqual([1234, null])
    expect(workOutDeductions(person({ statutory: { pfApplicable: false, pfOnFullWages: false, epsMember: true, taxRegime: 'OLD' } }), ctx()).heldFor).toEqual(['TAX_TO_TYPE'])
    expect(workOutDeductions(person({ employmentType: 'CONSULTANT' }), ctx()).heldFor).toEqual(['TAX_TO_TYPE'])
    expect(workOutDeductions(person(), ctx({ settings: { ...SETTINGS, taxSlabs: [] } })).heldFor).toEqual(['NO_RATE'])
  })
})

describe('the limit and the rest', () => {
  it('typed deductions are taken as typed; all together at most half of the wages', () => {
    expect(byRole(workOutDeductions(person({ deductionInputs: [{ salaryComponentId: CANTEEN, amount: 300.5 }] }), ctx()).lines)[CANTEEN]).toEqual([300.5, null])
    const over = workOutDeductions(person({ deductionInputs: [{ salaryComponentId: CANTEEN, amount: 9000 }] }), ctx())
    expect(over).toMatchObject({ heldFor: ['OVER_HALF'], lines: [] })
  })
  it('a statutory amount with no component carrying it holds the person', () => {
    const roles = new Map(ROLES.filter((r) => r !== 'EDLI').map((role) => [role, roleId(role)]))
    expect(workOutDeductions(person(), ctx({ roleComponent: roles })).heldFor).toEqual(['NO_COMPONENT'])
  })
})

function toPaiseOf(rupees: number) {
  return Math.round(rupees * 100)
}
