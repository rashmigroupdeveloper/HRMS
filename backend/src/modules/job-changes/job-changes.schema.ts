import { EmploymentType, JobChangeKind, JobChangeStatus, WorkforceCategory } from '#core/db/prisma'
import { idSchema } from '#shared/schemas/common.schema'
import { employeesSchemas } from '#modules/employees'
import { z } from 'zod'

const { employeeCodeSchema } = employeesSchemas

// A proposed salary (2026-11-20): the annual fixed CTC, performance pay and the full monthly breakup - each component at
// most once; the lines x 12 must add up to the CTC (checked in the service, as on the offer)
const salarySchema = z.object({
  annualCtc: z.number().int().positive().max(2_000_000_000),
  performancePayAnnual: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code, e.g. INR').optional(),
  lines: z
    .array(z.object({ salaryComponentId: idSchema, monthlyAmount: z.number().int().min(0).max(200_000_000) }))
    .min(1, 'Give the monthly breakup')
    .max(50)
    .refine((lines) => new Set(lines.map((l) => l.salaryComponentId)).size === lines.length, 'Each salary component can appear only once'),
})

// "Request change" (the user, 2026-11-20): what changes from a day on - only the details sent change (null clears an
// optional one); it goes through approval, then applies on its day. The rules are in the service.
export const createJobChangeInput = z.object({
  employeeCode: employeeCodeSchema,
  effectiveFrom: z.date(),
  // JOINING is only the timeline's first entry
  kind: z.enum(JobChangeKind).exclude(['JOINING']),
  reason: z.string().trim().min(1, 'Give the reason').max(500),
  // a company transfer (2026-11-20): the company of the group they move to - with its plant and department
  companyId: idSchema.optional(),
  plantId: idSchema.optional(),
  departmentId: idSchema.optional(),
  workLocationId: idSchema.nullable().optional(),
  designationId: idSchema.nullable().optional(),
  gradeId: idSchema.nullable().optional(),
  positionId: idSchema.nullable().optional(),
  costCenterId: idSchema.nullable().optional(),
  reportingManagerCode: employeeCodeSchema.nullable().optional(),
  functionalManagerCode: employeeCodeSchema.nullable().optional(),
  employmentType: z.enum(EmploymentType).optional(),
  workforceCategory: z.enum(WorkforceCategory).optional(),
  // the new salary: alone (an increment / a correction) or with a job change (a promotion's hike) - Employee · Salary: Edit
  salary: salarySchema.optional(),
})

const filterShape = {
  // one employee's changes (their profile)
  employeeCode: employeeCodeSchema.optional(),
  statuses: z.array(z.enum(JobChangeStatus)).max(5).optional(),
  kinds: z.array(z.enum(JobChangeKind)).max(10).optional(),
  companyIds: z.array(idSchema).max(200).optional(),
  // the day it applies from, between these days
  from: z.date().optional(),
  to: z.date().optional(),
}

export const listJobChangesInput = z
  .object({
    ...filterShape,
    // the Pay & career page (the user, 2026-11-21): ABOUT_ME - the changes asked for the logged-in employee ("Overview");
    // ASKED_BY_ME - the changes they asked for ("Raise a change"). Without it: every change inside their Employees View
    // data access ("Change register").
    mine: z.enum(['ABOUT_ME', 'ASKED_BY_ME']).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(200).default(50),
  })
  .optional()

export const exportJobChangesInput = z.object(filterShape).optional()

// One change: by its id, or by its approval request's (the Approvals page opens it from there)
export const getJobChangeInput = z
  .object({ id: idSchema.optional(), approvalRequestId: idSchema.optional() })
  .refine((input) => (input.id === undefined) !== (input.approvalRequestId === undefined), 'Give the id or the approval request id')

export const cancelJobChangeInput = z.object({ id: idSchema, reason: z.string().trim().min(1).max(500).optional() })
