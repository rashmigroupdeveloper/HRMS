import { CandidateStatus, EmploymentType, JoiningType, MedicalResult, Salutation, WorkforceCategory } from '#core/db/prisma'
import { emailSchema, idSchema, mobileSchema, monthlyAmountSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { REQUESTABLE_DOCUMENTS } from './documents/documents.service.js'

// ISO 4217 currency code, e.g. INR
const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code, e.g. INR')

// Whole currency units per year (fits the Int column)
const annualCtcSchema = z.number().int().positive().max(2_000_000_000)

// Postal address printed on the offer letter
const addressSchema = z.string().trim().min(1).max(300)

// Probation length / notice period in months
const monthsSchema = z.number().int().min(0).max(24)

// The salary breakup (offer letter Annexure-I): one monthly amount per salary component, each component at most
// once. Sent as a whole - it replaces the offer's breakup ([] removes it).
const salaryLinesSchema = z
  .array(z.object({ salaryComponentId: idSchema, monthlyAmount: monthlyAmountSchema }))
  .max(50)
  .refine((lines) => new Set(lines.map((l) => l.salaryComponentId)).size === lines.length, 'Each salary component can appear only once')

export const candidateIdInput = z.object({ id: idSchema })

export const listCandidatesInput = z
  .object({ status: z.enum(CandidateStatus).optional(), companyId: idSchema.optional() })
  .optional()

// Export accepts grouped lifecycle filters used by the board, while retaining the list's company/single-status filters.
export const exportCandidatesInput = listCandidatesInput.unwrap().extend({statuses:z.array(z.enum(CandidateStatus)).max(20).optional()}).optional()

export const createCandidateInput = z.object({
  // person
  salutation: z.enum(Salutation).optional(),
  firstName: nameSchema,
  middleName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  mobile: mobileSchema,
  personalEmail: emailSchema.optional(),
  address: addressSchema.optional(),
  // offer terms
  companyId: idSchema,
  // a plant of the company (company -> plant -> department, 2026-11-18)
  plantId: idSchema,
  workLocationId: idSchema.optional(),
  departmentId: idSchema.optional(),
  designationId: idSchema,
  gradeId: idSchema.optional(),
  joiningType: z.enum(JoiningType),
  employmentType: z.enum(EmploymentType),
  workforceCategory: z.enum(WorkforceCategory),
  annualCtc: annualCtcSchema,
  performancePayAnnual: annualCtcSchema.optional(),
  ctcCurrency: currencySchema.optional(),
  proposedJoiningDate: z.date(),
  contractEndDate: z.date().optional(),
  offerValidUntil: z.date().optional(),
  probationMonths: monthsSchema.optional(),
  noticeMonthsProbation: monthsSchema.optional(),
  noticeMonthsConfirmed: monthsSchema.optional(),
  salaryLines: salaryLinesSchema.optional(),
  // true = the joining form opens when the candidate accepts, its link e-mailed then; false (default) = HR sends the
  // link later (2026-11-20)
  joiningFormOnAcceptance: z.boolean().optional(),
  // documents this offer needs on top of the pack's compulsory ones (2026-11-20); each once
  extraRequiredDocuments: z.array(z.enum(REQUESTABLE_DOCUMENTS)).max(REQUESTABLE_DOCUMENTS.length).optional(),
})

// Only the fields sent are changed; `null` clears an optional field.
export const updateCandidateInput = z.object({
  id: idSchema,
  // person
  salutation: z.enum(Salutation).nullable().optional(),
  firstName: nameSchema.optional(),
  middleName: nameSchema.nullable().optional(),
  lastName: nameSchema.nullable().optional(),
  mobile: mobileSchema.optional(),
  personalEmail: emailSchema.nullable().optional(),
  address: addressSchema.nullable().optional(),
  // offer terms
  companyId: idSchema.optional(),
  plantId: idSchema.optional(),
  workLocationId: idSchema.nullable().optional(),
  departmentId: idSchema.nullable().optional(),
  designationId: idSchema.optional(),
  gradeId: idSchema.nullable().optional(),
  joiningType: z.enum(JoiningType).optional(),
  employmentType: z.enum(EmploymentType).optional(),
  workforceCategory: z.enum(WorkforceCategory).optional(),
  annualCtc: annualCtcSchema.optional(),
  performancePayAnnual: annualCtcSchema.nullable().optional(),
  ctcCurrency: currencySchema.optional(),
  proposedJoiningDate: z.date().optional(),
  contractEndDate: z.date().nullable().optional(),
  offerValidUntil: z.date().nullable().optional(),
  probationMonths: monthsSchema.nullable().optional(),
  noticeMonthsProbation: monthsSchema.nullable().optional(),
  noticeMonthsConfirmed: monthsSchema.nullable().optional(),
  salaryLines: salaryLinesSchema.optional(),
  // not printed on the letter: changing it never sends the offer back to draft; locked once the offer is accepted
  joiningFormOnAcceptance: z.boolean().optional(),
  // not printed on the letter either; changeable until joining (2026-11-20). The whole list (`[]` = none)
  extraRequiredDocuments: z.array(z.enum(REQUESTABLE_DOCUMENTS)).max(REQUESTABLE_DOCUMENTS.length).optional(),
})

// The ways a candidate can leave the process without joining
export const CLOSE_OUTCOMES = ['DECLINED', 'EXPIRED', 'WITHDRAWN', 'BACKED_OUT', 'NO_SHOW'] as const satisfies readonly CandidateStatus[]

export const closeCandidateInput = z.object({
  id: idSchema,
  outcome: z.enum(CLOSE_OUTCOMES),
  // Required for WITHDRAWN (checked in the service)
  reason: z.string().trim().min(1).max(500).optional(),
})

export const recordMedicalInput = z.object({
  id: idSchema,
  result: z.enum(MedicalResult),
  examDate: z.date(),
  examiner: z.string().trim().min(1).max(200),
  // Required for FIT_WITH_RESTRICTIONS (checked in the service); not stored for other results
  restrictions: z.string().trim().min(1).max(500).optional(),
})
