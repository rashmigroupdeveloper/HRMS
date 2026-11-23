import { employeesSchemas } from '#modules/employees'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Input pieces shared by the attendance APIs (2026-11-16).

export const employeeCodeSchema = employeesSchemas.employeeCodeSchema

// A calendar month, e.g. { year: 2026, month: 11 }
export const monthSchema = z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) })

// Whose attendance a list shows: the viewer's reporting tree (TEAM), the employees whose HOD the viewer is (DEPARTMENT -
// "My department", BACKLOG 3e, view only) or everyone (ALL - Attendance: View)
export const scopeSchema = z.enum(['TEAM', 'DEPARTMENT', 'ALL'])

// Which employees a list shows, within the scope
export const peopleFilterSchema = z.object({
  scope: scopeSchema.default('TEAM'),
  companyIds: z.array(idSchema).max(100).optional(),
  workLocationIds: z.array(idSchema).max(100).optional(),
  departmentIds: z.array(idSchema).max(100).optional(),
  search: z.string().trim().max(100).optional(),
})

// "09:00" -> minutes from midnight
export const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:00 or 21:30')
  .transform((value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3)))
