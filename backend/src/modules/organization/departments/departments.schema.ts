import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Short code as used in SAP / VBMS, e.g. ELEC.MAINT (kept as typed, unique)
const departmentCodeSchema = z.string().trim().min(1, 'Code is required').max(50)

// `plantId`: only the departments that run at that plant
export const listDepartmentsInput = z
  .object({ includeInactive: z.boolean().optional(), plantId: idSchema.optional() })
  .optional()

export const createDepartmentInput =z.object({ code: departmentCodeSchema, name: nameSchema })

export const updateDepartmentInput = z.object({
  id: idSchema,
  code: departmentCodeSchema.optional(),
  name: nameSchema.optional(),
  isActive: z.boolean().optional(),
})
