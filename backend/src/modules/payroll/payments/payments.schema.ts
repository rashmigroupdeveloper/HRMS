import { z } from 'zod'
import { PaymentBatchStatus, PaymentMethod } from '#core/db/prisma'

// Payroll stage 6 slice 2 (approved by the user 2026-11-28): paying approved runs

const id = z.number().int().positive()
const page = z.number().int().min(1).max(100000).default(1)
const pageSize = z.number().int().min(1).max(200).default(50)
const reason = z.string().trim().min(3, 'Give the reason (at least 3 characters)').max(300)

// Where an unpaid person stands: to pay, no salary account, held, in a batch, returned by the bank
export const OWED_STATES = ['TO_PAY', 'NO_ACCOUNT', 'HELD', 'IN_BATCH', 'RETURNED'] as const
export type OwedState = (typeof OWED_STATES)[number]

// Everything owed: the approved runs' people not paid yet - of one company / one run, one state, a search
export const owedInput = z
  .object({ companyId: id.optional(), runId: id.optional(), state: z.enum(OWED_STATES).optional(), search: z.string().trim().max(100).optional(), page, pageSize })
  .strict()

export const batchesInput = z.object({ companyId: id.optional(), status: z.enum(PaymentBatchStatus).optional(), page, pageSize }).strict()

export const batchInput = z.object({ id }).strict()

// A new batch of these people (their ids in their runs) of one company
export const createBatchInput = z
  .object({ companyId: id, method: z.enum(PaymentMethod), personIds: z.array(id).min(1).max(5000), note: z.string().trim().max(500).optional() })
  .strict()

export const paymentInput = z.object({ paymentId: id }).strict()

// Paid on a day with the bank's reference: these payments of the batch, or every one still in it; a cheque: one payment
// with its cheque number
export const markPaidInput = z
  .object({
    batchId: id,
    paidOn: z.date(),
    reference: z.string().trim().min(1).max(100).optional(),
    paymentIds: z.array(id).min(1).max(5000).optional(),
    chequeNumber: z.string().trim().min(1).max(30).optional(),
  })
  .strict()

export const markReturnedInput = z.object({ paymentId: id, reason }).strict()

export const holdInput = z.object({ personId: id, reason }).strict()

export const releaseHoldInput = z.object({ personId: id, note: z.string().trim().max(300).optional() }).strict()

export type OwedInput = z.infer<typeof owedInput>
export type BatchesInput = z.infer<typeof batchesInput>
export type CreateBatchInput = z.infer<typeof createBatchInput>
export type MarkPaidInput = z.infer<typeof markPaidInput>
export type MarkReturnedInput = z.infer<typeof markReturnedInput>
export type HoldInput = z.infer<typeof holdInput>
export type ReleaseHoldInput = z.infer<typeof releaseHoldInput>
