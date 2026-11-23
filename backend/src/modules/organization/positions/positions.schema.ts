import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const createPositionInput = z.object({ name: nameSchema })

export const updatePositionInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  isActive: z.boolean().optional(),
})
