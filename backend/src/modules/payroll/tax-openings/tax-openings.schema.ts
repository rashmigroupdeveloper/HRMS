import { z } from 'zod'

// Payroll stage 4 (approved 2026-11-27): what an employee earned and had deducted as income tax earlier in a tax year,
// outside this system (greytHR before the go-live, or a previous employer - Form 122).

const id = z.number().int().positive()
const midnight = (d: Date) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
// 1 April of a tax year
const taxYearFrom = z.date().refine((d) => midnight(d) && d.getUTCMonth() === 3 && d.getUTCDate() === 1 && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100, 'A tax year starts on 1 April')
// a pay month: its first day
const payMonth = z.date().refine((d) => midnight(d) && d.getUTCDate() === 1, 'Choose a month')
const rupees = z.number().int('Whole rupees').min(0).max(1_000_000_000)

export const openingsListInput = z
  .object({
    taxYearFrom,
    companyId: id.optional(),
    // employee code or name, any part
    search: z.string().trim().max(100).optional(),
    page: z.number().int().min(1).max(100000).default(1),
    pageSize: z.number().int().min(1).max(200).default(50),
  })
  .strict()

export const saveOpeningInput = z
  .object({
    // a new row (no id) is for this employee; a changed row keeps its employee and tax year
    id: id.optional(),
    employeeCode: z.string().trim().toUpperCase().min(1).max(30),
    taxYearFrom,
    // the last month the figures cover (they cover the tax year up to and including it)
    throughPayMonth: payMonth,
    taxableIncome: rupees,
    taxDeducted: rupees,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((v) => v.throughPayMonth >= v.taxYearFrom && v.throughPayMonth < new Date(Date.UTC(v.taxYearFrom.getUTCFullYear() + 1, 3, 1)), {
    message: 'The last month covered must be inside the tax year',
    path: ['throughPayMonth'],
  })

export const deleteOpeningInput = z.object({ id }).strict()

export type OpeningsListInput = z.infer<typeof openingsListInput>
export type SaveOpeningInput = z.infer<typeof saveOpeningInput>
