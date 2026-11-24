import { EmploymentType, JoiningType, SalaryCalcMethod, WorkforceCategory } from '#core/db/prisma'
import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { hasPaiseOnly } from '#shared/utils/money'
import { z } from 'zod'

// A salary structure: how an offer's breakup is worked out from its CTC for one type of employee (2026-11-24)

const amountSchema = z.number().min(0).max(100_000_000)

const lineInput = z.object({
  salaryComponentId: idSchema,
  method: z.enum(SalaryCalcMethod),
  // a percentage (50, 8.33) or a monthly amount (1250, up to 2 decimals); none for BALANCE
  value: amountSchema.refine(hasPaiseOnly, { message: 'A value has at most 2 decimals' }).nullable().optional(),
  // the percentage applies to at least this amount (e.g. bonus: 8.33% of Basic, of no less than 7,000)
  minimumBase: amountSchema.int().nullable().optional(),
  // only when the Monthly Gross is at most this (e.g. ESIC: 21,000)
  onlyIfGrossAtMost: amountSchema.int().nullable().optional(),
})

// which offers it is for: each empty = any
const matchFields = {
  joiningType: z.enum(JoiningType).nullable().optional(),
  employmentType: z.enum(EmploymentType).nullable().optional(),
  workforceCategory: z.enum(WorkforceCategory).nullable().optional(),
}

const linesInput = z.array(lineInput).min(1).max(50)

export const createSalaryStructureInput = z.object({
  name: nameSchema,
  ...matchFields,
  // the component "% of Basic" means - required when a line uses PERCENT_OF_BASIC
  basicComponentId: idSchema.nullable().optional(),
  lines: linesInput,
})

// Lines given = the whole new list (replaces the old one)
export const updateSalaryStructureInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  ...matchFields,
  basicComponentId: idSchema.nullable().optional(),
  lines: linesInput.optional(),
  isActive: z.boolean().optional(),
})

// The breakup for a CTC: by the offer's joining type / employment type / category (the structure that matches), or by a
// structure being edited (`draft` - the live example on the Organization page)
export const calculateInput = z
  .object({
    annualCtc: z.number().int().positive().max(2_400_000_000),
    joiningType: z.enum(JoiningType).optional(),
    employmentType: z.enum(EmploymentType).optional(),
    workforceCategory: z.enum(WorkforceCategory).optional(),
    draft: z.object({ basicComponentId: idSchema.nullable().optional(), lines: linesInput }).optional(),
  })
  .refine((v) => v.draft || (v.joiningType && v.employmentType && v.workforceCategory), {
    message: 'Give the joining type, employment type and category - or a draft structure',
  })

export type StructureLineInput = z.infer<typeof lineInput>
