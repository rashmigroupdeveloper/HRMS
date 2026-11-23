import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { employeeCodeSchema } from '../attendance.schema.js'

// Rosters (2026-11-16): who works which shift on which day, built by the manager (their reporting tree) or HR (anyone)
// as a draft and then published - attendance follows only published days. Only for rare, short changes (2026-11-22).

const range = { from: z.date(), to: z.date() }

// The roster of the employees inside the viewer's Attendance setup data access (part of the setup since 2026-11-22), at
// most 6 weeks; `onlyChanges`: only the people with a roster day in it
export const rosterGridInput = z.object({
  companyIds: z.array(idSchema).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  ...range,
  onlyChanges: z.boolean().optional(),
})

// Sets days of the draft: a shift, or null = off
export const saveRosterInput = z.object({
  cells: z.array(z.object({ employeeCode: employeeCodeSchema, date: z.date(), shiftId: idSchema.nullable() })).min(1).max(5000),
})

// Takes days out of the draft (back to the default shift)
export const clearRosterInput = z.object({ cells: z.array(z.object({ employeeCode: employeeCodeSchema, date: z.date() })).min(1).max(5000) })

// Publishes the draft days of these employees from..to
export const publishRosterInput = z.object({ employeeCodes: z.array(employeeCodeSchema).min(1).max(2000), ...range })
