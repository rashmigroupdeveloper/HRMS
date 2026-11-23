import { assertGroupWide } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import type { z } from 'zod'
import * as departmentsRepository from './departments.repository.js'
import type { createDepartmentInput, listDepartmentsInput, updateDepartmentInput } from './departments.schema.js'

// Duplicate name -> 409 and unknown id -> 404 are mapped centrally (core/rpc/errors.ts).

// `plantId`: only the departments that run at that plant (company -> plant -> department, 2026-11-18)
export function listDepartments(includeInactive = false, plantId?: number) {
  return departmentsRepository.list({ includeInactive, plantId })
}

// For the API: active entries are for everyone (every form needs them); inactive ones need ORGANIZATION READ.
export function listDepartmentsFor(viewer: CurrentUser, input: z.infer<typeof listDepartmentsInput>) {
  if (input?.includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listDepartments(input?.includeInactive ?? false, input?.plantId)
}

export function createDepartment(input: z.infer<typeof createDepartmentInput>, actorId: ActorId) {
  return departmentsRepository.create(input, actorId)
}

export function updateDepartment({ id, ...changes }: z.infer<typeof updateDepartmentInput>, actorId: ActorId) {
  return departmentsRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): one list for every company - Organization Edit for all companies ---
export async function createDepartmentFor(viewer: CurrentUser, input: z.infer<typeof createDepartmentInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of departments')
  return createDepartment(input, viewer.employeeId)
}
export async function updateDepartmentFor(viewer: CurrentUser, input: z.infer<typeof updateDepartmentInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of departments')
  return updateDepartment(input, viewer.employeeId)
}
