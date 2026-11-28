// Texts of the statutory settings page (payroll stage 4) shared with its skeleton - change both together.

export const STATUTORY_TITLE = 'Statutory settings'
export const STATUTORY_NOTE =
  'Every rate, ceiling and slab payroll works with, each from a date and with the notification it comes from. Nothing is filled in for you: enter them from the official notifications and have your CA check them. A pay run that finds no figure in force holds the person - it never counts it as zero.'
export const STATUTORY_TABS = [
  { value: 'rates', label: 'Rates' },
  { value: 'pt', label: 'Professional tax' },
  { value: 'lwf', label: 'Labour welfare fund' },
  { value: 'tax', label: 'Income tax' },
  { value: 'openings', label: 'Opening tax figures' },
  { value: 'settings', label: 'Run settings' },
] as const
// The payroll settings (stage 5 - backend PayrollSetting; change both together)
export const SETTING_LABELS = {
  tdsCountsDraftRuns: ['Earlier months for TDS', 'Which runs of earlier months the monthly TDS counts'],
  bigChangePercent: ['Big change from last month', 'Net pay more than this % above or below last month is a warning'],
  epsAgeSoonMonths: ['EPS age limit soon', 'Warn this many months before a member reaches the EPS age limit'],
  // stage 6 slice 2: the owed list's days overdue
  paymentDueDays: ['Wages due', 'Wages are due this many days after the pay period ends - the owed list counts days overdue from then (to verify with counsel)'],
} as const
export type StatutoryTab = (typeof STATUTORY_TABS)[number]['value']
export const CHANGE_NOTE = 'Changing them needs Payroll Edit for every company.'

// The rates (backend StatutoryParameter - change both together): what each is and its unit
export const PARAMETERS = {
  PF_EMPLOYEE_RATE: { label: "Employee's PF", unit: '%', group: 'PF' },
  PF_EMPLOYER_RATE: { label: "Employer's PF (EPF + EPS)", unit: '%', group: 'PF' },
  EPS_RATE: { label: 'Pension (EPS) share', unit: '%', group: 'PF' },
  EDLI_RATE: { label: 'EDLI', unit: '%', group: 'PF' },
  PF_WAGE_CEILING: { label: 'PF wage ceiling', unit: '₹ a month', group: 'PF' },
  EPS_AGE_LIMIT: { label: 'EPS age limit', unit: 'years', group: 'PF' },
  ESIC_EMPLOYEE_RATE: { label: "Employee's ESIC", unit: '%', group: 'ESIC' },
  ESIC_EMPLOYER_RATE: { label: "Employer's ESIC", unit: '%', group: 'ESIC' },
  ESIC_WAGE_CEILING: { label: 'ESIC wage ceiling', unit: '₹ a month', group: 'ESIC' },
  ESIC_WAGE_CEILING_DISABLED: { label: 'ESIC ceiling, persons with disabilities', unit: '₹ a month', group: 'ESIC' },
  TAX_STANDARD_DEDUCTION: { label: 'Standard deduction (new regime)', unit: '₹ a year', group: 'Income tax' },
  TAX_REBATE_INCOME_LIMIT: { label: 'Rebate income limit', unit: '₹ a year', group: 'Income tax' },
  TAX_REBATE_MAX: { label: 'Largest rebate', unit: '₹ a year', group: 'Income tax' },
  TAX_CESS_RATE: { label: 'Health and education cess', unit: '%', group: 'Income tax' },
  TAX_SURCHARGE_FROM: { label: 'Surcharge from (TDS typed above it)', unit: '₹ a year', group: 'Income tax' },
} as const
export type Parameter = keyof typeof PARAMETERS
export const RATE_COLUMNS = ['Rate', 'From', 'Value', 'Notification', ''] as const
export const RATE_WIDTHS = ['30%', '14%', '16%', '32%', '8%'] as const

export const PT_COLUMNS = ['State', 'From', 'Slabs (monthly gross → tax)', 'Notification', ''] as const
export const PT_WIDTHS = ['10%', '14%', '42%', '26%', '8%'] as const
export const LWF_COLUMNS = ['State', 'From', 'Employee', 'Employer', 'Pay months', 'Notification', ''] as const
export const LWF_WIDTHS = ['10%', '14%', '12%', '12%', '16%', '28%', '8%'] as const
export const TAX_COLUMNS = ['Tax year', 'Regime', 'Slabs (taxable income → rate)', 'Notification', ''] as const
export const TAX_WIDTHS = ['14%', '10%', '42%', '26%', '8%'] as const
export const OPENING_COLUMNS = ['Employee', 'Covers up to', 'Taxable income', 'Tax deducted', 'Note', ''] as const
export const OPENING_WIDTHS = ['26%', '14%', '15%', '15%', '22%', '8%'] as const
export const OPENING_NOTE = 'What an employee earned and had deducted as income tax earlier in the tax year outside this system - in greytHR before the go-live, or with a previous employer (Form 122). The monthly TDS spreads the rest of the year\'s tax over the months left.'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
export const GENDER = { MALE: 'Men', FEMALE: 'Women', TRANSGENDER: 'Transgender' } as const
export const REGIME = { NEW: 'New', OLD: 'Old' } as const
// 2026-27 for the tax year from 1 April 2026
export const taxYearLabel = (from: Date) => `${from.getUTCFullYear()}-${String((from.getUTCFullYear() + 1) % 100).padStart(2, '0')}`
export const amountText = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value)
