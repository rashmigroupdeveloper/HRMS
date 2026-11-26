import { describe, expect, it } from 'vitest'
import type { attendanceService } from '#modules/attendance'
import { buildDays, classOfHalf } from './days.service.js'

// Which days a pay run pays (payroll stage 3): the rule that turns attendance's half days into paid / unpaid / unclear.
// Made-up data.

const d = (text: string) => new Date(`${text}T00:00:00Z`)
type Half = attendanceService.PayrollHalf
const half = (status: Half['status'], leave: Half['leave'] = null): Half => ({ status, leave })
const day = (employeeId: number, date: string, first: Half, second: Half = first): attendanceService.PayrollDay => ({ employeeId, date: d(date), first, second })

describe('the pay class of a half day', () => {
  it('follows attendance: worked, off and holiday halves are paid; absent and missed punch are not', () => {
    for (const status of ['PRESENT', 'ON_DUTY', 'WEEKLY_OFF', 'HOLIDAY'] as const) expect(classOfHalf(half(status))).toEqual({ payClass: 'PAID', status, leaveCode: null })
    for (const status of ['ABSENT', 'MISSED_PUNCH'] as const) expect(classOfHalf(half(status))).toEqual({ payClass: 'UNPAID', status, leaveCode: null })
  })

  it('leave is paid or not by its type, and keeps the type code', () => {
    expect(classOfHalf(half('LEAVE', { code: 'CL', paid: true }))).toEqual({ payClass: 'PAID', status: 'LEAVE', leaveCode: 'CL' })
    expect(classOfHalf(half('LEAVE', { code: 'LWP', paid: false }))).toEqual({ payClass: 'UNPAID', status: 'LEAVE', leaveCode: 'LWP' })
  })

  it('is never guessed: no attendance day, or leave with no leave found, is unclear', () => {
    expect(classOfHalf(undefined)).toEqual({ payClass: 'UNCLEAR', status: null, leaveCode: null })
    expect(classOfHalf(half('LEAVE'))).toEqual({ payClass: 'UNCLEAR', status: 'LEAVE', leaveCode: null })
    // a whole day's status never belongs to a half
    expect(classOfHalf(half('HALF_DAY')).payClass).toBe('UNCLEAR')
  })
})

describe('the days of a run', () => {
  const person = { id: 70, employeeId: 7, segments: [{ fromDate: d('2092-02-26'), toDate: d('2092-02-28') }] }

  it('one row per day of each stretch, classed half by half', () => {
    const rows = buildDays([person], [
      day(7, '2092-02-26', half('PRESENT')),
      // a Saturday: the first half is worked, the second is off - absent costs half a day (the user, 2026-11-27)
      day(7, '2092-02-27', half('ABSENT'), half('WEEKLY_OFF')),
      day(7, '2092-02-28', half('LEAVE', { code: 'LWP', paid: false }), half('PRESENT')),
    ])
    expect(rows.map((r) => [r.date.toISOString().slice(0, 10), r.firstHalf, r.secondHalf, r.firstStatus, r.secondStatus, r.firstLeaveCode])).toEqual([
      ['2092-02-26', 'PAID', 'PAID', 'PRESENT', 'PRESENT', null],
      ['2092-02-27', 'UNPAID', 'PAID', 'ABSENT', 'WEEKLY_OFF', null],
      ['2092-02-28', 'UNPAID', 'PAID', 'LEAVE', 'PRESENT', 'LWP'],
    ])
    expect(rows.every((r) => r.payrollRunEmployeeId === 70)).toBe(true)
  })

  it('a day attendance never worked out is unclear, not unpaid', () => {
    const rows = buildDays([person], [day(7, '2092-02-26', half('PRESENT'))])
    expect(rows.map((r) => [r.firstHalf, r.firstStatus])).toEqual([['PAID', 'PRESENT'], ['UNCLEAR', null], ['UNCLEAR', null]])
  })

  it('only the days inside the stretches: days in another company, another person or outside the period get no row', () => {
    const moved = { id: 71, employeeId: 8, segments: [{ fromDate: d('2092-02-26'), toDate: d('2092-02-26') }, { fromDate: d('2092-03-01'), toDate: d('2092-03-01') }] }
    const rows = buildDays([moved, { id: 72, employeeId: 9, segments: [] }], [
      day(8, '2092-02-26', half('PRESENT')),
      day(8, '2092-02-27', half('ABSENT')),
      day(8, '2092-03-01', half('HOLIDAY')),
      day(9, '2092-02-26', half('PRESENT')),
      day(7, '2092-02-26', half('ABSENT')),
    ])
    expect(rows.map((r) => [r.payrollRunEmployeeId, r.date.toISOString().slice(0, 10), r.firstHalf])).toEqual([
      [71, '2092-02-26', 'PAID'],
      [71, '2092-03-01', 'PAID'],
    ])
  })
})
