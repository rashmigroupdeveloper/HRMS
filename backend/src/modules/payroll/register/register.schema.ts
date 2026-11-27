import { z } from 'zod'

// Payroll stage 6 (approved by the user 2026-11-27): a run's salary register

export const registerInput = z.object({ runId: z.number().int().positive() }).strict()

export type RegisterInput = z.infer<typeof registerInput>
