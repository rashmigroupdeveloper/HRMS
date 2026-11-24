import { z } from 'zod'
import { idSchema } from '#shared/schemas/common.schema'

export const exportOrganizationInput = z.object({
  section: z.enum(['companies', 'plants', 'costCenters', 'workLocations', 'departments', 'designations', 'regions', 'positions', 'grades', 'salaryComponents']),
  ids: z.array(idSchema).max(20_000),
  selection: z.string().max(300).optional(),
})
