import { DayStatus } from '#core/db/prisma'
import { DAY_MS } from '#shared/utils/time'
import { z } from 'zod'
import { peopleFilterSchema } from '../attendance.schema.js'

const calendarDate = z.date().refine(d => d.getTime() === Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) && d.getUTCFullYear() >= 2020 && d.getUTCFullYear() <= 2100, 'Use a calendar date between 2020 and 2100')
// Reports use explicit calendar dates, independently of the payroll/attendance cycle.
export const reportFilter = peopleFilterSchema.extend({
  from: calendarDate,
  to: calendarDate,
  plantIds: z.array(z.number().int().positive()).max(100).optional(),
  mode: z.enum(['DETAIL', 'EXCEPTIONS']).default('DETAIL'),
  status: z.enum(DayStatus).optional(),
  exception: z.enum(['ANY', 'LATE', 'EARLY', 'ABSENT', 'MISSED_PUNCH']).default('ANY'),
}).refine(v => v.to >= v.from && (v.to.getTime() - v.from.getTime()) / DAY_MS < 366, { message: 'Choose an ordered range of at most 366 calendar days', path: ['to'] })
export const reportInput = reportFilter.safeExtend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})
