import { z } from 'zod'

// Work dates overlap the chosen span; raised dates use whole UTC calendar days, inclusive.
export const reportFilter = z.object({
  scope: z.enum(['TEAM', 'DEPARTMENT', 'ALL']).default('TEAM'),
  from: z.date(),
  to: z.date(),
  dateBy: z.enum(['WORK_DATES', 'RAISED']).default('WORK_DATES'),
  kind: z.enum(['LEAVE', 'LEAVE_CANCEL', 'REGULARIZATION', 'ON_DUTY', 'COMP_OFF', 'SHIFT_CHANGE']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'HELD']).optional(),
  search: z.string().trim().max(100).optional(),
})
export const reportInput = reportFilter.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})
