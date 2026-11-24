import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Holiday lists (the user, 2026-11-24): named lists ("Corporate", "RML6 Plant") - each employee follows one.

export const createHolidayListInput = z.object({
  name: nameSchema,
  // empty = every company may use it
  companyId: idSchema.nullish(),
})

export const updateHolidayListInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  companyId: idSchema.nullable().optional(),
  // false = retired - not while it is a plant's default
  isActive: z.boolean().optional(),
})

// A plant's default list: offered when someone joins there, and given by "fill in" to those without a list (null = none)
export const setPlantDefaultInput = z.object({ plantId: idSchema, holidayListId: idSchema.nullable() })

// Employees follow a list from a date (until their next row) - one person or many (2026-11-24)
export const assignHolidayListInput = z.object({
  employeeCodes: z.array(z.string().trim().toUpperCase().min(1)).min(1).max(2000),
  holidayListId: idSchema,
  effectiveFrom: z.date(),
})

// Gives everyone without a list (inside the viewer's data access) their plant's default, from their joining day -
// `dryRun`: only count them
export const fillMissingInput = z.object({ dryRun: z.boolean().optional() })
