import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Regularization / on-duty requests (2026-11-22, the old HRMS's AR and OD): an employee asks for days with a missed punch
// to count as present, or to be marked on official duty; approved through the approval service.

export const createRegularizationInput = z
  .object({
    kind: z.enum(['MISSED_PUNCH', 'ON_DUTY']),
    fromDate: z.date(),
    toDate: z.date(),
    // a half only for one day
    portion: z.enum(['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF']),
    reason: z.string().trim().min(5, 'Give the reason (at least 5 letters)').max(500),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'The last day is before the first', path: ['toDate'] })
  .refine((v) => v.portion === 'FULL_DAY' || v.fromDate.getTime() === v.toDate.getTime(), { message: 'A half day is for one day only', path: ['portion'] })

export const regularizationIdInput = z.object({ id: idSchema })
