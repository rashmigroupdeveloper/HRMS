import { describe, expect, it } from 'vitest'
import { dueOn } from '../statutory/statutory.service.js'
import { standingOf } from './deposits.service.js'

// Payroll stage 6 slice 3: where a scheme's month stands, and when it is due - pure rules, made-up figures

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const none = { count: 0, amount: 0 }

describe('standingOf', () => {
  const base = { due: 1000.5, deposited: 0, filedUnpaid: 0, leftOut: none, dueOn: d('2030-04-15'), lastPaidOn: null }

  it('nothing yet, filed but not paid, short - overdue after the due date', () => {
    expect(standingOf(base, d('2030-04-10'))).toMatchObject({ state: 'NOT_DEPOSITED', daysOverdue: 0, difference: 1000.5 })
    expect(standingOf({ ...base, filedUnpaid: 1000.5 }, d('2030-04-18'))).toMatchObject({ state: 'FILED_NOT_PAID', daysOverdue: 3 })
    expect(standingOf({ ...base, deposited: 600 }, d('2030-04-18'))).toMatchObject({ state: 'SHORT', difference: 400.5 })
  })

  it('compared to the paisa; late when paid after the due date', () => {
    expect(standingOf({ ...base, deposited: 1000.5, lastPaidOn: d('2030-04-14') }, d('2030-05-01'))).toMatchObject({ state: 'DEPOSITED', daysOverdue: 0, daysLate: 0 })
    expect(standingOf({ ...base, deposited: 1000.5, lastPaidOn: d('2030-04-20') }, d('2030-05-01'))).toMatchObject({ state: 'DEPOSITED', daysLate: 5 })
    expect(standingOf({ ...base, deposited: 1000.51 }, d('2030-05-01'))).toMatchObject({ state: 'MORE_THAN_DUE', daysOverdue: 0 })
  })

  it('people left out are not expected yet, but the month is still owed', () => {
    const leftOut = { count: 1, amount: 200.5 }
    expect(standingOf({ ...base, deposited: 800, leftOut }, d('2030-04-20'))).toMatchObject({ state: 'PEOPLE_LEFT_OUT', difference: 0, daysOverdue: 5 })
    // no due date set: never overdue
    expect(standingOf({ ...base, dueOn: null }, d('2031-01-01'))).toMatchObject({ state: 'NOT_DEPOSITED', daysOverdue: 0 })
  })
})

describe('dueOn', () => {
  const by = { createdAt: d('2030-01-01'), createdById: 0 }
  const rows = [
    { ...by, scheme: 'PF' as const, stateCode: null, effectiveFrom: d('2030-01-01'), day: 15 },
    { ...by, scheme: 'PF' as const, stateCode: null, effectiveFrom: d('2030-06-01'), day: 10 },
    { ...by, scheme: 'PROFESSIONAL_TAX' as const, stateCode: 'ZA', effectiveFrom: d('2030-01-01'), day: 31 },
  ]

  it('the day of the month after the pay month, from the row in force on the pay month', () => {
    expect(dueOn(rows, 'PF', null, d('2030-03-01'))).toEqual(d('2030-04-15'))
    expect(dueOn(rows, 'PF', null, d('2030-06-01'))).toEqual(d('2030-07-10'))
    // December's pay: January of the next year
    expect(dueOn(rows, 'PF', null, d('2030-12-01'))).toEqual(d('2031-01-10'))
  })

  it("a day past the month's end is its last day; per State; none = null", () => {
    expect(dueOn(rows, 'PROFESSIONAL_TAX', 'ZA', d('2030-01-01'))).toEqual(d('2030-02-28'))
    expect(dueOn(rows, 'PROFESSIONAL_TAX', 'ZB', d('2030-01-01'))).toBeNull()
    expect(dueOn(rows, 'ESIC', null, d('2030-01-01'))).toBeNull()
    expect(dueOn(rows, 'PF', null, d('2029-12-01'))).toBeNull()
  })
})
