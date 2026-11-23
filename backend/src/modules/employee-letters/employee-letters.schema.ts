import { employeesSchemas } from '#modules/employees'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// Letters HR issues to an employee (2026-11-16). The appointment letter is also issued automatically on the joining
// day; experience and relieving letters by HR for now (later after the resignation module's approvals).
export const EMPLOYEE_LETTER_KINDS = ['APPOINTMENT_LETTER', 'CONFIRMATION_LETTER', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'SALARY_CERTIFICATE'] as const
export type EmployeeLetterKind = (typeof EMPLOYEE_LETTER_KINDS)[number]

export const employeeLettersInput = z.object({ employeeCode: employeesSchemas.employeeCodeSchema })

export const letterTemplatesForInput = z.object({ employeeCode: employeesSchemas.employeeCodeSchema, kind: z.enum(EMPLOYEE_LETTER_KINDS) })

// The letter as it would be issued (preview) / issuing it
export const writeEmployeeLetterInput = z.object({
  employeeCode: employeesSchemas.employeeCodeSchema,
  kind: z.enum(EMPLOYEE_LETTER_KINDS),
  templateId: idSchema,
  // default today
  letterDate: z.date().optional(),
  // experience / relieving letters: required (checked in the service)
  lastWorkingDay: z.date().optional(),
})

export const employeeLetterIdInput = z.object({ id: idSchema })
