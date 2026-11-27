import { ORPCError } from '@orpc/server'
import { prisma, type PayClass } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { toPaise } from '#shared/utils/money'
import * as payrollRepository from '../payroll.repository.js'
import * as daysService from '../days/days.service.js'
import * as peopleService from '../people/people.service.js'
import type { HoldReason } from '../people/people.service.js'
import * as calculationRepository from './calculation.repository.js'
import type { PaySource } from './calculation.repository.js'
import type { ComputeInput } from './calculation.schema.js'

// Payroll stage 3, the money (approved by the user 2026-11-27): what each person of a run earned in its pay period.
// "Work out pay" takes the days from the locked attendance (payroll/days) and works the amounts out from them in one
// step; the results (PayrollRunLine) are rebuilt each time, the run records who and when (computedAt / ById).

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
export function workOutPay(person: PaySource, days: Day[], periodDays: number): { heldFor: HoldReason[]; lines: { salaryComponentId: number; amount: number }[] } {
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

// Takes the run's days from the locked attendance and works out everyone's earnings, replacing what the run held. Only
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
      const lines: calculationRepository.LineRow[] = []
      let held = 0
      for (const person of people) {
        const pay = workOutPay(person, daysOf.get(person.id) ?? [], periodDays)
        if (pay.heldFor.length) held += 1
        for (const line of pay.lines) lines.push({ payrollRunEmployeeId: person.id, ...line })
      }
      await calculationRepository.replaceLines(run.id, lines, viewer.employeeId, tx)
      await payrollRepository.markComputed(run.id, viewer.employeeId, tx)
      const has = (payClass: PayClass) => new Set(rows.filter((r) => r.firstHalf === payClass || r.secondHalf === payClass).map((r) => r.payrollRunEmployeeId)).size
      return { people: people.length, days: rows.length, peopleWithUnpaidDays: has('UNPAID'), peopleWithUnclearDays: has('UNCLEAR'), peopleHeld: held }
    },
    { timeout: 120_000 },
  )
}
