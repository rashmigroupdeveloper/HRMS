import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const createDesignationInput = z.object({ name: nameSchema })

export const updateDesignationInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  isActive: z.boolean().optional(),
})
