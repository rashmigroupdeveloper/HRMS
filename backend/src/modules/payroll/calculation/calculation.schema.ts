import { z } from 'zod'

const id = z.number().int().positive()

// The screen sends back the time it showed the pay was last worked out (null = never), so a stale screen cannot work it
// out over a newer result
export const computeInput = z.object({ runId: id, expectedComputedAt: z.date().nullable() }).strict()

export type ComputeInput = z.infer<typeof computeInput>
