import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// The holiday calendar (2026-11-16): for every company, one company, and optionally one work location.

export const listHolidaysInput = z.object({ year: z.number().int().min(2020).max(2100) })

export const createHolidayInput = z.object({
  date: z.date(),
  name: nameSchema,
  // empty = every company
  companyId: idSchema.nullish(),
  // empty = every work location
  workLocationId: idSchema.nullish(),
})

export const updateHolidayInput = createHolidayInput.partial().extend({ id: idSchema })

export const holidayIdInput = z.object({ id: idSchema })
