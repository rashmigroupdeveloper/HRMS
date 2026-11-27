import { z } from 'zod'
import { Gender, StatutoryParameter, TaxRegime } from '#core/db/prisma'
import { hasPaiseOnly } from '#shared/utils/money'

// Payroll stage 4 (approved 2026-11-27): the statutory settings - dated rates, professional-tax slabs, labour welfare
// fund and income-tax slabs. Entered from the official notifications (the CA checks them); nothing is seeded.

const id = z.number().int().positive()
// a calendar day (midnight UTC, as the date pickers send it)
const day = z.date().refine((d) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100, 'Choose a day from 2000 to 2100')
// 1 April of a tax year
const taxYearFrom = day.refine((d) => d.getUTCMonth() === 3 && d.getUTCDate() === 1, 'A tax year starts on 1 April')
// a State as work locations name it (WorkLocation.stateCode), e.g. WB
const stateCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'A 2-letter State code, e.g. WB')
// where the figure comes from - for the CA's check
const reference = z.string().trim().min(3, 'Name the notification or section (at least 3 characters)').max(300)
const rupees = z.number().int('Whole rupees').min(0).max(1_000_000_000)
const money = z.number().min(0).max(1_000_000).refine(hasPaiseOnly, { message: 'At most 2 decimals' })
const month = z.number().int().min(1).max(12)

// A rate or limit: up to 4 decimals (8.33, 0.75)
const value = z.number().min(0).max(1_000_000_000).refine((v) => Math.abs(v * 10_000 - Math.round(v * 10_000)) < 1e-6, { message: 'At most 4 decimals' })

export const saveRateInput = z.object({ id: id.optional(), parameter: z.enum(StatutoryParameter), effectiveFrom: day, value, reference }).strict()
export const deleteRateInput = z.object({ id }).strict()

const ptSlab = z
  .object({ gender: z.enum(Gender).nullable(), wagesFrom: rupees, wagesTo: rupees.nullable(), amount: rupees, specialMonth: month.nullable(), specialAmount: rupees.nullable() })
  .strict()
  .refine((s) => s.wagesTo === null || s.wagesTo >= s.wagesFrom, { message: 'A slab ends at or after it starts' })
  .refine((s) => (s.specialMonth === null) === (s.specialAmount === null), { message: 'Give both the special month and its amount, or neither' })
// The slabs of one State from one day. `replaces`: the set being edited, when its State or day changes.
export const savePtSlabsInput = z
  .object({ stateCode, effectiveFrom: day, slabs: z.array(ptSlab).min(1).max(30), reference, replaces: z.object({ stateCode, effectiveFrom: day }).strict().optional() })
  .strict()
export const deletePtSlabsInput = z.object({ stateCode, effectiveFrom: day }).strict()

export const saveLwfInput = z
  .object({ id: id.optional(), stateCode, effectiveFrom: day, employeeAmount: money, employerAmount: money, months: z.array(month).max(12), reference })
  .strict()
export const deleteLwfInput = z.object({ id }).strict()

const taxSlab = z
  .object({ incomeFrom: rupees, incomeTo: rupees.nullable(), ratePercent: z.number().min(0).max(100).refine(hasPaiseOnly, { message: 'At most 2 decimals' }) })
  .strict()
  .refine((s) => s.incomeTo === null || s.incomeTo > s.incomeFrom, { message: 'A slab ends after it starts' })
export const saveTaxSlabsInput = z
  .object({ regime: z.enum(TaxRegime), taxYearFrom, slabs: z.array(taxSlab).min(1).max(20), reference, replaces: z.object({ regime: z.enum(TaxRegime), taxYearFrom }).strict().optional() })
  .strict()
export const deleteTaxSlabsInput = z.object({ regime: z.enum(TaxRegime), taxYearFrom }).strict()

// The payroll settings (stage 5, approved 2026-11-27 - "nothing should be hardcoded")
export const saveSettingsInput = z
  .object({ tdsCountsDraftRuns: z.boolean(), bigChangePercent: z.number().int().min(1).max(1000), epsAgeSoonMonths: z.number().int().min(0).max(24) })
  .strict()

export type SavePtSlabsInput = z.infer<typeof savePtSlabsInput>
export type SaveTaxSlabsInput = z.infer<typeof saveTaxSlabsInput>
