// Texts shared by the payroll pages and their skeletons - change both together.
export const PAYROLL_NOTE = 'Monthly runs per company. A run lists its people with the salary in force on each day, takes the month\'s inputs, and takes each person\'s paid and unpaid days from the locked attendance. The amounts, deductions, approval and payment follow in later stages.'

// The run page's header facts and tiles
// 'Pay period': the attendance cycle of the pay month, captured on the run (26th to 25th with a start day of 26)
export const RUN_FACT_LABELS = ['Pay period', 'People copied', 'Days worked out'] as const
export const RUN_TILE_LABELS = ['People', 'Without a salary', 'Inputs', 'With unpaid days', 'To check'] as const
export const RUN_TABS = [{ value: 'people', label: 'People' }, { value: 'inputs', label: 'Inputs' }] as const
export const REFRESH_LABEL = 'Refresh from employee records'
export const COMPUTE_LABEL = 'Work out days'
export const NOT_LOCKED_NOTE = 'Attendance for this pay period is not locked yet. Lock the month in Attendance setup › Month lock; then the days can be worked out.'
export const OUTDATED_NOTE = 'Attendance was opened or locked again after these days were taken. Work out the days again.'

// The people table
export const PEOPLE_COLUMNS = ['Employee', 'Days', 'Paid', 'Unpaid', 'In the run', 'Monthly gross', 'Notes'] as const
export const PEOPLE_WIDTHS = ['25%', '7%', '7%', '8%', '20%', '13%', '20%'] as const
export const PEOPLE_FLAGS = [
  { value: '', label: 'Everyone' },
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
export const DAYS_NOT_WORKED_OUT = 'The days are not worked out yet.'
export const ALL_ABSENT_NOTE = 'Absent on every working day, with no punch, leave or duty at all. If this person does not punch, mark them “Not tracked” on Attendance setup › Schedules (the attendance month must be open), then lock the month and work out the days again.'

export const SALARY_HIDDEN_NOTE = 'Salary figures need Salary access for the whole company as well as Payroll.'
export const monthLabel = (date: Date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
// 28.5 days, 2 days - never 2.0
export const dayCount = (days: number) => (Number.isInteger(days) ? String(days) : days.toFixed(1))
