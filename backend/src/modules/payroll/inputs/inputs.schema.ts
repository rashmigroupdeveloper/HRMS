import { z } from 'zod'
import { hasPaiseOnly } from '#shared/utils/money'

const id = z.number().int().positive()

// An input's amount: more than 0, at most 1 crore, to the paisa
const amount = z.number().gt(0, 'The amount must be more than 0').max(10_000_000).refine(hasPaiseOnly, { message: 'An amount has at most 2 decimals' })
// Why it is entered - shown on the run and kept in the change history
const note = z.string().trim().min(2, 'Say why (at least 2 characters)').max(500)

export const inputsListInput = z
  .object({
    runId: id,
    // only one person's inputs
    personId: id.optional(),
    salaryComponentId: id.optional(),
    // employee code or name, any part
    search: z.string().trim().max(100).optional(),
    page: z.number().int().min(1).max(100000).default(1),
    pageSize: z.number().int().min(1).max(200).default(50),
  })
  .strict()

export const createInputInput = z.object({ runId: id, personId: id, salaryComponentId: id, amount, note }).strict()

export const updateInputInput = z.object({ runId: id, id, salaryComponentId: id.optional(), amount: amount.optional(), note: note.optional() }).strict()

export const deleteInputInput = z.object({ runId: id, id }).strict()

export type InputsListInput = z.infer<typeof inputsListInput>
