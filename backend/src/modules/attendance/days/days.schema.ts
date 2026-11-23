import { DayStatus } from '#core/db/prisma'
import { z } from 'zod'
import { employeeCodeSchema, monthSchema, peopleFilterSchema } from '../attendance.schema.js'

// The days' results: one's own month, someone's month, the day's board, the monthly muster, HR's corrections.

export const myMonthInput = monthSchema

export const employeeMonthInput = monthSchema.extend({ employeeCode: employeeCodeSchema })

export const boardInput = peopleFilterSchema.extend({ date: z.date() })

export const musterInput = peopleFilterSchema.extend(monthSchema.shape)

// A half's status - never "half day" (that is the day overall), never "leave" (2026-11-22: leave is taken only by an
// approved application, which debits the balance - HR's correction would not)
const halfStatusSchema = z.enum(DayStatus).exclude(['HALF_DAY', 'LEAVE'])

// HR sets one half or both with a reason (a correction wins over what the punches give; an empty half keeps following
// them - 2026-11-22, was one status for the day)
export const correctDayInput = z
  .object({
    employeeCode: employeeCodeSchema,
    date: z.date(),
    // a half: a status, null = back to the punches (its correction removed - 2026-11-23), left out = kept as it is
    firstHalf: halfStatusSchema.nullable().optional(),
    secondHalf: halfStatusSchema.nullable().optional(),
    reason: z.string().trim().min(3, 'Give the reason').max(500),
  })
  .refine((v) => v.firstHalf !== undefined || v.secondHalf !== undefined, { message: 'Set the first half, the second half or both', path: ['firstHalf'] })

export const removeCorrectionInput = z.object({ employeeCode: employeeCodeSchema, date: z.date() })

// The punches of one employee on one day (the day's details)
export const dayPunchesInput = z.object({ employeeCode: employeeCodeSchema, date: z.date() })
