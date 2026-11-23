import { countryCodeSchema, idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// A registration number: spaces removed, upper-cased, then checked against its official format (as in the old HRMS)
const registration = (pattern: RegExp, message: string) =>
  z
    .string()
    .transform((v) => v.replace(/\s/g, '').toUpperCase())
    .pipe(z.string().regex(pattern, message))
    .optional()

export const createCompanyInput = z.object({
  code: z.string().trim().min(1).max(20).toUpperCase(),
  name: nameSchema,
  // Prefix of the company's employee codes, e.g. RML
  ecodePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Use 2-10 letters / digits, starting with a letter'),
  // The number the next system-generated employee code gets (ecodePrefix + 6 digits) - where the company's existing
  // codes end, e.g. 35385 -> RML035385
  nextEmployeeNumber: z.number().int().min(1).max(99_999_999).optional(),
  // SAP company code, e.g. 1100
  sapCompanyCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{2,10}$/i, 'Use 2-10 letters / digits, e.g. 1100')
    .toUpperCase()
    .optional(),
  // false for overseas entities (no PF / ESIC / PT / TDS); default true
  isIndiaPayroll: z.boolean().optional(),
  // street / building - required: printed as the employer on Gratuity Form F and ESIC Form 1 (2026-11-15)
  address: z.string().trim().min(1, 'Give the company address').max(500),
  // PIN code in India (required there - checked in the service), postal code abroad
  postalCode: z.string().trim().min(3).max(12).optional(),
  // default IN
  countryCode: countryCodeSchema.optional(),
  // state / region name, e.g. West Bengal, Dubai - required
  region: z.string().trim().min(1, 'Give the state / region').max(100),
  // both required for an India payroll company (checked in the service)
  pfEstablishmentCode: registration(/^[A-Z]{5}\d{7}(\d{3})?$/, 'A PF establishment code looks like WBCAL0012345 (optionally + 3 digits)'),
  esicEmployerCode: registration(/^\d{17}$/, 'An ESIC employer code has 17 digits'),
  pan: registration(/^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/, 'A company PAN looks like AABCR1234K'),
  tan: registration(/^[A-Z]{4}\d{5}[A-Z]$/, 'A TAN looks like CALR12345A'),
  gstin: registration(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'A GSTIN has 15 characters, like 19AABCR1234K1Z5'),
  ptRegistrationNo: registration(/^[A-Z0-9/-]{4,30}$/, 'Use 4-30 letters, digits, / or -'),
})

export const updateCompanyInput = createCompanyInput.partial().extend({
  id: idSchema,
  isActive: z.boolean().optional(),
})
