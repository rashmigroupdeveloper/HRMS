import { z } from 'zod'
import { employeeCodeSchema } from '../attendance.schema.js'

const id = z.number().int().positive()
// why this person's attendance is not tracked
const reason = z.string().trim().min(3, 'Say why their attendance is not tracked').max(300)

// "Attendance not tracked" for one or many employees, from a day - with a last day, or until it is ended
export const createExemptionInput = z
  .object({
    employeeCodes: z.array(employeeCodeSchema).min(1).max(2000),
    fromDate: z.date(),
    // null / left out: until ended
    toDate: z.date().nullable().optional(),
    reason,
  })
  .strict()
  .refine((v) => !v.toDate || v.toDate >= v.fromDate, { message: 'The last day is before the first day', path: ['toDate'] })

// Ends a marker on a day (or lets it run on again with null), and corrects its reason. The first day does not change -
// a marker that started on the wrong day is removed and set again.
export const updateExemptionInput = z.object({ id, toDate: z.date().nullable(), reason: reason.optional() }).strict()

export const deleteExemptionInput = z.object({ id }).strict()

export type CreateExemptionInput = z.infer<typeof createExemptionInput>
export type UpdateExemptionInput = z.infer<typeof updateExemptionInput>
