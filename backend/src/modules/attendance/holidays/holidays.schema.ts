import { DayPortion, HolidayMode } from '#core/db/prisma'
import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// The holidays (2026-11-24 - each in the holiday lists that have it, with a category and the part of the day off).

const year = z.number().int().min(2020).max(2100)

// a year's holidays - optionally only one list's
export const listHolidaysInput = z.object({ year, holidayListId: idSchema.optional() })

export const createHolidayInput = z.object({
  date: z.date(),
  name: nameSchema,
  categoryId: idSchema,
  // the part of the day off (default the whole day); the other half is worked
  portion: z.enum(DayPortion).optional(),
  // the lists that have it (at least one)
  holidayListIds: z.array(idSchema).min(1).max(200),
  // how it is given (default AUTOMATIC - everyone on the lists is off); ON_APPLICATION: taken from `leaveTypeId`'s balance,
  // whole day (`portion` FULL_DAY), as a half day too when `allowHalfDay` (2026-11-24)
  mode: z.enum(HolidayMode).optional(),
  allowHalfDay: z.boolean().optional(),
  leaveTypeId: idSchema.nullish(),
})

export const updateHolidayInput = createHolidayInput.partial().extend({ id: idSchema })

export const holidayIdInput = z.object({ id: idSchema })

// one's own holidays of a year (2026-11-24 - "My holidays")
export const myHolidaysInput = z.object({ year })

// copies the year before's holidays into `year` (same day and month, the same lists) - HR then moves those that differ
export const copyYearInput = z.object({ year })
