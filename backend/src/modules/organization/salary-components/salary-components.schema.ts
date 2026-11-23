import { SalaryComponentKind } from '#core/db/prisma'
import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Order of the line in the salary breakup (lower first)
const displayOrderSchema = z.number().int().min(0).max(999)

export const createSalaryComponentInput = z.object({
  name: nameSchema,
  kind: z.enum(SalaryComponentKind),
  displayOrder: displayOrderSchema,
})

export const updateSalaryComponentInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  kind: z.enum(SalaryComponentKind).optional(),
  displayOrder: displayOrderSchema.optional(),
  isActive: z.boolean().optional(),
})
