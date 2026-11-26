import { describe, expect, it } from 'vitest'
import { buildPeople, daysIn, payPeriodOf } from './people.service.js'

// Who is in a pay run and the stretches of days with one salary and one placement (payroll stage 2) - made-up data.

const d = (text: string) => new Date(`${text}T00:00:00Z`)
const COMPANY = 1
const OTHER = 2
const from = d('2092-03-01')
const to = d('2092-03-31')

const job = (effectiveFrom: string, extra: Partial<{ companyId: number; plantId: number; departmentId: number; costCenterId: number | null; employeeCode: string }> = {}) => ({
  effectiveFrom: d(effectiveFrom),
  companyId: COMPANY,
  employeeCode: 'TST001',
  plantId: 10,
  departmentId: 20,
  costCenterId: null,
  employmentType: 'PERMANENT' as const,
  workforceCategory: 'WHITE_COLLAR' as const,
  ...extra,
})
const salary = (id: number, effectiveFrom: string, annualCtc: number) => ({
  id,
  effectiveFrom: d(effectiveFrom),
  annualCtc,
  currency: 'INR',
  lines: [{ salaryComponentId: 1, monthlyAmount: annualCtc / 12 }],
})
const person = (extra: Partial<{ dateOfJoining: Date; dateOfLeaving: Date | null; jobRecords: ReturnType<typeof job>[]; salaries: ReturnType<typeof salary>[] }> = {}) => ({
  id: 7,
  dateOfJoining: d('2090-01-01'),
  dateOfLeaving: null,
  jobRecords: [job('2090-01-01')],
  salaries: [salary(100, '2090-01-01', 480000)],
  ...extra,
})
const segments = (source: ReturnType<typeof person>) =>
  buildPeople(COMPANY, from, to, [source])[0]?.segments.map((s) => [s.fromDate.toISOString().slice(0, 10), s.toDate.toISOString().slice(0, 10), s.employeeSalaryId, s.plantId])

describe('pay run people and segments', () => {
  it('the period is the attendance cycle captured on the run - whatever its start day (the user, 2026-11-27)', () => {
    // start day 26: "February" pays 26 Jan - 25 Feb
    expect(payPeriodOf({ attendanceFrom: d('2092-01-26'), attendanceTo: d('2092-02-25') })).toEqual({ from: d('2092-01-26'), to: d('2092-02-25') })
    // start day 1: the calendar month
    expect(payPeriodOf({ attendanceFrom: d('2092-02-01'), attendanceTo: d('2092-02-29') })).toEqual({ from: d('2092-02-01'), to: d('2092-02-29') })
    expect(daysIn(d('2092-03-01'), d('2092-03-31'))).toBe(31)
    expect(daysIn(d('2092-01-26'), d('2092-02-25'))).toBe(31)
    expect(daysIn(d('2092-02-26'), d('2092-03-25'))).toBe(29)
  })

  it('a period from the 26th to the 25th: an increment from the 1st splits it; a joiner on the 26th waits for the next run', () => {
    const cycle = (source: ReturnType<typeof person>) =>
      buildPeople(COMPANY, d('2092-01-26'), d('2092-02-25'), [source])[0]?.segments.map((s) => [s.fromDate.toISOString().slice(0, 10), s.toDate.toISOString().slice(0, 10), s.employeeSalaryId])
    expect(cycle(person())).toEqual([['2092-01-26', '2092-02-25', 100]])
    expect(cycle(person({ salaries: [salary(100, '2090-01-01', 480000), salary(101, '2092-02-01', 528000)] }))).toEqual([
      ['2092-01-26', '2092-01-31', 100],
      ['2092-02-01', '2092-02-25', 101],
    ])
    // joined on 26 Feb - the first day of the next period
    expect(cycle(person({ dateOfJoining: d('2092-02-26'), jobRecords: [job('2092-02-26')], salaries: [salary(100, '2092-02-26', 480000)] }))).toBeUndefined()
    // left on 26 Jan - one day in this period
    expect(cycle(person({ dateOfLeaving: d('2092-01-26') }))).toEqual([['2092-01-26', '2092-01-26', 100]])
  })

  it('a full month with one salary is one segment', () => {
    expect(segments(person())).toEqual([['2092-03-01', '2092-03-31', 100, 10]])
  })

  it('an increment from the 16th splits the month', () => {
    expect(segments(person({ salaries: [salary(100, '2090-01-01', 480000), salary(101, '2092-03-16', 528000)] }))).toEqual([
      ['2092-03-01', '2092-03-15', 100, 10],
      ['2092-03-16', '2092-03-31', 101, 10],
    ])
  })

  it('a joiner starts on the joining day; a leaver ends on the leaving day (included)', () => {
    expect(segments(person({ dateOfJoining: d('2092-03-27'), jobRecords: [job('2092-03-27')], salaries: [salary(100, '2092-03-27', 480000)] }))).toEqual([
      ['2092-03-27', '2092-03-31', 100, 10],
    ])
    expect(segments(person({ dateOfLeaving: d('2092-03-28') }))).toEqual([['2092-03-01', '2092-03-28', 100, 10]])
  })

  it('someone who left before the period or joins after it is not in the run', () => {
    expect(buildPeople(COMPANY, from, to, [person({ dateOfLeaving: d('2092-02-28') })])).toEqual([])
    expect(buildPeople(COMPANY, from, to, [person({ dateOfJoining: d('2092-04-01') })])).toEqual([])
  })

  it('a transfer to another plant mid-month splits the month; a change of nothing copied does not', () => {
    expect(segments(person({ jobRecords: [job('2090-01-01'), job('2092-03-10', { plantId: 11 })] }))).toEqual([
      ['2092-03-01', '2092-03-09', 100, 10],
      ['2092-03-10', '2092-03-31', 100, 11],
    ])
    // a new job-timeline row with the same placement (e.g. only the manager changed) keeps one segment
    expect(segments(person({ jobRecords: [job('2090-01-01'), job('2092-03-10')] }))).toEqual([['2092-03-01', '2092-03-31', 100, 10]])
  })

  it('a move to another company mid-month: each company pays only its own days, with the code it had', () => {
    const moved = person({ jobRecords: [job('2090-01-01'), job('2092-03-21', { companyId: OTHER, employeeCode: 'OTH009' })] })
    expect(segments(moved)).toEqual([['2092-03-01', '2092-03-20', 100, 10]])
    expect(buildPeople(OTHER, from, to, [moved])[0]).toMatchObject({ employeeCode: 'OTH009', segments: [{ fromDate: d('2092-03-21'), toDate: d('2092-03-31') }] })
  })

  it('days with no salary in force are a segment without a salary', () => {
    expect(segments(person({ salaries: [salary(100, '2092-03-11', 480000)] }))).toEqual([
      ['2092-03-01', '2092-03-10', null, 10],
      ['2092-03-11', '2092-03-31', 100, 10],
    ])
    expect(buildPeople(COMPANY, from, to, [person({ salaries: [] })])[0]?.segments[0]).toMatchObject({ annualCtc: null, lines: [] })
  })

  it('a salary starting after the period is ignored; the one in force on the 1st applies', () => {
    expect(segments(person({ salaries: [salary(100, '2090-01-01', 480000), salary(102, '2092-04-01', 600000)] }))).toEqual([['2092-03-01', '2092-03-31', 100, 10]])
  })
})
