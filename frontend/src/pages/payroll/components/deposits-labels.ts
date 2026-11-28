import type { Tone } from '@/components/Pill'

// Statutory deposits (payroll stage 6 slice 3, approved by the user 2026-11-28) - the texts of the deposits pages, shared
// with their skeletons. The scheme, state and reason names follow the backend's (StatutoryScheme, deposits.schema.ts
// DEPOSIT_STATES, DepositGapReason) - change both together.
export const DEPOSITS_TITLE = 'Statutory deposits'
export const DEPOSITS_NOTE =
  'What each approved pay run must deposit to PF, ESIC, professional tax and LWF - worked out from the run - and the returns and challans recorded against it. Income tax (TDS) challans come later.'

export const SCHEME = { PF: 'PF', ESIC: 'ESIC', PROFESSIONAL_TAX: 'Professional tax', LWF: 'LWF' } as const
export type Scheme = keyof typeof SCHEME
export const SCHEMES = Object.keys(SCHEME) as Scheme[]
// what a return / challan's reference is called for each scheme
export const REFERENCE_HINT: Record<Scheme, string> = {
  PF: 'The ECR’s TRRN',
  ESIC: 'The challan number',
  PROFESSIONAL_TAX: 'The challan / GRN number',
  LWF: 'The challan / GRN number',
}

export type DepositStateKey = 'NOT_DEPOSITED' | 'FILED_NOT_PAID' | 'SHORT' | 'MORE_THAN_DUE' | 'PEOPLE_LEFT_OUT' | 'DEPOSITED'
export const DEPOSIT_STATE: Record<DepositStateKey, readonly [string, Tone]> = {
  NOT_DEPOSITED: ['Not deposited', 'neutral'],
  FILED_NOT_PAID: ['Filed, not paid', 'gold'],
  SHORT: ['Short', 'negative'],
  MORE_THAN_DUE: ['More than due', 'warning'],
  PEOPLE_LEFT_OUT: ['People left out', 'warning'],
  DEPOSITED: ['Deposited', 'positive'],
}

// the tiles of the list, in this order
export const LIST_TILES = ['Open', 'Overdue', 'Due soon', 'Filed, not paid', 'People left out'] as const
export const SHOW = { OPEN: 'Still open', ALL: 'Every month' } as const
export const LIST_COLUMNS = ['Month', 'Scheme', 'Due', 'Deposited', 'Due on', 'Where it stands'] as const
export const LIST_WIDTHS = ['13%', '21%', '13%', '13%', '14%', '26%'] as const

// the month page
export const MONTH_TILE_LABELS = ['Due', 'Deposited', 'Filed, not paid', 'Left out', 'Due on'] as const
export const DEPOSIT_COLUMNS = ['Return / challan', 'Filed', 'Contributions', 'Other charges', 'Paid', ''] as const
export const DEPOSIT_WIDTHS = ['22%', '13%', '15%', '13%', '22%', '15%'] as const
export const PEOPLE_COLUMNS = ['', 'Employee', 'UAN / ESIC number', 'Wages', 'Employee share', 'Employer share', 'Left out of the return'] as const
export const PEOPLE_WIDTHS = ['4%', '22%', '15%', '11%', '11%', '11%', '26%'] as const
export const PEOPLE_SHOW = { ALL: 'Everyone', LEFT_OUT: 'Left out', NO_NUMBER: 'No number yet' } as const
export const CHARGES_NOTE = 'Admin charges, interest, damages or a late fee on the same challan - the company’s own cost, never the employee’s.'

// why a person is left out of a PF / ESIC return
export const GAP_REASON = {
  NO_UAN: 'No UAN yet',
  NO_ESIC_NUMBER: 'No ESIC number yet',
  DETAILS_MISMATCH: 'Details do not match the scheme’s record',
  PREVIOUS_EMPLOYER: 'UAN still with the last employer',
  OTHER: 'Other',
} as const
export type GapReason = keyof typeof GAP_REASON
export const GAP_REASONS_OF: Record<'PF' | 'ESIC', GapReason[]> = { PF: ['NO_UAN', 'DETAILS_MISMATCH', 'PREVIOUS_EMPLOYER', 'OTHER'], ESIC: ['NO_ESIC_NUMBER', 'DETAILS_MISMATCH', 'OTHER'] }

// the pieces of each scheme's due amount, by statutory role (backend StatutoryRole), in this order
export const ROLE_LABEL = {
  PF_EMPLOYEE: 'Employees’ share',
  PF_EMPLOYER: 'Employer’s EPF',
  EPS: 'Pension (EPS)',
  EDLI: 'EDLI',
  ESIC_EMPLOYEE: 'Employees’ share',
  ESIC_EMPLOYER: 'Employer’s share',
  PROFESSIONAL_TAX: 'Professional tax',
  LWF_EMPLOYEE: 'Employees’ share',
  LWF_EMPLOYER: 'Employer’s share',
} as const
export type Role = keyof typeof ROLE_LABEL
export const ROLES_OF: Record<Scheme, Role[]> = {
  PF: ['PF_EMPLOYEE', 'PF_EMPLOYER', 'EPS', 'EDLI'],
  ESIC: ['ESIC_EMPLOYEE', 'ESIC_EMPLOYER'],
  PROFESSIONAL_TAX: ['PROFESSIONAL_TAX'],
  LWF: ['LWF_EMPLOYEE', 'LWF_EMPLOYER'],
}

export const schemeName = (scheme: Scheme, stateCode: string | null) => `${SCHEME[scheme]}${stateCode ? ` · ${stateCode}` : ''}`
// the month page's address: /manage/statutory-deposits/<company id>/<yyyy-mm>
export const monthPath = (companyId: number, payMonth: Date) => `/manage/statutory-deposits/${companyId}/${payMonth.toISOString().slice(0, 7)}`
export const MONTH_LABEL = (date: Date) => new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
export const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
