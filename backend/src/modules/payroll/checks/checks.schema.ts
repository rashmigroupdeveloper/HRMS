import { z } from 'zod'
import { PayWarning } from '#core/db/prisma'

// Payroll stage 5 (approved 2026-11-27): the warnings of a run and their acknowledgements

const id = z.number().int().positive()

export const checksListInput = z.object({ runId: id }).strict()

// Acknowledges warnings - several at once, with one comment (e.g. every "No PAN" of the month)
export const acknowledgeInput = z
  .object({
    runId: id,
    items: z.array(z.object({ personId: id, warning: z.enum(PayWarning) }).strict()).min(1).max(5000),
    comment: z.string().trim().min(3, 'Say why it is fine, or what was done (at least 3 characters)').max(500),
  })
  .strict()

export type AcknowledgeInput = z.infer<typeof acknowledgeInput>
