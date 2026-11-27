import { describe, expect, it } from 'vitest'
import type { PayClass } from '#core/db/prisma'
import { nearestRupee, workOutPay } from './calculation.service.js'
import type { PaySource } from './calculation.repository.js'

// What a person earned in a pay run (payroll stage 3, the user 2026-11-27): a day is worth the monthly amount / the days
// of the pay period, each worked-out line is rounded once to the nearest rupee, a component is cut for unpaid days
// unless marked otherwise, inputs are paid as typed. Made-up figures only.

const d = (text: string) => new Date(`${text}T00:00:00Z`)
const BASIC = 1
const ALLOWANCE = 2
const EMPLOYER_PF = 3
const INCENTIVE = 4
const CANTEEN = 5
// a 28-day pay period: 26 Feb - 25 Mar 2093
const FROM = '2093-02-26'
const TO = '2093-03-25'
const PERIOD = 28

const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
type Line = PaySource['segments'][number]['lines'][number]
const earning = (salaryComponentId: number, monthlyAmount: number, cutForUnpaidDays = true): Line => ({ salaryComponentId, monthlyAmount, kind: 'EARNING', cutForUnpaidDays })
const segment = (fromDate: string, toDate: string, lines: Line[], annualCtc: number | null = 600000, currency: string | null = 'INR') => ({ fromDate: d(fromDate), toDate: d(toDate), annualCtc, currency, lines })
const person = (segments: PaySource['segments'], inputs: PaySource['inputs'] = []): PaySource => ({ id: 1, segments, inputs })
// every day from..to, paid unless `classOf(i)` says otherwise (i = 0 on the first day)
const days = (from: string, to: string, classOf: (i: number) => [PayClass, PayClass] = () => ['PAID', 'PAID']) => {
  const out: { date: Date; firstHalf: PayClass; secondHalf: PayClass }[] = []
  for (let date = d(from), i = 0; date <= d(to); date = addDays(date, 1), i++) {
    const [firstHalf, secondHalf] = classOf(i)
    out.push({ date, firstHalf, secondHalf })
  }
  return out
}
const amounts = (pay: ReturnType<typeof workOutPay>) => Object.fromEntries(pay.lines.map((l) => [l.salaryComponentId, l.amount]))

describe('rounding to the rupee', () => {
  it('is to the nearest rupee, 50 paise up, worked in whole paise', () => {
    // 2,500.49 / 2,500.50 / 2,500.51 (as paise over 1)
    expect([nearestRupee(250049, 1), nearestRupee(250050, 1), nearestRupee(250051, 1)]).toEqual([2500, 2501, 2501])
    // 10,000 a month for 27 of 28 days = 9,642.857... -> 9,643
    expect(nearestRupee(1000000 * 54, 56)).toBe(9643)
    expect(nearestRupee(0, 56)).toBe(0)
  })
})

describe('what a person earned', () => {
  it('paid for the whole period: the monthly amount to the rupee, whatever the period is long', () => {
    const pay = workOutPay(person([segment(FROM, TO, [earning(BASIC, 24333.33), earning(ALLOWANCE, 24333.34)])]), days(FROM, TO), PERIOD)
    expect(pay.heldFor).toEqual([])
    expect(amounts(pay)).toEqual({ [BASIC]: 24333, [ALLOWANCE]: 24333 })
  })

  it('an unpaid day costs monthly / the days of the period; a half day half of it', () => {
    // 1 absent day and 1 absent half: 26.5 of 28 days paid
    const pay = workOutPay(person([segment(FROM, TO, [earning(BASIC, 28000)])]), days(FROM, TO, (i) => (i === 3 ? ['UNPAID', 'UNPAID'] : i === 9 ? ['UNPAID', 'PAID'] : ['PAID', 'PAID'])), PERIOD)
    expect(amounts(pay)).toEqual({ [BASIC]: 26500 })
  })

  it('a component not cut for unpaid days is paid for every day in the company', () => {
    const pay = workOutPay(
      person([segment(FROM, TO, [earning(BASIC, 14000), earning(ALLOWANCE, 1400, false)])]),
      days(FROM, TO, (i) => (i < 7 ? ['UNPAID', 'UNPAID'] : ['PAID', 'PAID'])),
      PERIOD,
    )
    expect(amounts(pay)).toEqual({ [BASIC]: 10500, [ALLOWANCE]: 1400 })
  })

  it('a joiner is paid for their days - the allowance not cut for unpaid days too', () => {
    // joined on the 15th day of the period: 14 of 28 days, one of them unpaid
    const pay = workOutPay(
      person([segment('2093-03-12', TO, [earning(BASIC, 28000), earning(ALLOWANCE, 2800, false)])]),
      days('2093-03-12', TO, (i) => (i === 0 ? ['UNPAID', 'UNPAID'] : ['PAID', 'PAID'])),
      PERIOD,
    )
    expect(amounts(pay)).toEqual({ [BASIC]: 13000, [ALLOWANCE]: 1400 })
  })

  it('an increment inside the period: each stretch at its own salary, added up before rounding', () => {
    // 6 days at 21,000 and 22 days at 23,333.33 -> 4,500 + 18,333.33 = 22,833.33 -> 22,833
    const pay = workOutPay(person([segment(FROM, '2093-03-03', [earning(BASIC, 21000)]), segment('2093-03-04', TO, [earning(BASIC, 23333.33)])]), days(FROM, TO), PERIOD)
    expect(amounts(pay)).toEqual({ [BASIC]: 22833 })
  })

  it('a transfer alone (same salary, two stretches) changes nothing', () => {
    const lines = [earning(BASIC, 24333.33)]
    const one = workOutPay(person([segment(FROM, TO, lines)]), days(FROM, TO, (i) => (i === 5 ? ['UNPAID', 'UNPAID'] : ['PAID', 'PAID'])), PERIOD)
    const two = workOutPay(person([segment(FROM, '2093-03-10', lines), segment('2093-03-11', TO, lines)]), days(FROM, TO, (i) => (i === 5 ? ['UNPAID', 'UNPAID'] : ['PAID', 'PAID'])), PERIOD)
    expect(amounts(two)).toEqual(amounts(one))
  })

  it('nothing paid: every cut line is zero, still written', () => {
    const pay = workOutPay(person([segment(FROM, TO, [earning(BASIC, 20000)])]), days(FROM, TO, () => ['UNPAID', 'UNPAID']), PERIOD)
    expect(pay.lines).toEqual([{ salaryComponentId: BASIC, amount: 0 }])
  })

  it('earning inputs are paid as typed; deduction inputs and the employer contributions are not earnings', () => {
    const pay = workOutPay(
      person(
        [segment(FROM, TO, [earning(BASIC, 20000), { salaryComponentId: EMPLOYER_PF, monthlyAmount: 1800, kind: 'EMPLOYER_CONTRIBUTION', cutForUnpaidDays: true }])],
        [
          { salaryComponentId: INCENTIVE, amount: 1234.5, kind: 'EARNING' },
          { salaryComponentId: INCENTIVE, amount: 100.25, kind: 'EARNING' },
          { salaryComponentId: CANTEEN, amount: 300, kind: 'DEDUCTION' },
        ],
      ),
      days(FROM, TO),
      PERIOD,
    )
    expect(amounts(pay)).toEqual({ [BASIC]: 20000, [INCENTIVE]: 1334.75 })
  })

  it('is held - never guessed - with no salary, a salary in another currency, days missing, or no days in the period', () => {
    const lines = [earning(BASIC, 20000)]
    expect(workOutPay(person([segment(FROM, TO, [], null, null)]), days(FROM, TO), PERIOD)).toEqual({ heldFor: ['NO_SALARY'], lines: [] })
    expect(workOutPay(person([segment(FROM, TO, lines, 600000, 'USD')]), days(FROM, TO), PERIOD)).toEqual({ heldFor: ['OTHER_CURRENCY'], lines: [] })
    expect(workOutPay(person([segment(FROM, TO, lines)]), days(FROM, TO, (i) => (i === 2 ? ['UNCLEAR', 'PAID'] : ['PAID', 'PAID'])), PERIOD)).toEqual({ heldFor: ['DAYS_MISSING'], lines: [] })
    expect(workOutPay(person([], [{ salaryComponentId: INCENTIVE, amount: 500, kind: 'EARNING' }]), [], PERIOD)).toEqual({ heldFor: ['NOT_IN_PERIOD'], lines: [] })
  })
})
