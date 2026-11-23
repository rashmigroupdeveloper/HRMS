import { LeaveStatus } from '#core/db/prisma'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { peopleFilterSchema } from '../leave.schema.js'

// Leave applications (2026-11-22): asking for leave, seeing what it takes first, withdrawing / cancelling, the lists.

const leaveDays = z.object({
  leaveTypeId: idSchema,
  fromDate: z.date(),
  toDate: z.date(),
  // the first day from its second half only / the last day to its first half only (old HRMS from_half / to_half)
  fromSecondHalf: z.boolean().default(false),
  toFirstHalf: z.boolean().default(false),
})
const daysRules = <T extends z.ZodType<z.infer<typeof leaveDays>>>(schema: T) =>
  schema
    .refine((v) => v.toDate >= v.fromDate, { message: 'The last day is before the first', path: ['toDate'] })
    .refine((v) => !(v.fromDate.getTime() === v.toDate.getTime() && v.fromSecondHalf && v.toFirstHalf), { message: 'One day cannot be both its first and second half only', path: ['toFirstHalf'] })

// What the leave would take (the days, the balance after) - before applying
export const previewInput = daysRules(leaveDays)

export const applyInput = daysRules(leaveDays.extend({ reason: z.string().trim().min(3, 'Give the reason').max(500) }))

// a leave still waiting is withdrawn at once; an approved one goes for approval to be cancelled - the reason is needed then
export const cancelInput = z.object({ id: idSchema, reason: z.string().trim().max(500).optional() })

// The leave of a team / department / everyone over a span (overlapping it), optionally only some statuses
export const listInput = peopleFilterSchema.extend({
  from: z.date(),
  to: z.date(),
  statuses: z.array(z.enum(LeaveStatus)).max(4).optional(),
})

// Approved leave over a span whose days the calendar now counts otherwise (a holiday added / removed, a weekly off changed
// - the user, 2026-11-23); at most a year
export const recountsInput = z
  .object({ from: z.date(), to: z.date() })
  .refine((v) => v.to >= v.from, { message: 'The last day is before the first', path: ['to'] })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 366 * 86_400_000, { message: 'At most a year at a time', path: ['to'] })

// HR puts one approved leave right: counted again by today's calendar
export const recountInput = z.object({ id: idSchema })

// The leave behind an approval request (the Approvals page's side panel)
export const forApprovalInput = z.object({ approvalRequestId: idSchema })
