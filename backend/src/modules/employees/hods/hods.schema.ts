import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { employeeCodeSchema } from '../employees.schema.js'

// HOD appointments (BACKLOG 3e - an HOD post is a plant-department: one company + one of its plants + one department
// running there, changed with the user 2026-11-19). An appointment starts and ends at a moment (2026-11-19).

// A moment in India time - for every plant (the user, 2026-11-19): a calendar day and, when given, the minutes after
// midnight.
export const clockSchema = z.object({ day: z.date(), minute: z.number().int().min(0).max(1439).optional() })

// Appoints the employee to these posts from `from` (omitted = now; a past moment too - backdating - or a later one: an
// upcoming appointment), replacing whoever heads each then (their appointment ends at that moment). `endPostIds`: posts
// the employee stops heading at the same moment.
export const appointHodInput = z
  .object({
    employeeCode: employeeCodeSchema,
    // the start of `day`, or `minute` of it
    from: clockSchema.optional(),
    postIds: z.array(idSchema).max(2000),
    endPostIds: z.array(idSchema).max(2000).optional(),
  })
  .refine((v) => v.postIds.length + (v.endPostIds?.length ?? 0) > 0, { message: 'Tick at least one place' })

// Ends the employee's appointments on these posts (the one going on, or the upcoming one - which is then cancelled when it
// ends before it starts). `lastDay`: their last day as HOD - to its end, or until `minute` of it;
// omitted = now; null = no end (takes back a planned end).
export const endHodInput = z.object({
  employeeCode: employeeCodeSchema,
  postIds: z.array(idSchema).min(1, 'Tick at least one place').max(2000),
  lastDay: clockSchema.nullable().optional(),
})

// One post's history - or the posts one employee headed
export const hodHistoryInput = z.union([z.object({ postId: idSchema }), z.object({ employeeCode: employeeCodeSchema })])

export const exportHodsInput = z.object({
  view: z.enum(['department', 'heads']),
  postId: idSchema.optional(),
  search: z.string().trim().max(200).optional(),
  onlyGaps: z.boolean().optional(),
})
