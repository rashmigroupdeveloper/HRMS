import { countryCodeSchema, idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const listPlantsInput = z
  .object({ companyId: idSchema.optional(), includeInactive: z.boolean().optional() })
  .optional()

// SAP plant code, e.g. 1700 - upper-cased
const plantCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{2,20}$/, 'Use 2-20 letters, digits, _ or -')

// Where the plant is (as in SAP / VBMS)
const addressFields = {
  address: z.string().trim().min(1).max(500).optional(),
  postalCode: z.string().trim().min(3).max(12).optional(),
  // default IN
  countryCode: countryCodeSchema.optional(),
  // state / region name, e.g. West Bengal, Dubai
  region: z.string().trim().min(1).max(100).optional(),
}

export const createPlantInput = z.object({
  companyId: idSchema,
  plantCode: plantCodeSchema,
  name: nameSchema,
  ...addressFields,
})

// The departments that run at a plant - the whole list (departments left out are removed from the plant)
export const setPlantDepartmentsInput = z.object({
  id: idSchema,
  departmentIds: z.array(idSchema).max(500),
})

// The company of a plant never changes; `null` clears an address field
export const updatePlantInput = z.object({
  id: idSchema,
  plantCode: plantCodeSchema.optional(),
  name: nameSchema.optional(),
  address: addressFields.address.unwrap().nullable().optional(),
  postalCode: addressFields.postalCode.unwrap().nullable().optional(),
  countryCode: countryCodeSchema.optional(),
  region: addressFields.region.unwrap().nullable().optional(),
  isActive: z.boolean().optional(),
})
