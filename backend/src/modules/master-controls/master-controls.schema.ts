import { z } from 'zod'

export const runsInput = z.object({
  hours: z.union([z.literal(24), z.literal(168)]).default(24),
  status: z.enum(['ALL', 'RUNNING', 'OK', 'FAILED']).default('ALL'),
  search: z.string().trim().max(100).default(''),
  page: z.number().int().min(1).max(10000).default(1),
}).strict()
export type RunsInput = z.infer<typeof runsInput>
