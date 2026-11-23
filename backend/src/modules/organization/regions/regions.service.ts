import { assertGroupWide } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import type { z } from 'zod'
import * as regionsRepository from './regions.repository.js'
import type { createRegionInput, updateRegionInput } from './regions.schema.js'

// Duplicate name -> 409 and unknown id -> 404 are mapped centrally (core/rpc/errors.ts).

export function listRegions(includeInactive = false) {
  return regionsRepository.list(includeInactive)
}

// For the API: active entries are for everyone (every form needs them); inactive ones need ORGANIZATION READ.
export function listRegionsFor(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listRegions(includeInactive)
}

export function createRegion(input: z.infer<typeof createRegionInput>, actorId: ActorId) {
  return regionsRepository.create(input, actorId)
}

export function updateRegion({ id, ...changes }: z.infer<typeof updateRegionInput>, actorId: ActorId) {
  return regionsRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): one list for every company - Organization Edit for all companies ---
export async function createRegionFor(viewer: CurrentUser, input: z.infer<typeof createRegionInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of regions')
  return createRegion(input, viewer.employeeId)
}
export async function updateRegionFor(viewer: CurrentUser, input: z.infer<typeof updateRegionInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of regions')
  return updateRegion(input, viewer.employeeId)
}
