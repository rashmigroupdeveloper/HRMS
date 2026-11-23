import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const createRegionInput = z.object({ name: nameSchema })

export const updateRegionInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  isActive: z.boolean().optional(),
})
