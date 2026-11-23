import { countryCodeSchema, idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const listWorkLocationsInput = z.object({ includeInactive: z.boolean().optional() }).optional()

// Indian state / UT code, e.g. WB, MH
const stateCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use the 2-letter state code, e.g. WB')

// An IANA time zone the server knows, e.g. Asia/Kolkata
const timezoneSchema = z
  .string()
  .trim()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz })
      return true
    } catch {
      return false
    }
  }, 'Use a time zone like Asia/Kolkata or Asia/Bahrain')

// The place's address (optional)
const addressSchema = z.string().trim().min(1).max(500)
// PIN code in India (6 digits - checked in the service with the country), postal code abroad
const postalCodeSchema = z.string().trim().min(3).max(12)

// A work location is group-wide: not tied to a company (the employee / offer has its own company)
export const createWorkLocationInput = z.object({
  name: nameSchema,
  // default IN
  countryCode: countryCodeSchema.optional(),
  // required for Indian locations (checked in the service)
  stateCode: stateCodeSchema.optional(),
  // default Asia/Kolkata
  timezone: timezoneSchema.optional(),
  address: addressSchema.optional(),
  postalCode: postalCodeSchema.optional(),
  // one of the regions (active)
  regionId: idSchema.optional(),
})

export const updateWorkLocationInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  countryCode: countryCodeSchema.optional(),
  stateCode: stateCodeSchema.optional(),
  timezone: timezoneSchema.optional(),
  // null clears them
  address: addressSchema.nullable().optional(),
  postalCode: postalCodeSchema.nullable().optional(),
  regionId: idSchema.nullable().optional(),
  isActive: z.boolean().optional(),
})
