import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Short grade code, e.g. M1 - upper-cased
const gradeCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{1,20}$/, 'Use up to 20 letters, digits, _ or -')

// Seniority order: lower = more senior (as the old HRMS)
const rankSchema = z.number().int().min(0).max(999)

export const createGradeInput = z.object({ code: gradeCodeSchema, name: nameSchema, rank: rankSchema })

export const updateGradeInput = z.object({
  id: idSchema,
  code: gradeCodeSchema.optional(),
  name: nameSchema.optional(),
  rank: rankSchema.optional(),
  isActive: z.boolean().optional(),
})
