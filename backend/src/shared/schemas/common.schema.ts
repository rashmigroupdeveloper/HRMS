import { z } from 'zod'
import { isValidMobile } from '../utils/identity.js'

// Reusable zod pieces shared by many modules.

export const idSchema = z.number().int().positive()

// A short name: a master-data entry (department, designation, ...) or part of a person's name
export const nameSchema = z.string().trim().min(1, 'Name is required').max(100)

// Optional input of every "list" procedure: inactive entries are hidden unless asked for
export const listInput = z.object({ includeInactive: z.boolean().optional() }).optional()

// ISO 3166-1 alpha-2 country code, e.g. "IN"
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use a 2-letter country code, e.g. IN')

// Trimmed and lower-cased first, then checked (" A@B.com " is accepted and stored as "a@b.com")
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

// An Indian mobile (10 digits starting 6-9, with or without +91) or an international one with + and the country code
// (old HRMS rule, 2026-11-16)
export const mobileSchema = z
  .string()
  .trim()
  .max(20)
  .refine(isValidMobile, 'Use a 10-digit Indian mobile number (e.g. 9876543210), or + and the country code for a number abroad')
