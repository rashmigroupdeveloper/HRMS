import { SalaryComponentKind } from '#core/db/prisma'
import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Order of the line in the salary breakup (lower first)
const displayOrderSchema = z.number().int().min(0).max(999)

// Short code for Excel headers, statutory files and the register (payroll stage 2): upper case letters, digits and
// underscores, e.g. BASIC, CANTEEN_RECOVERY. null clears it.
const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{0,29}$/, 'Use capital letters, digits and _ (start with a letter, at most 30)')

export const createSalaryComponentInput = z.object({
  name: nameSchema,
  kind: z.enum(SalaryComponentKind),
  displayOrder: displayOrderSchema,
  code: codeSchema.nullable().optional(),
  // typed for a month in payroll (an incentive, a canteen recovery) - never a line of a salary breakup
  enteredMonthly: z.boolean().optional(),
  // an earning of the breakup: cut for a pay run's unpaid days (default) or paid in full for every day in the company
  // (payroll stage 3, approved 2026-11-27) - not used for the other kinds
  cutForUnpaidDays: z.boolean().optional(),
})

export const updateSalaryComponentInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  kind: z.enum(SalaryComponentKind).optional(),
  displayOrder: displayOrderSchema.optional(),
  isActive: z.boolean().optional(),
  code: codeSchema.nullable().optional(),
  enteredMonthly: z.boolean().optional(),
  cutForUnpaidDays: z.boolean().optional(),
})
