import { EmploymentType, Gender } from '#core/db/prisma'
import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Leave types (2026-11-22): the kinds of leave and their rules, shared by every company.

// days with up to 2 decimals: 0.75 a month for CL, 0.58 for SL (the old HRMS's values) - rounded to 2 decimals when saved
const daysSchema = (max: number) => z.number().min(0).max(max)

export const leaveTypeInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{0,9}$/, 'Use 1-10 capital letters / digits, e.g. CL'),
    name: nameSchema,
    isPaid: z.boolean(),
    creditPerMonth: daysSchema(31),
    creditAfterMonths: z.number().int().min(0).max(120),
    // null = everything carries forward; 0 = everything lapses
    maxCarryForward: daysSchema(999).nullable(),
    // null = no limit
    maxPerRequest: z.number().min(0.5).max(365).multipleOf(0.5).nullable(),
    allowHalfDay: z.boolean(),
    countsOffDays: z.boolean(),
    // when it may be applied for (the user, 2026-11-24): at least N calendar days ahead (null / left out = no notice); only
    // today or days passed; the first day at most N days back (null / left out = any day of an open attendance month)
    noticeDays: z.number().int().min(0).max(365).nullish(),
    todayOrPastOnly: z.boolean().optional(),
    maxDaysBack: z.number().int().min(0).max(365).nullish(),
    genders: z.array(z.enum(Gender)).max(3),
    employmentTypes: z.array(z.enum(EmploymentType)).max(10),
    // the type comp-off claims are credited to (one type - 2026-11-22)
    isCompOff: z.boolean().optional(),
    // taken only on its holiday dates - on-application holidays (restricted / election - 2026-11-24); its days lapse at the
    // year end
    holidaysOnly: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  // (old HRMS) an unpaid leave has no balance: nothing to credit
  .refine((v) => v.isPaid || v.creditPerMonth === 0, { message: 'Leave without pay has no balance - it cannot be credited', path: ['creditPerMonth'] })
  // a type taken on its holiday dates has a balance, and is not the comp-off one
  .refine((v) => !v.holidaysOnly || (v.isPaid && !v.isCompOff), { message: 'A type taken only on its holiday dates is paid leave, and never the comp-off one', path: ['holidaysOnly'] })
  // a leave for today or days passed needs no notice
  .refine((v) => !v.todayOrPastOnly || !v.noticeDays, { message: 'A leave for today or days already passed cannot need notice', path: ['noticeDays'] })

// `creditsFrom`: the month (any day of it) the changed credit rules credit from - needed when the credit a month, the
// months before it, who the type is for, or "in use" change (the user, 2026-11-23); an earlier month back-dates on purpose
export const updateLeaveTypeInput = leaveTypeInput.and(z.object({ id: idSchema, creditsFrom: z.date().optional() }))

export const listLeaveTypesInput = z.object({ includeInactive: z.boolean().optional() }).optional()
