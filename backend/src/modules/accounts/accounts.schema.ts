import { AccessLevel } from '#core/db/prisma'
import { employeesSchemas } from '#modules/employees'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const loginInput = z.object({
  // the employee code (any case) or the work e-mail (2026-11-16)
  login: z.string().trim().min(1, 'Enter your employee code or work e-mail').max(200),
  password: z.string().min(1, 'Password is required').max(200),
})

// Re-entering one's password before changing roles (core/auth/confirm.ts)
export const confirmPasswordInput = z.object({ password: z.string().min(1, 'Enter your password').max(200) })

// Turning someone's login off (why - e.g. "suspended") / back on
export const disableLoginInput = z.object({
  employeeCode: employeesSchemas.employeeCodeSchema,
  reason: z.string().trim().min(1, 'Say why the login is turned off').max(300),
})

// One session (to log it out)
export const sessionIdInput = z.object({ sessionId: idSchema })

// The complete list of roles the employee should have (an empty list takes every role away)
// One data-access row of a role given to someone (2026-11-18): a company (null = every company), a plant of it (null =
// every plant - only with a company), a department (null = every department), and View / Edit
export const dataAccessRowInput = z
  .object({
    companyId: idSchema.nullable(),
    plantId: idSchema.nullable(),
    departmentId: idSchema.nullable(),
    level: z.enum(AccessLevel),
  })
  .refine((row) => row.plantId === null || row.companyId !== null, { message: 'Choose the company of the plant', path: ['plantId'] })

// The employee's roles - each with its data access (whose records it covers; none = nobody's)
export const setRolesInput = z.object({
  employeeCode: employeesSchemas.employeeCodeSchema,
  roles: z.array(z.object({ roleId: idSchema, dataAccess: z.array(dataAccessRowInput).max(100) })).max(50),
})

// Changing one's own password (the rules for the new one are checked in the service)
export const changePasswordInput = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: z.string().min(1, 'Enter a new password').max(200),
})

// "Forgot password": the employee asks for a code by their employee code (sign-in page, not logged in)
export const requestPasswordResetInput = z.object({ employeeCode: employeesSchemas.employeeCodeSchema })

// ... then sets a new password with the code (the rules for the new one are checked in the service)
export const resetPasswordWithCodeInput = z.object({
  employeeCode: employeesSchemas.employeeCodeSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'The code has 6 digits'),
  newPassword: z.string().min(1, 'Enter a new password').max(200),
})

// The login of one employee (give a login, reset its password, unlock it)
export const accountCodeInput = z.object({ employeeCode: employeesSchemas.employeeCodeSchema })
