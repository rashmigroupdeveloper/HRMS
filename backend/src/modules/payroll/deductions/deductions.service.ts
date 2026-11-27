import type { EmploymentType, Gender, PayHold, SalaryComponentKind, StatutoryParameter, StatutoryRole, TaxRegime } from '#core/db/prisma'
import { formatDate, yearsOld } from '#shared/utils/dates'
import { toPaise } from '#shared/utils/money'
import * as statutoryService from '../statutory/statutory.service.js'
import type { Settings } from '../statutory/statutory.service.js'

// Payroll stage 4 (approved by the user 2026-11-27): the deductions, the employer contributions and the limit on them -
// worked out from the earnings of stage 3 and the dated statutory settings (payroll/statutory). Pure functions, unit
// tested with made-up rates; "Work out pay" (payroll/calculation) calls them for each person. Every rate, ceiling and
// slab comes from the settings: one that is not in force holds the person (NO_RATE), never a zero. Amounts are worked
// in whole paise (rates as whole ten-thousandths), never floating rupees.
//
// The user's decisions (2026-11-27):
// - PF: on the earnings marked "PF wages", up to the wage ceiling - on the whole PF wages for someone with "PF on full
//   wages"; for everyone whose statutory details say "PF applicable" (consultants included only if HR ticks it). The
//   employer's 12% is split: the pension (EPS) share on the wages up to the ceiling while the member is in EPS and under
//   its age limit, the rest to EPF; EDLI on the wages up to the ceiling. Each rounded to the nearest rupee.
// - ESIC: decided by the salary at the start of each ESIC period (1 April, 1 October; the joining day if later) - covered
//   when its monthly ESI wages are within the ceiling (a higher one for persons with disabilities), and covered until
//   the period ends; the shares on the month's earned ESI wages, each rounded UP to the rupee (the ESIC rule).
//   Not for consultants (paid a fee) or apprentices (outside ESIC).
// - Professional tax and LWF: by the State of the work location at the period's end; the slab by the month's earned
//   gross. Not for consultants.
// - Income tax (TDS): worked out each month, new regime, no declarations (those come in stage 7): the year's tax on the
//   projected taxable salary, less what was deducted, over the months left. A typed TDS replaces it; the old regime, a
//   consultant (fee rate - the CA) and income above the surcharge limit need a typed figure (TAX_TO_TYPE).
// - All deductions together at most half of the month's earned gross (Code on Wages s.18): more holds the person.
// The hold notes are shown to every Payroll viewer, so they never carry an amount (salary figures need Salary View).

export type ComponentInfo = { kind: SalaryComponentKind; pfWage: boolean; esiWage: boolean; taxable: boolean; statutoryRole: StatutoryRole | null }
type Amount = { salaryComponentId: number; amount: number }
export type Line = { salaryComponentId: number; amount: number; base: number | null }
// the months of the tax year this person was paid in, by the run's records ("2026-04")
export type EarlierMonth = { taxable: number; tds: number; workedOut: boolean }

export type Person = {
  // stage 3's lines (the salary's earnings for the days paid, earning inputs) and the typed deduction inputs
  earnings: Amount[]
  deductionInputs: Amount[]
  // the stretch at the period's end
  employmentType: EmploymentType
  // its work location's State: undefined = no work location, null = a location without a State
  stateCode: string | null | undefined
  // the full monthly taxable earnings of the salary at the period's end (projecting the rest of the tax year)
  monthlyTaxable: number
  dateOfBirth: Date | null
  gender: Gender | null
  isPhysicallyDisabled: boolean
  dateOfJoining: Date
  dateOfLeaving: Date | null
  statutory: { pfApplicable: boolean; pfOnFullWages: boolean; epsMember: boolean; taxRegime: TaxRegime } | null
  salaries: { effectiveFrom: Date; lines: { salaryComponentId: number; monthlyAmount: number }[] }[]
  opening: { throughPayMonth: Date; taxableIncome: number; taxDeducted: number } | null
  earlier: Map<string, EarlierMonth>
}

export type Context = {
  from: Date
  to: Date
  payMonth: Date
  settings: Settings
  components: Map<number, ComponentInfo>
  roleComponent: Map<StatutoryRole, number>
}

// --- Arithmetic in whole paise ---

// a rate in percent as whole ten-thousandths of a percent: 8.33 -> 83,300
const units = (percent: number) => Math.round(percent * 10_000)
// paise x percent, to the nearest rupee (50 paise up) / rounded up to the rupee - in rupees
const nearestRupeeOf = (paise: number, percent: number) => Math.floor((2 * paise * units(percent) + 100_000_000) / 200_000_000)
const upRupeeOf = (paise: number, percent: number) => Math.floor((paise * units(percent) + 100_000_000 - 1) / 100_000_000)
const rupees = (paise: number) => paise / 100

export const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

// The tax year a pay month belongs to: its 1 April (a run's pay month is the month its salary is for)
export function taxYearOf(payMonth: Date) {
  const year = payMonth.getUTCFullYear()
  return new Date(Date.UTC(payMonth.getUTCMonth() >= 3 ? year : year - 1, 3, 1))
}

// The ESIC contribution period a pay month falls in starts on 1 April (April - September) or 1 October (October - March)
export function esicPeriodStart(payMonth: Date) {
  const year = payMonth.getUTCFullYear()
  const month = payMonth.getUTCMonth()
  if (month >= 3 && month <= 8) return new Date(Date.UTC(year, 3, 1))
  return new Date(Date.UTC(month >= 9 ? year : year - 1, 9, 1))
}

// The year's tax on a taxable income by the slabs (rupees in, paise out - not rounded)
export function slabTax(slabs: { incomeFrom: number; incomeTo: number | null; ratePercent: number }[], taxable: number) {
  let paise = 0
  for (const s of slabs) {
    const top = s.incomeTo === null ? taxable : Math.min(taxable, s.incomeTo)
    if (top > s.incomeFrom) paise += ((top - s.incomeFrom) * 100 * units(s.ratePercent)) / 1_000_000
  }
  return paise
}

// --- The rule ---

const NAMES: Partial<Record<StatutoryParameter, string>> = {
  PF_EMPLOYEE_RATE: "the employee's PF rate",
  PF_EMPLOYER_RATE: "the employer's PF rate",
  EPS_RATE: 'the EPS rate',
  EDLI_RATE: 'the EDLI rate',
  PF_WAGE_CEILING: 'the PF wage ceiling',
  EPS_AGE_LIMIT: 'the EPS age limit',
  ESIC_EMPLOYEE_RATE: "the employee's ESIC rate",
  ESIC_EMPLOYER_RATE: "the employer's ESIC rate",
  ESIC_WAGE_CEILING: 'the ESIC wage ceiling',
  ESIC_WAGE_CEILING_DISABLED: 'the ESIC ceiling for persons with disabilities',
  TAX_STANDARD_DEDUCTION: 'the standard deduction',
  TAX_REBATE_INCOME_LIMIT: 'the rebate income limit',
  TAX_REBATE_MAX: 'the largest rebate',
  TAX_CESS_RATE: 'the cess rate',
  TAX_SURCHARGE_FROM: 'the surcharge limit',
}
const ROLE_NAMES: Record<StatutoryRole, string> = {
  PF_EMPLOYEE: 'Employee PF',
  ESIC_EMPLOYEE: 'Employee ESIC',
  PROFESSIONAL_TAX: 'Professional tax',
  LWF_EMPLOYEE: 'Employee LWF',
  INCOME_TAX: 'Income tax (TDS)',
  PF_EMPLOYER: 'Employer PF (EPF share)',
  EPS: 'Employer pension (EPS)',
  EDLI: 'EDLI',
  ESIC_EMPLOYER: 'Employer ESIC',
  LWF_EMPLOYER: 'Employer LWF',
}

export function workOutDeductions(person: Person, ctx: Context): { heldFor: PayHold[]; notes: string[]; lines: Line[] } {
  const holds = new Set<PayHold>()
  const notes: string[] = []
  const hold = (reason: PayHold, note: string) => {
    holds.add(reason)
    notes.push(note)
  }
  const lines: Line[] = []
  const add = (role: StatutoryRole, amount: number, base: number | null) => {
    const componentId = ctx.roleComponent.get(role)
    if (componentId === undefined) return hold('NO_COMPONENT', `No salary component carries ${ROLE_NAMES[role]} (Organization › Salary components)`)
    lines.push({ salaryComponentId: componentId, amount, base })
  }
  const rates = ctx.settings.rates
  // a value over the pay period (split by days), or null - noting what is missing
  const missing: string[] = []
  const over = (parameter: StatutoryParameter) => {
    const v = statutoryService.valueOver(rates, parameter, ctx.from, ctx.to)
    if (v === null) missing.push(NAMES[parameter] ?? parameter)
    return v
  }
  const on = (parameter: StatutoryParameter, day: Date) => {
    const v = statutoryService.valueOn(rates, parameter, day)
    if (v === null) missing.push(NAMES[parameter] ?? parameter)
    return v
  }
  const flag = (c: ComponentInfo | undefined, key: 'pfWage' | 'esiWage' | 'taxable') => !!c && c.kind === 'EARNING' && c[key]
  const sumOf = (key: 'pfWage' | 'esiWage' | 'taxable' | null) =>
    person.earnings.reduce((sum, e) => (key === null || flag(ctx.components.get(e.salaryComponentId), key) ? sum + toPaise(e.amount) : sum), 0)
  const gross = sumOf(null)
  const consultant = person.employmentType === 'CONSULTANT'
  const month = ctx.payMonth.getUTCMonth() + 1

  // --- PF ---
  if (person.statutory?.pfApplicable) {
    const [employeeRate, employerRate, epsRate, edliRate, ceiling] = (['PF_EMPLOYEE_RATE', 'PF_EMPLOYER_RATE', 'EPS_RATE', 'EDLI_RATE', 'PF_WAGE_CEILING'] as const).map(over)
    const ageLimit = on('EPS_AGE_LIMIT', ctx.from)
    if (!person.dateOfBirth) hold('NO_RATE', 'Date of birth missing - the EPS age limit needs it')
    if (missing.length) hold('NO_RATE', `Not in force for the pay period: ${missing.splice(0).join(', ')} (Payroll › Statutory settings)`)
    else if (person.dateOfBirth) {
      const wages = sumOf('pfWage')
      const capped = Math.min(wages, Math.round(ceiling! * 100))
      const epfWages = person.statutory.pfOnFullWages ? wages : capped
      const inEps = person.statutory.epsMember && yearsOld(person.dateOfBirth, ctx.from) < ageLimit!
      const epsWages = inEps ? capped : 0
      const employerTotal = nearestRupeeOf(epfWages, employerRate!)
      const eps = nearestRupeeOf(epsWages, epsRate!)
      add('PF_EMPLOYEE', nearestRupeeOf(epfWages, employeeRate!), rupees(epfWages))
      add('PF_EMPLOYER', Math.max(0, employerTotal - eps), rupees(epfWages))
      add('EPS', eps, rupees(epsWages))
      add('EDLI', nearestRupeeOf(capped, edliRate!), rupees(capped))
    }
  }

  // --- ESIC ---
  if (!consultant && person.employmentType !== 'APPRENTICE') {
    const periodStart = esicPeriodStart(ctx.payMonth)
    const coverageDay = person.dateOfJoining > periodStart ? person.dateOfJoining : periodStart
    const salary = [...person.salaries].reverse().find((s) => s.effectiveFrom <= coverageDay) ?? person.salaries[0]
    const ceiling = on(person.isPhysicallyDisabled ? 'ESIC_WAGE_CEILING_DISABLED' : 'ESIC_WAGE_CEILING', coverageDay)
    if (missing.length) hold('NO_RATE', `Not in force on ${formatDate(coverageDay)}: ${missing.splice(0).join(', ')} (Payroll › Statutory settings)`)
    else if (salary) {
      const fullEsi = salary.lines.reduce((sum, l) => (flag(ctx.components.get(l.salaryComponentId), 'esiWage') ? sum + toPaise(l.monthlyAmount) : sum), 0)
      if (fullEsi <= Math.round(ceiling! * 100)) {
        const [employeeRate, employerRate] = (['ESIC_EMPLOYEE_RATE', 'ESIC_EMPLOYER_RATE'] as const).map(over)
        if (missing.length) hold('NO_RATE', `Not in force for the pay period: ${missing.splice(0).join(', ')} (Payroll › Statutory settings)`)
        else {
          const wages = sumOf('esiWage')
          add('ESIC_EMPLOYEE', upRupeeOf(wages, employeeRate!), rupees(wages))
          add('ESIC_EMPLOYER', upRupeeOf(wages, employerRate!), rupees(wages))
        }
      }
    }
  }

  // --- Professional tax and LWF, by the State of the work location ---
  if (!consultant) {
    if (person.stateCode === undefined) hold('NO_WORK_LOCATION', 'No work location on the job timeline at the end of the pay period (its State decides professional tax and LWF) - set it, then refresh the run')
    else if (person.stateCode === null) hold('NO_RATE', 'The work location has no State (Organization › Work locations)')
    else {
      const state = person.stateCode
      const slabs = statutoryService.ptSlabsOn(ctx.settings.ptSlabs, state, ctx.to)
      if (!slabs) hold('NO_RATE', `No professional-tax slabs for ${state} on ${formatDate(ctx.to)} - a State without it gets a nil slab (Payroll › Statutory settings)`)
      else {
        const gendered = slabs.some((s) => s.gender !== null)
        if (gendered && !person.gender) hold('NO_RATE', `Gender missing - ${state} has professional-tax slabs by gender`)
        else {
          const own = slabs.filter((s) => s.gender === person.gender)
          const pick = own.length ? own : slabs.filter((s) => s.gender === null)
          const whole = Math.floor(gross / 100)
          const slab = pick.find((s) => s.wagesFrom <= whole && (s.wagesTo === null || whole <= s.wagesTo))
          if (!slab) hold('NO_RATE', `No professional-tax slab of ${state} covers this month's gross`)
          else {
            const amount = slab.specialMonth === month ? slab.specialAmount! : slab.amount
            if (amount > 0) add('PROFESSIONAL_TAX', amount, rupees(gross))
          }
        }
      }
      const lwf = statutoryService.lwfOn(ctx.settings.lwf, state, ctx.to)
      if (!lwf) hold('NO_RATE', `No labour welfare fund row for ${state} on ${formatDate(ctx.to)} - a State without it gets a nil row (Payroll › Statutory settings)`)
      else if (!lwf.months.length || lwf.months.includes(month)) {
        if (lwf.employeeAmount > 0) add('LWF_EMPLOYEE', lwf.employeeAmount, null)
        if (lwf.employerAmount > 0) add('LWF_EMPLOYER', lwf.employerAmount, null)
      }
    }
  }

  // --- Income tax (TDS) ---
  const role = (id: number) => ctx.components.get(id)?.statutoryRole ?? null
  const typedTax = person.deductionInputs.filter((d) => role(d.salaryComponentId) === 'INCOME_TAX')
  if (typedTax.length) {
    add('INCOME_TAX', rupees(typedTax.reduce((sum, d) => sum + toPaise(d.amount), 0)), null)
  } else if (consultant) {
    hold('TAX_TO_TYPE', "A consultant's TDS is typed (the fee rate - your CA confirms): add an Income tax input")
  } else if (person.statutory?.taxRegime === 'OLD') {
    hold('TAX_TO_TYPE', 'On the old tax regime: type the month\'s TDS as an Income tax input (declarations come later)')
  } else {
    const tds = monthlyTds(person, ctx, sumOf('taxable'))
    if ('hold' in tds) hold(tds.hold, tds.note)
    else if (tds.amount > 0) add('INCOME_TAX', tds.amount, tds.base)
  }

  // --- Other deductions typed for the month (canteen...) ---
  const other = new Map<number, number>()
  for (const d of person.deductionInputs) {
    if (role(d.salaryComponentId) === null) other.set(d.salaryComponentId, (other.get(d.salaryComponentId) ?? 0) + toPaise(d.amount))
  }
  for (const [salaryComponentId, paise] of other) lines.push({ salaryComponentId, amount: rupees(paise), base: null })

  // --- At most half of the wages ---
  const deducted = lines.reduce((sum, l) => (ctx.components.get(l.salaryComponentId)?.kind === 'DEDUCTION' ? sum + toPaise(l.amount) : sum), 0)
  if (!holds.size && deducted * 2 > gross) {
    hold('OVER_HALF', 'The deductions are more than half of the wages (Code on Wages) - reduce an input')
  }

  return holds.size ? { heldFor: [...holds], notes, lines: [] } : { heldFor: [], notes: [], lines }
}

// The month's TDS, new regime, no declarations: the year's tax on the projected taxable salary - what is known of the
// tax year (opening figures, earlier runs) + this month + the months left at the current monthly salary - less what was
// deducted so far, spread over this month and the months left. A month of the tax year with no figures (not in the
// opening figures, no run worked out) while employed is counted at the current monthly salary with no tax deducted -
// never as nothing. The months left stop at a known leaving date. The taxable income is the base.
export function monthlyTds(person: Person, ctx: Context, thisMonthTaxable: number): { amount: number; base: number } | { hold: PayHold; note: string } {
  const taxYearFrom = taxYearOf(ctx.payMonth)
  const v = (parameter: StatutoryParameter) => statutoryService.valueOn(ctx.settings.rates, parameter, taxYearFrom)
  const params = { standard: v('TAX_STANDARD_DEDUCTION'), rebateLimit: v('TAX_REBATE_INCOME_LIMIT'), rebateMax: v('TAX_REBATE_MAX'), cess: v('TAX_CESS_RATE'), surcharge: v('TAX_SURCHARGE_FROM') }
  const slabs = statutoryService.taxSlabsFor(ctx.settings.taxSlabs, 'NEW', taxYearFrom)
  const absent = (Object.entries(params) as [keyof typeof params, number | null][]).filter(([, value]) => value === null).map(([key]) => ({ standard: NAMES.TAX_STANDARD_DEDUCTION, rebateLimit: NAMES.TAX_REBATE_INCOME_LIMIT, rebateMax: NAMES.TAX_REBATE_MAX, cess: NAMES.TAX_CESS_RATE, surcharge: NAMES.TAX_SURCHARGE_FROM })[key])
  if (!slabs) absent.unshift('the new-regime slabs')
  if (absent.length) return { hold: 'NO_RATE', note: `Not set for the tax year from ${formatDate(taxYearFrom)}: ${absent.join(', ')} (Payroll › Statutory settings)` }

  const monthly = toPaise(person.monthlyTaxable)
  const employedIn = (monthStart: Date) => {
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0))
    return person.dateOfJoining <= monthEnd && (person.dateOfLeaving === null || person.dateOfLeaving >= monthStart)
  }
  let income = person.opening ? person.opening.taxableIncome * 100 : 0
  let deducted = person.opening ? person.opening.taxDeducted * 100 : 0
  let monthsLeft = 1
  for (let i = 0; i < 12; i++) {
    const m = new Date(Date.UTC(taxYearFrom.getUTCFullYear(), 3 + i, 1))
    if (person.opening && m <= person.opening.throughPayMonth) continue
    if (m < ctx.payMonth) {
      const earlier = person.earlier.get(monthKey(m))
      if (earlier?.workedOut) {
        income += toPaise(earlier.taxable)
        deducted += toPaise(earlier.tds)
      } else if (employedIn(m)) income += monthly
    } else if (m.getTime() === ctx.payMonth.getTime()) income += thisMonthTaxable
    else if (employedIn(m)) {
      income += monthly
      monthsLeft += 1
    }
  }
  const taxable = Math.max(0, Math.floor(income / 100) - params.standard!)
  if (taxable > params.surcharge!) return { hold: 'TAX_TO_TYPE', note: "The projected taxable income is above the surcharge limit - type the month's TDS as an Income tax input" }
  let tax = slabTax(slabs!, taxable)
  // the rebate (Income-tax Act 2025 s.156) up to its limit, and the marginal relief just above it: the tax never exceeds
  // the income above the limit
  if (taxable <= params.rebateLimit!) tax = Math.max(0, tax - params.rebateMax! * 100)
  else tax = Math.min(tax, (taxable - params.rebateLimit!) * 100)
  const yearTax = tax + (tax * units(params.cess!)) / 1_000_000
  const remaining = Math.max(0, yearTax - deducted)
  return { amount: Math.floor((2 * remaining + 100 * monthsLeft) / (200 * monthsLeft)), base: taxable }
}
