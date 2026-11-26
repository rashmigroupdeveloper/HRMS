// Texts shared by the payroll pages and their skeletons - change both together.
export const PAYROLL_NOTE = 'Monthly runs per company. A run lists its people with the salary in force on each day, and takes the month\'s inputs. Calculation, deductions, approval and payment follow in later stages.'

// The run page's header facts and tiles
export const RUN_FACT_LABELS = ['Pay period', 'Attendance period', 'People copied'] as const
export const RUN_TILE_LABELS = ['People', 'People without a salary', 'Inputs'] as const
export const RUN_TABS = [{ value: 'people', label: 'People' }, { value: 'inputs', label: 'Inputs' }] as const

// The people table
export const PEOPLE_COLUMNS = ['Employee', 'Days', 'In the run', 'Monthly gross', 'Notes'] as const
export const PEOPLE_WIDTHS = ['30%', '10%', '22%', '16%', '22%'] as const
export const PEOPLE_FLAGS = [
  { value: '', label: 'Everyone' },
  { value: 'NO_SALARY', label: 'Days without salary' },
  { value: 'CHANGED', label: 'Changed in the month' },
  { value: 'HAS_INPUTS', label: 'Has inputs' },
  { value: 'NOT_IN_PERIOD', label: 'No longer in the period' },
] as const

// The inputs table
export const INPUT_COLUMNS = ['Employee', 'Item', 'Amount', 'Why', 'Entered by', ''] as const
export const INPUT_WIDTHS = ['20%', '15%', '11%', '26%', '20%', '8%'] as const

export const SALARY_HIDDEN_NOTE = 'Salary figures need Salary access for the whole company as well as Payroll.'
export const monthLabel = (date: Date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
