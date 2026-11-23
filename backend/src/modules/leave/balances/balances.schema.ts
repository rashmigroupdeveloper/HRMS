import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { employeeCodeSchema, peopleFilterSchema, yearSchema } from '../leave.schema.js'

// Leave balances (2026-11-22): one employee's balances and their rows, the register of everyone's, HR's adjustments.

// (empty employeeCode = one's own; empty year = this year)
export const balancesInput = z.object({ employeeCode: employeeCodeSchema.optional(), year: yearSchema.optional() }).optional()

export const registerInput = peopleFilterSchema.extend({ year: yearSchema.optional() })

export const adjustInput = z.object({
  employeeCode: employeeCodeSchema,
  leaveTypeId: idSchema,
  // + gives days, - takes them away (up to 2 decimals)
  days: z
    .number()
    .min(-365)
    .max(365)
    .refine((d) => d !== 0, 'Give the days to add (+) or take away (-)'),
  note: z.string().trim().min(5, 'Say why (at least 5 letters)').max(500),
})

// The opening balances import (2026-11-22, old HRMS "leave-balances" importer): an Excel of employee code, leave type code
// and the balance to set; `save` false = only check every row
export const MAX_IMPORT_ROWS = 20_000
export const importBalancesInput = z.object({
  file: z.file().min(1, 'The file is empty').max(5 * 1024 * 1024, 'The file must be 5 MB or smaller'),
  save: z.boolean().default(false),
})
