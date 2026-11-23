import { idSchema } from '#shared/schemas/common.schema'
import { employeesSchemas } from '#modules/employees'
import { z } from 'zod'

// Pieces shared by the leave module's inputs (2026-11-22).

export const employeeCodeSchema = employeesSchemas.employeeCodeSchema

// A leave year (the calendar year - BACKLOG asks HR)
export const yearSchema = z.number().int().min(2020).max(2100)

// Whose leave a list shows: the viewer's reporting tree (TEAM), the employees whose HOD they are (DEPARTMENT, view only)
// or everyone in their data access (ALL - Leave: View)
export const peopleFilterSchema = z.object({
  scope: z.enum(['TEAM', 'DEPARTMENT', 'ALL']).default('TEAM'),
  companyIds: z.array(idSchema).max(100).optional(),
  departmentIds: z.array(idSchema).max(100).optional(),
  search: z.string().trim().max(100).optional(),
})
