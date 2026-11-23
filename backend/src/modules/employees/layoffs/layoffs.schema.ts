import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { employeeCodeSchema } from '../employees.schema.js'

export const listLayoffsInput = z.object({ employeeCode: employeeCodeSchema })

const reasonSchema = z.string().trim().min(1, 'Give the reason').max(500)

// A lay off: from a day until the day they are back at work (empty = still laid off) - the date rules are in the service
export const createLayoffInput = z.object({
  employeeCode: employeeCodeSchema,
  startDate: z.date(),
  rejoinDate: z.date().optional(),
  reason: reasonSchema,
})

// Only the fields sent change; a null rejoin date opens the lay off again
export const updateLayoffInput = z.object({
  id: idSchema,
  startDate: z.date().optional(),
  rejoinDate: z.date().nullable().optional(),
  reason: reasonSchema.optional(),
})

export const layoffIdInput = z.object({ id: idSchema })
