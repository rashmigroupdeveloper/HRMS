import { assertWholeSlice } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId, DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as plantsService from '../plants/plants.service.js'
import * as costCentersRepository from './cost-centers.repository.js'
import type { createCostCenterInput, listCostCentersInput, updateCostCenterInput } from './cost-centers.schema.js'

// Business rules for cost centres. Unknown company -> 409, duplicate code within a company -> 409, unknown id -> 404
// (mapped centrally).

export function listCostCenters(input: z.infer<typeof listCostCentersInput>) {
  return costCentersRepository.list({ companyId: input?.companyId, includeInactive: input?.includeInactive ?? false })
}

// For the API: active cost centres are for everyone; inactive ones need ORGANIZATION READ.
export function listCostCentersFor(viewer: CurrentUser, input: z.infer<typeof listCostCentersInput>) {
  if (input?.includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listCostCenters(input)
}

// The cost centre with this id; throws NOT_FOUND.
export async function getCostCenter(id: number, db?: DbClient) {
  const costCenter = await costCentersRepository.findById(id, db)
  if (!costCenter) throw new ORPCError('NOT_FOUND', { message: `No cost centre found with id ${id}` })
  return costCenter
}

// A cost centre rolls up into a plant of its own company
async function assertPlantOfCompany(plantId: number, companyId: number) {
  const plant = await plantsService.getPlant(plantId)
  if (plant.company.id !== companyId) {
    throw new ORPCError('BAD_REQUEST', { message: `Plant ${plant.plantCode} belongs to another company` })
  }
}

export async function createCostCenter(input: z.infer<typeof createCostCenterInput>, actorId: ActorId) {
  if (input.plantId !== undefined) await assertPlantOfCompany(input.plantId, input.companyId)
  return costCentersRepository.create(input, actorId)
}

export async function updateCostCenter({ id, ...changes }: z.infer<typeof updateCostCenterInput>, actorId: ActorId) {
  if (changes.plantId != null) await assertPlantOfCompany(changes.plantId, (await getCostCenter(id)).company.id)
  return costCentersRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): a company's cost centres need Organization Edit for that whole company ---
export async function createCostCenterFor(viewer: CurrentUser, input: z.infer<typeof createCostCenterInput>) {
  assertWholeSlice(viewer, 'ORGANIZATION', { companyId: input.companyId, plantId: null, departmentId: null }, "The company's cost centres")
  return createCostCenter(input, viewer.employeeId)
}
export async function updateCostCenterFor(viewer: CurrentUser, input: z.infer<typeof updateCostCenterInput>) {
  const costCenter = await getCostCenter(input.id)
  assertWholeSlice(viewer, 'ORGANIZATION', { companyId: costCenter.company.id, plantId: null, departmentId: null }, "The company's cost centres")
  return updateCostCenter(input, viewer.employeeId)
}
