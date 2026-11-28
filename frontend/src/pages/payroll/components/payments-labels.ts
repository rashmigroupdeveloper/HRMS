import type { Tone } from '@/components/Pill'

// Salary payments (payroll stage 6 slice 2, approved by the user 2026-11-28) - the texts of the payments pages. The state
// and status names follow the backend's (payments.schema.ts OWED_STATES, PaymentStatus, PaymentBatchStatus) - change both
// together.
export const PAYMENTS_TITLE = 'Salary payments'
export const PAYMENTS_NOTE = 'Pay the approved pay runs: make a batch (bank transfer, cheques or cash), mark it sent, then paid with the bank’s reference - or returned. Whatever is not paid yet is owed.'
export const PAYMENT_TABS = [
  { value: 'owed', label: 'To pay & owed' },
  { value: 'batches', label: 'Batches' },
] as const

export type OwedStateKey = 'TO_PAY' | 'NO_ACCOUNT' | 'RETURNED' | 'HELD' | 'IN_BATCH'
// the tiles of the owed list, in this order: label and pill tone
export const OWED_STATE: Record<OwedStateKey, readonly [string, Tone]> = {
  TO_PAY: ['To pay', 'neutral'],
  NO_ACCOUNT: ['No salary account', 'warning'],
  RETURNED: ['Returned', 'negative'],
  HELD: ['Held', 'warning'],
  IN_BATCH: ['In a batch', 'info'],
}
export const OWED_STATES = Object.keys(OWED_STATE) as OwedStateKey[]
export const OWED_TOTAL_LABEL = 'Owed in all'
export const OWED_COLUMNS = ['', 'Employee', 'Month', 'Amount', 'Where it stands', 'Salary account', 'Overdue', ''] as const
export const OWED_WIDTHS = ['4%', '20%', '11%', '11%', '22%', '14%', '9%', '9%'] as const

export const METHOD = { BANK: 'Bank transfer', CHEQUE: 'Cheques', CASH: 'Cash' } as const
export type Method = keyof typeof METHOD
export const BATCH_STATUS = { OPEN: ['Being made up', 'gold'], SENT: ['Sent', 'info'], CLOSED: ['Closed', 'neutral'] } as const satisfies Record<string, readonly [string, Tone]>
export const PAYMENT_STATUS = { IN_BATCH: ['Waiting', 'info'], PAID: ['Paid', 'positive'], RETURNED: ['Returned', 'negative'], REMOVED: ['Taken out', 'neutral'] } as const satisfies Record<string, readonly [string, Tone]>
export const BATCH_COLUMNS = ['Batch', 'Company', 'Way', 'People', 'Amount', 'Paid', 'Status'] as const
export const BATCH_WIDTHS = ['20%', '18%', '13%', '9%', '14%', '14%', '12%'] as const
export const BATCH_TILE_LABELS = ['People', 'Amount', 'Paid', 'Waiting', 'Returned'] as const
export const BATCH_FACT_LABELS = ['Made up', 'Sent', 'Closed'] as const
export const BATCH_PAYMENT_COLUMNS = ['Employee', 'Month', 'Amount', 'Account / cheque', 'Where it stands', ''] as const
export const BATCH_PAYMENT_WIDTHS = ['20%', '10%', '11%', '19%', '22%', '18%'] as const
export const LIST_NOTE = 'A plain list made by the HRMS (name, full account number, IFSC, amount) - not the bank’s own upload format. Keep it safe.'
export const MONTH_LABEL = (date: Date) => new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
