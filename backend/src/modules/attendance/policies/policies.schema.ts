import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Attendance policies (the user, 2026-11-22): the rules a day is judged by - apart from the shift's timing. The rules are
// dated (2026-11-23): a change applies from a date.

const minutes = (max: number) => z.number().int().min(0).max(max)

const rules = {
  graceMinutes: minutes(120),
  // the time from the first in to the last out for a full day; null = the whole shift
  fullDayMinutes: minutes(1440).nullable(),
  halfDayMinutes: minutes(1440),
  // every Nth late day of a month loses its first half; null = no late penalty
  latesPerHalfDayCut: z.number().int().min(1).max(31).nullable(),
  // in later than this after the start = first half absent; out earlier than this before the end = second half absent
  veryLateMinutes: minutes(1440).nullable(),
  veryEarlyMinutes: minutes(1440).nullable(),
}
const RULE_KEYS = Object.keys(rules) as (keyof typeof rules)[]

// a new policy: its rules apply from the start (it matters only once a schedule names it, or it becomes the default)
export const createPolicyInput = z.object({
  name: nameSchema,
  ...rules,
  isDefault: z.boolean().optional(),
})

// a change of the rules needs the date it applies from: the days before it keep the rules they had
export const updatePolicyInput = z
  .object({
    id: idSchema,
    name: nameSchema.optional(),
    graceMinutes: rules.graceMinutes.optional(),
    fullDayMinutes: rules.fullDayMinutes.optional(),
    halfDayMinutes: rules.halfDayMinutes.optional(),
    latesPerHalfDayCut: rules.latesPerHalfDayCut.optional(),
    veryLateMinutes: rules.veryLateMinutes.optional(),
    veryEarlyMinutes: rules.veryEarlyMinutes.optional(),
    effectiveFrom: z.date().optional(),
    isDefault: z.literal(true).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.effectiveFrom !== undefined || RULE_KEYS.every((k) => v[k] === undefined), { message: 'Give the date the new rules apply from', path: ['effectiveFrom'] })
