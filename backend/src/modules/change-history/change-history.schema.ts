import { AuditAction } from '#core/db/prisma'
import { employeesSchemas } from '#modules/employees'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// The change history: newest first, filtered, one page at a time.
export const listChangeHistoryInput = z
  .object({
    // calendar days, both included
    from: z.date().optional(),
    to: z.date().optional(),
    // who made the changes (an employee code)
    actorCode: employeesSchemas.employeeCodeSchema.optional(),
    // whose records: an employee (the profile's history) or a candidate
    employeeCode: employeesSchemas.employeeCodeSchema.optional(),
    candidateId: idSchema.optional(),
    // the kind of record, e.g. "Employee" (as listed in `models` of the answer)
    model: z.string().trim().max(60).optional(),
    action: z.enum(AuditAction).optional(),
    // 1 = first page
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  })
  .optional()

// The same filters, for the Excel download (every matching entry, newest first, up to 20,000)
export const exportChangeHistoryInput = listChangeHistoryInput.unwrap().omit({ page: true, pageSize: true }).optional()
