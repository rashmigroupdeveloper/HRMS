import { ORPCError } from '@orpc/server'
import { prisma, type PayClass, type PayHold, type StatutoryRole } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { salaryComponentsService, workLocationsService } from '#modules/organization'
import { toPaise } from '#shared/utils/money'
import * as payrollRepository from '../payroll.repository.js'
import * as daysService from '../days/days.service.js'
import * as deductionsRepository from '../deductions/deductions.repository.js'
import * as deductionsService from '../deductions/deductions.service.js'
import * as peopleService from '../people/people.service.js'
import * as statutoryService from '../statutory/statutory.service.js'
import * as openingsService from '../tax-openings/tax-openings.service.js'
import * as calculationRepository from './calculation.repository.js'
import type { PaySource } from './calculation.repository.js'
import type { ComputeInput } from './calculation.schema.js'

// Payroll stages 3 and 4 (approved by the user 2026-11-27): what each person of a run earned in its pay period, what is
// deducted, what the company pays on top. "Work out pay" takes the days from the locked attendance (payroll/days), works
// the earnings out from them (below) and the deductions from the earnings (payroll/deductions) in one step; the results
// (PayrollRunLine) and why anyone is held (PayrollRunEmployee.heldFor) are rebuilt each time, the run records who and
// when (computedAt / ById).

// --- The rule (pure - unit tested). Decided by the user 2026-11-27, to be checked against a greytHR salary register in
// the parallel run (BACKLOG item 31); if the register shows another divisor or rounding, it changes here only. ---
// - A day is worth the monthly amount / the days of the pay period (28 to 31 with the 26th-25th cycle), a half day half
//   of that. So someone paid for the whole period gets the monthly amount, whatever the period's length.
// - An earning marked "cut for unpaid days" (SalaryComponent.cutForUnpaidDays) is paid for the paid halves; any other
//   earning for every half the person is in the company, unpaid or not.
// - Per component, the stretches with one salary (an increment or a transfer splits the period) are added up first and
//   rounded once, to the nearest rupee (50 paise up) - so a transfer alone changes nothing.
// - An earning input (an incentive) is paid as typed, to the paisa.
// - Deduction inputs and the breakup's employer contributions are not earnings: stage 4 works out deductions, the
//   month's employer PF / ESIC and the net.
// - Pay that cannot be worked out is held - no lines - and the person is listed with why (peopleService.holdReasonsOf).

type Day = { date: Date; firstHalf: PayClass; secondHalf: PayClass }

// numerator / denominator paise to the nearest rupee, 50 paise up, in rupees (whole numbers: no floating point)
export function nearestRupee(numerator: number, denominator: number) {
  return Math.floor((2 * numerator + 100 * denominator) / (200 * denominator))
}

// What one person earned: the earning lines, or why their pay is held
export function workOutPay(person: PaySource, days: Day[], periodDays: number): { heldFor: PayHold[]; lines: { salaryComponentId: number; amount: number }[] } {
  const unclear = days.reduce((n, d) => n + (d.firstHalf === 'UNCLEAR' ? 1 : 0) + (d.secondHalf === 'UNCLEAR' ? 1 : 0), 0) / 2
  const heldFor = peopleService.holdReasonsOf(person.segments, unclear)
  if (heldFor.length) return { heldFor, lines: [] }
  // per component: the sum over the stretches of monthly paise x halves paid for (a whole period = 2 x periodDays)
  const numerator = new Map<number, number>()
  for (const segment of person.segments) {
    const inSegment = days.filter((d) => d.date >= segment.fromDate && d.date <= segment.toDate)
    const paidHalves = inSegment.reduce((n, d) => n + (d.firstHalf === 'PAID' ? 1 : 0) + (d.secondHalf === 'PAID' ? 1 : 0), 0)
    const allHalves = 2 * peopleService.daysIn(segment.fromDate, segment.toDate)
    for (const line of segment.lines) {
      if (line.kind !== 'EARNING') continue
      const halves = line.cutForUnpaidDays ? paidHalves : allHalves
      numerator.set(line.salaryComponentId, (numerator.get(line.salaryComponentId) ?? 0) + toPaise(line.monthlyAmount) * halves)
    }
  }
  const paise = new Map([...numerator].map(([id, n]) => [id, nearestRupee(n, 2 * periodDays) * 100]))
  for (const input of person.inputs) {
    if (input.kind === 'EARNING') paise.set(input.salaryComponentId, (paise.get(input.salaryComponentId) ?? 0) + toPaise(input.amount))
  }
  return { heldFor, lines: [...paise].map(([salaryComponentId, p]) => ({ salaryComponentId, amount: p / 100 })) }
}

// --- Working out the pay, from the API ---

// Why stage 3 holds someone, for HR
const HOLD_NOTES: Partial<Record<PayHold, string>> = {
  NOT_IN_PERIOD: 'No days in this pay period (kept for their inputs)',
  NO_SALARY: 'Days with no salary in force - add one through a job change, then refresh the run',
  OTHER_CURRENCY: 'A salary in another currency than INR - an India run does not pay it',
  DAYS_MISSING: 'Days missing in attendance - open the attendance month, lock it again, then work out pay',
}

// Takes the run's days from the locked attendance and works out everyone's pay, replacing what the run held. Only
// while the run is a draft, only from a locked attendance period, only by someone with Payroll Edit over the whole
// company. The answer has counts only - the amounts are read with the salary rule (payroll.people.list / get).
export async function compute(viewer: CurrentUser, { runId, expectedComputedAt }: ComputeInput) {
  return prisma.$transaction(
    async (tx) => {
      const run = await peopleService.draftRunFor(viewer, runId, 'Working out a payroll run', tx)
      if ((run.computedAt?.getTime() ?? null) !== (expectedComputedAt?.getTime() ?? null)) {
        throw new ORPCError('CONFLICT', { message: 'Someone worked out this run in the meantime - reload it to see the latest pay' })
      }
      const rows = await daysService.takeDays(run, viewer.employeeId, tx)
      const { from, to } = peopleService.payPeriodOf(run)
      const periodDays = peopleService.daysIn(from, to)
      const daysOf = new Map<number, Day[]>()
      for (const row of rows) {
        const list = daysOf.get(row.payrollRunEmployeeId)
        if (list) list.push(row)
        else daysOf.set(row.payrollRunEmployeeId, [row])
      }
      const people = await calculationRepository.listPaySources(run.id, tx)
      const ids = people.map((p) => p.employeeId)
      const taxYearFrom = deductionsService.taxYearOf(run.payMonth)
      // what the deductions need (stage 4): the statutory settings, the components' flags and roles, the people's facts,
      // the States of the work locations, the opening tax figures and the earlier months of the tax year
      const [settings, components, facts, locations, openings, earlierLines] = await Promise.all([
        statutoryService.loadSettings(tx),
        salaryComponentsService.listSalaryComponents(true),
        employeesService.listPayrollFacts(ids, to, tx),
        workLocationsService.listWorkLocations({ includeInactive: true }),
        openingsService.openingsFor(ids, taxYearFrom, tx),
        deductionsRepository.listEarlierTaxLines(ids, taxYearFrom, run.payMonth, run.id, tx),
      ])
      const componentInfo = new Map(components.map((c) => [c.id, c]))
      const roleComponent = new Map<StatutoryRole, number>(components.filter((c) => c.statutoryRole).map((c) => [c.statutoryRole!, c.id]))
      const factsOf = new Map(facts.map((f) => [f.id, f]))
      const stateOf = new Map(locations.map((l) => [l.id, l.stateCode]))
      const openingOf = new Map(openings.map((o) => [o.employeeId, o]))
      const earlierOf = new Map<number, Map<string, deductionsService.EarlierMonth>>()
      for (const line of earlierLines) {
        const months = earlierOf.get(line.employeeId) ?? earlierOf.set(line.employeeId, new Map()).get(line.employeeId)!
        const key = deductionsService.monthKey(line.payMonth)
        const month = months.get(key) ?? { taxable: 0, tds: 0, workedOut: false }
        if (line.kind === 'EARNING') {
          month.workedOut = true
          if (line.taxable) month.taxable += line.amount
        }
        if (line.statutoryRole === 'INCOME_TAX') month.tds += line.amount
        months.set(key, month)
      }
      const context: deductionsService.Context = { from, to, payMonth: run.payMonth, settings, components: componentInfo, roleComponent }

      const lines: calculationRepository.LineRow[] = []
      const held: { id: number; heldFor: PayHold[]; heldNote: string | null }[] = []
      for (const person of people) {
        const pay = workOutPay(person, daysOf.get(person.id) ?? [], periodDays)
        if (pay.heldFor.length) {
          held.push({ id: person.id, heldFor: pay.heldFor, heldNote: pay.heldFor.map((h) => HOLD_NOTES[h]).join('; ') })
          continue
        }
        const last = person.segments.at(-1)!
        const fact = factsOf.get(person.employeeId)!
        const deductions = deductionsService.workOutDeductions(
          {
            earnings: pay.lines,
            deductionInputs: person.inputs.filter((i) => i.kind === 'DEDUCTION'),
            employmentType: last.employmentType,
            stateCode: last.workLocationId === null ? undefined : (stateOf.get(last.workLocationId) ?? null),
            monthlyTaxable: last.lines.reduce((sum, l) => (l.kind === 'EARNING' && componentInfo.get(l.salaryComponentId)?.taxable ? sum + l.monthlyAmount : sum), 0),
            dateOfBirth: fact.dateOfBirth,
            gender: fact.gender,
            isPhysicallyDisabled: fact.isPhysicallyDisabled,
            dateOfJoining: fact.dateOfJoining,
            dateOfLeaving: fact.dateOfLeaving,
            statutory: fact.statutory,
            salaries: fact.salaries,
            opening: openingOf.get(person.employeeId) ?? null,
            earlier: earlierOf.get(person.employeeId) ?? new Map(),
          },
          context,
        )
        if (deductions.heldFor.length) {
          held.push({ id: person.id, heldFor: deductions.heldFor, heldNote: deductions.notes.join('; ') })
          continue
        }
        for (const line of pay.lines) lines.push({ payrollRunEmployeeId: person.id, ...line, base: null })
        for (const line of deductions.lines) lines.push({ payrollRunEmployeeId: person.id, ...line })
      }
      await calculationRepository.replaceLines(run.id, lines, viewer.employeeId, tx)
      await calculationRepository.writeHolds(run.id, held, viewer.employeeId, tx)
      await payrollRepository.markComputed(run.id, viewer.employeeId, tx)
      const has = (payClass: PayClass) => new Set(rows.filter((r) => r.firstHalf === payClass || r.secondHalf === payClass).map((r) => r.payrollRunEmployeeId)).size
      return { people: people.length, days: rows.length, peopleWithUnpaidDays: has('UNPAID'), peopleWithUnclearDays: has('UNCLEAR'), peopleHeld: held.length }
    },
    { timeout: 120_000 },
  )
}
