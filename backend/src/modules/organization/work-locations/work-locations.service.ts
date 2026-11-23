import { assertGroupWide } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId, DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as workLocationsRepository from './work-locations.repository.js'
import * as regionsService from '../regions/regions.service.js'
import type { createWorkLocationInput, listWorkLocationsInput, updateWorkLocationInput } from './work-locations.schema.js'

// One group-wide list. Duplicate name -> 409, unknown id -> 404 (mapped centrally).

export function listWorkLocations(input: z.infer<typeof listWorkLocationsInput>) {
  return workLocationsRepository.list({ includeInactive: input?.includeInactive ?? false })
}

// For the API: active work locations are for everyone (every form needs them); inactive ones need ORGANIZATION READ.
export function listWorkLocationsFor(viewer: CurrentUser, input: z.infer<typeof listWorkLocationsInput>) {
  if (input?.includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listWorkLocations(input)
}

// The work location with this id; throws NOT_FOUND.
export async function getWorkLocation(id: number, db?: DbClient) {
  const location = await workLocationsRepository.findById(id, db)
  if (!location) throw new ORPCError('NOT_FOUND', { message: `No work location found with id ${id}` })
  return location
}

// An Indian work location needs its state (Professional Tax slab, LWF); an overseas one has none
function assertState(countryCode: string, stateCode: string | null | undefined) {
  if (countryCode === 'IN' && !stateCode) {
    throw new ORPCError('BAD_REQUEST', { message: 'An Indian work location needs its state code (e.g. WB)' })
  }
}

// An Indian PIN code has 6 digits (when one is given - the address is optional)
function assertPostalCode(countryCode: string, postalCode: string | null | undefined) {
  if (countryCode === 'IN' && postalCode && !/^\d{6}$/.test(postalCode)) {
    throw new ORPCError('BAD_REQUEST', { message: 'An Indian PIN code has 6 digits' })
  }
}

// A region chosen for a work location must be in use (one retired since stays on the locations that have it)
async function assertRegion(regionId: number) {
  const region = (await regionsService.listRegions(true)).find((r) => r.id === regionId)
  if (!region) throw new ORPCError('BAD_REQUEST', { message: `No region found with id ${regionId}` })
  if (!region.isActive) throw new ORPCError('BAD_REQUEST', { message: `Region ${region.name} is no longer used` })
}

export async function createWorkLocation(input: z.infer<typeof createWorkLocationInput>, actorId: ActorId) {
  const countryCode = input.countryCode ?? 'IN'
  assertState(countryCode, input.stateCode)
  assertPostalCode(countryCode, input.postalCode)
  if (input.regionId !== undefined) await assertRegion(input.regionId)
  // only Indian locations have an Indian state
  return workLocationsRepository.create({ ...input, stateCode: countryCode === 'IN' ? input.stateCode : undefined }, actorId)
}

// A work location created before state codes existed may stay without one until its country or state is changed.
export async function updateWorkLocation({ id, ...changes }: z.infer<typeof updateWorkLocationInput>, actorId: ActorId) {
  if (changes.regionId != null) await assertRegion(changes.regionId)
  if (changes.countryCode !== undefined || changes.postalCode != null) {
    const current = await getWorkLocation(id)
    assertPostalCode(changes.countryCode ?? current.countryCode, changes.postalCode === undefined ? current.postalCode : changes.postalCode)
  }
  if (changes.countryCode !== undefined || changes.stateCode !== undefined) {
    const current = await getWorkLocation(id)
    const countryCode = changes.countryCode ?? current.countryCode
    assertState(countryCode, changes.stateCode ?? current.stateCode)
    // moved abroad: the Indian state no longer applies
    if (countryCode !== 'IN') return workLocationsRepository.update(id, { ...changes, stateCode: null }, actorId)
  }
  return workLocationsRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): one list for every company - Organization Edit for all companies ---
export async function createWorkLocationFor(viewer: CurrentUser, input: z.infer<typeof createWorkLocationInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of work locations')
  return createWorkLocation(input, viewer.employeeId)
}
export async function updateWorkLocationFor(viewer: CurrentUser, input: z.infer<typeof updateWorkLocationInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of work locations')
  return updateWorkLocation(input, viewer.employeeId)
}
