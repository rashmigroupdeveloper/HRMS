import { assertGroupWide } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import type { z } from 'zod'
import * as designationsRepository from './designations.repository.js'
import type { createDesignationInput, updateDesignationInput } from './designations.schema.js'

// Duplicate name -> 409 and unknown id -> 404 are mapped centrally (core/rpc/errors.ts).

export function listDesignations(includeInactive = false) {
  return designationsRepository.list(includeInactive)
}

// For the API: active entries are for everyone (every form needs them); inactive ones need ORGANIZATION READ.
export function listDesignationsFor(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listDesignations(includeInactive)
}

export function createDesignation(input: z.infer<typeof createDesignationInput>, actorId: ActorId) {
  return designationsRepository.create(input, actorId)
}

export function updateDesignation({ id, ...changes }: z.infer<typeof updateDesignationInput>, actorId: ActorId) {
  return designationsRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): one list for every company - Organization Edit for all companies ---
export async function createDesignationFor(viewer: CurrentUser, input: z.infer<typeof createDesignationInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of designations')
  return createDesignation(input, viewer.employeeId)
}
export async function updateDesignationFor(viewer: CurrentUser, input: z.infer<typeof updateDesignationInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of designations')
  return updateDesignation(input, viewer.employeeId)
}
