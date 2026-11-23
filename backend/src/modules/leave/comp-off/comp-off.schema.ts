import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Comp-off claims (the user, 2026-11-22): the employee worked on a weekly off / holiday and claims comp-off for it.

export const claimCompOffInput = z.object({
  workDate: z.date(),
  reason: z.string().trim().min(3, 'Say what the work was').max(500),
})

export const compOffIdInput = z.object({ id: idSchema })
