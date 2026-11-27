// Texts shared by the payroll pages and their skeletons - change both together.
export const PAYROLL_NOTE = 'Monthly runs per company. A run lists its people with the salary in force on each day, takes the month\'s inputs, and works out each person\'s pay: the paid and unpaid days from the locked attendance, what they earned, the deductions (PF, ESIC, professional tax, LWF, income tax) and the net. Approval and payment follow in later stages.'
export const PAYROLL_DESK_TITLE = 'This pay period'

// The run page's header facts and tiles
// 'Pay period': the attendance cycle of the pay month, captured on the run (26th to 25th with a start day of 26)
export const RUN_FACT_LABELS = ['Pay period', 'People copied', 'Pay worked out'] as const
export const RUN_TILE_LABELS = ['People', 'Without a salary', 'Inputs', 'With unpaid days', 'To check', 'Earned gross', 'Net pay'] as const
export const RUN_TABS = [{ value: 'people', label: 'People' }, { value: 'inputs', label: 'Inputs' }] as const
export const REFRESH_LABEL = 'Refresh from employee records'
export const COMPUTE_LABEL = 'Work out pay'
export const NOT_LOCKED_NOTE = 'Attendance for this pay period is not locked yet. Lock the month in Attendance setup › Month lock; then the pay can be worked out.'
export const OUTDATED_NOTE = 'Attendance was opened or locked again after the pay was worked out. Work out pay again.'
// the rule (backend payroll/calculation and payroll/deductions, decided by the user 2026-11-27 - change both together)
export const PAY_RULE_NOTE = 'A day is worth the monthly amount ÷ the days of the pay period; each line is rounded to the nearest rupee. Deductions follow the dated rates and slabs on Statutory settings.'
// why a person's pay is not worked out (backend PayHold - change both together); the run also stores the detail
export const HOLD_REASON = {
  NOT_IN_PERIOD: 'No days in this pay period',
  NO_SALARY: 'Days without a salary',
  OTHER_CURRENCY: 'Salary in another currency',
  DAYS_MISSING: 'Days missing in attendance',
  NO_WORK_LOCATION: 'No work location',
  NO_RATE: 'A rate or slab not in force',
  NO_COMPONENT: 'A statutory component not set',
  OVER_HALF: 'Deductions over half of the wages',
  TAX_TO_TYPE: 'Income tax to type',
} as const
export const AGAIN_NOTE = 'Their inputs changed after the pay was worked out. Work out pay again.'
export const PAY_TITLE = 'Earned in the pay period'
export const DEDUCTIONS_TITLE = 'Deducted'
export const EMPLOYER_TITLE = 'Paid by the company on top'
export const NO_PF_NOTE = 'worked out with no PF - their statutory details do not say “PF applicable”. Check the tick if they should be members.'

// The people table
export const PEOPLE_COLUMNS = ['Employee', 'Days', 'Paid', 'Unpaid', 'In the run', 'Monthly gross', 'Earned', 'Net pay', 'Notes'] as const
export const PEOPLE_WIDTHS = ['19%', '5%', '5%', '6%', '16%', '10%', '10%', '10%', '19%'] as const
export const PEOPLE_FLAGS = [
  { value: '', label: 'Everyone' },
  { value: 'PAY_NOT_WORKED_OUT', label: 'Pay not worked out' },
  { value: 'NO_PF', label: 'No PF' },
  { value: 'UNPAID_DAYS', label: 'With unpaid days' },
  { value: 'UNCLEAR_DAYS', label: 'Days to check' },
  { value: 'ALL_ABSENT', label: 'Absent throughout' },
  { value: 'NO_SALARY', label: 'Days without salary' },
  { value: 'CHANGED', label: 'Changed in the period' },
  { value: 'HAS_INPUTS', label: 'Has inputs' },
  { value: 'NOT_IN_PERIOD', label: 'No longer in the period' },
] as const

// The inputs table
export const INPUT_COLUMNS = ['Employee', 'Item', 'Amount', 'Why', 'Entered by', ''] as const
export const INPUT_WIDTHS = ['20%', '15%', '11%', '26%', '20%', '8%'] as const

// A person's days: what attendance said of a half, as the muster writes it (a leave half shows its type's code)
export const STATUS_CODE = { PRESENT: 'P', HALF_DAY: 'HD', ABSENT: 'A', WEEKLY_OFF: 'WO', HOLIDAY: 'H', MISSED_PUNCH: 'MP', LEAVE: 'L', ON_DUTY: 'OD' } as const
export const DAY_TOTAL_LABELS = ['Paid', 'Unpaid', 'To check'] as const
export const DAYS_LEGEND = 'P present · A absent · MP missed punch · WO weekly off · H holiday · OD on duty · leave by its type · ? not known. Two codes: first half / second half.'
export const DAYS_NOT_WORKED_OUT = 'The pay is not worked out yet.'
export const ALL_ABSENT_NOTE = 'Absent on every working day, with no punch, leave or duty at all. If this person does not punch, mark them “Not tracked” on Attendance setup › Schedules (the attendance month must be open), then lock the month and work out pay again.'

export const SALARY_HIDDEN_NOTE = 'Salary figures need Salary access for the whole company as well as Payroll.'
export const monthLabel = (date: Date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
// 28.5 days, 2 days - never 2.0
export const dayCount = (days: number) => (Number.isInteger(days) ? String(days) : days.toFixed(1))
