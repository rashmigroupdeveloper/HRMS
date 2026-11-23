import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { clockSchema, employeeCodeSchema } from '../attendance.schema.js'

// Shifts, schedule patterns and who follows which (2026-11-16; patterns for everyone - the user, 2026-11-23).

const shiftCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{1,10}$/, 'Use up to 10 letters or digits, e.g. GEN, A, NIGHT')
const minutesSchema = (max: number) => z.number().int().min(0).max(max)

export const createShiftInput = z.object({
  code: shiftCodeSchema,
  name: nameSchema,
  start: clockSchema,
  end: clockSchema,
  breakMinutes: minutesSchema(240),
  // where the first half ends ("13:00"); null / left out: the middle of the shift (2026-11-22)
  halfSplit: clockSchema.nullable().optional(),
})

export const updateShiftInput = z.object({
  id: idSchema,
  code: shiftCodeSchema.optional(),
  name: nameSchema.optional(),
  start: clockSchema.optional(),
  end: clockSchema.optional(),
  breakMinutes: minutesSchema(240).optional(),
  halfSplit: clockSchema.nullable().optional(),
  isActive: z.boolean().optional(),
})

// The schedule of several employees from a date (HR, in bulk): a pattern, the week of it the start date falls in (a
// 7 / 14 / 21-day pattern lines up with Monday-Sunday), and the attendance policy
export const assignShiftInput = z.object({
  employeeCodes: z.array(employeeCodeSchema).min(1).max(2000),
  patternId: idSchema,
  // which week of the pattern the start date's week is (1 = the first)
  startWeek: z.number().int().min(1).max(8).default(1),
  // the attendance policy (null / left out: the default policy - 2026-11-22)
  policyId: idSchema.nullable().optional(),
  effectiveFrom: z.date(),
})

export const employeeAssignmentsInput = z.object({ employeeCode: employeeCodeSchema })

// Who follows which pattern and policy today (2026-11-23): optionally only those matching a name / code, a place (company,
// plant, department, cost centre), a pattern or a policy
export const listSchedulesInput = z
  .object({
    search: z.string().trim().max(100).optional(),
    companyIds: z.array(idSchema).max(100).optional(),
    plantIds: z.array(idSchema).max(200).optional(),
    departmentIds: z.array(idSchema).max(200).optional(),
    costCenterIds: z.array(idSchema).max(200).optional(),
    patternId: idSchema.optional(),
    policyId: idSchema.optional(),
  })
  .optional()

export const createPatternInput = z.object({
  name: nameSchema,
  // a shift id per day of the cycle, 0 = off - usually 7, 14 or 21 days (weeks of Monday-Sunday), up to 8 weeks
  days: z.array(z.number().int().min(0)).min(1).max(56),
  // the days (1 = the first) worked in their first half only (e.g. a half-day Saturday)
  halfDays: z.array(z.number().int().min(1).max(56)).max(56).default([]),
})
export const updatePatternInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  days: createPatternInput.shape.days.optional(),
  halfDays: createPatternInput.shape.halfDays.optional(),
  // makes it the default pattern (the one of employees with no schedule given; the others lose the flag)
  isDefault: z.literal(true).optional(),
  isActive: z.boolean().optional(),
})
