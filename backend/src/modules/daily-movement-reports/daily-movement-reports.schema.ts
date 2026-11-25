import { z } from 'zod'

export const saveSetting = z.object({
  hrHeadRoleId: z.number().int().positive(),
  sendAtMinutes: z.number().int().min(0).max(1439),
  coverage: z.enum(['TODAY', 'PREVIOUS_DAY']),
  sendEmpty: z.boolean(),
  expectedUpdatedAt: z.date().nullable(),
}).strict()

export type SaveSetting = z.infer<typeof saveSetting>
