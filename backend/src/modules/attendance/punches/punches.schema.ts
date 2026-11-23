import { z } from 'zod'
import { clockSchema, employeeCodeSchema } from '../attendance.schema.js'

// Punches from the biometric machines (2026-11-16): HR uploads the machines' export (Excel or CSV) until the Kent feed is
// connected.

export const MAX_PUNCH_FILE_BYTES = 10 * 1024 * 1024
export const MAX_PUNCH_ROWS = 50_000

export const uploadPunchesInput = z.object({
  file: z.file().min(1, 'The file is empty').max(MAX_PUNCH_FILE_BYTES, 'The file must be 10 MB or smaller'),
})

// Punches typed by hand for one employee on one day - for testing only (the user, 2026-11-22; refused in production)
export const addManualPunchesInput = z.object({
  employeeCode: employeeCodeSchema,
  date: z.date(),
  // the times on the employee's work-location clock, e.g. ["09:02", "18:10"]
  times: z.array(clockSchema).min(1, 'Add at least one time').max(10),
})

// Give the punches of a code that matched no employee to an employee (a code typed differently on the machine)
export const linkUnmatchedInput = z.object({ code: z.string().trim().min(1).max(50), employeeCode: employeeCodeSchema })
