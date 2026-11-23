import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const listCostCentersInput = z
  .object({ companyId: idSchema.optional(), includeInactive: z.boolean().optional() })
  .optional()

// SAP cost centre code, e.g. 1701 - upper-cased
const costCenterCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{1,20}$/, 'Use up to 20 letters, digits, _ or -')

export const createCostCenterInput = z.object({
  companyId: idSchema,
  code: costCenterCodeSchema,
  name: nameSchema,
  // a plant of the same company (checked in the service)
  plantId: idSchema.optional(),
})

// The company of a cost centre never changes; `plantId: null` removes the plant
export const updateCostCenterInput = z.object({
  id: idSchema,
  code: costCenterCodeSchema.optional(),
  name: nameSchema.optional(),
  plantId: idSchema.nullable().optional(),
  isActive: z.boolean().optional(),
})
