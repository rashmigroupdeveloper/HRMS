import { z } from 'zod'
import { DAY_MS } from '#shared/utils/time'

const calendarDate = z.date().refine(d => d.getTime() === Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) && d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2100, 'Use a calendar date between 1900 and 2100')
const ids = z.array(z.number().int().positive()).max(100).optional()
export const movementFilter = z.object({
  from: calendarDate, to: calendarDate,
  kind: z.enum(['ALL', 'JOINER', 'LEAVER']).default('ALL'),
  search: z.string().trim().max(100).optional(),
  companyIds: ids, plantIds: ids, departmentIds: ids,
}).refine(v => v.to >= v.from && v.to.getTime() - v.from.getTime() < 366 * DAY_MS, { path: ['to'], message: 'Choose an ordered range of at most 366 calendar days' })
export const movementInput = movementFilter.safeExtend({ page: z.number().int().min(1).max(20_000).default(1), pageSize: z.number().int().min(1).max(100).default(25) })
