import { AccessArea, AccessLevel } from '#core/db/prisma'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

const roleNameSchema = z.string().trim().min(2, 'At least 2 characters').max(60)
const descriptionSchema = z.string().trim().max(300)

// The level per area: { ONBOARDING: 'WRITE', EMPLOYEES: 'READ' }. An area left out = no access.
export const accessSchema = z.partialRecord(z.enum(AccessArea), z.enum(AccessLevel))

export const roleIdInput = z.object({ id: idSchema })

export const createRoleInput = z.object({
  name: roleNameSchema,
  description: descriptionSchema.optional(),
  access: accessSchema,
})

// Only the fields sent are changed. `access` replaces the whole list; `description: null` clears it.
export const updateRoleInput = z.object({
  id: idSchema,
  name: roleNameSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  access: accessSchema.optional(),
  // the fallback approver of approval requests (2026-11-20): true moves the mark to this role, false takes it away
  isApprovalFallback: z.boolean().optional(),
})
