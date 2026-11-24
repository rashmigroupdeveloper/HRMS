import { HolidayTone } from '#core/db/prisma'
import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Holiday categories (the user, 2026-11-24): HR's labels for holidays - National, Festival, Election... - with a colour.

const toneSchema = z.enum(HolidayTone)

export const createHolidayCategoryInput = z.object({ name: nameSchema, tone: toneSchema })

export const updateHolidayCategoryInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  tone: toneSchema.optional(),
  // false = retired: offered no more for new holidays
  isActive: z.boolean().optional(),
})
