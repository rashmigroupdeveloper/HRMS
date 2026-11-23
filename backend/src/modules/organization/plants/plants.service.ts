import { assertWholeSlice } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import { prisma, type ActorId, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as plantsRepository from './plants.repository.js'
import type { createPlantInput, listPlantsInput, setPlantDepartmentsInput, updatePlantInput } from './plants.schema.js'

// Business rules for plants. Unknown company -> 409, duplicate plant code within a company -> 409, unknown id -> 404
// (mapped centrally). A plant is not linked to a location - locations are where employees are placed.
// Company -> plant -> department (decided 2026-11-18, as VBMS): a plant has the departments that run at it, and an
// employee's / candidate's plant is one of their company's, their department one of the plant's.

export function listPlants(input: z.infer<typeof listPlantsInput>) {
  return plantsRepository.list({ companyId: input?.companyId, includeInactive: input?.includeInactive ?? false })
}

// For the API: active plants are for everyone; inactive ones need ORGANIZATION READ.
export function listPlantsFor(viewer: CurrentUser, input: z.infer<typeof listPlantsInput>) {
  if (input?.includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listPlants(input)
}

// The plant with this id; throws NOT_FOUND.
export async function getPlant(id: number, db?: DbClient) {
  const plant = await plantsRepository.findById(id, db)
  if (!plant) throw new ORPCError('NOT_FOUND', { message: `No plant found with id ${id}` })
  return plant
}

export function createPlant(input: z.infer<typeof createPlantInput>, actorId: ActorId) {
  return plantsRepository.create(input, actorId)
}

export function updatePlant({ id, ...changes }: z.infer<typeof updatePlantInput>, actorId: ActorId) {
  return plantsRepository.update(id, changes, actorId)
}

// Sets the departments that run at the plant - the whole list: adds the new ones, brings back retired ones that are ticked
// again, and for the ones left out: deletes a link nobody was ever placed in, retires one that employees or candidates
// (current or past) have, or that has HOD history (it is an HOD post - BACKLOG 3e) or job-timeline entries (2026-11-19) -
// they keep it, nobody new is placed in it (2026-11-18).
export async function setPlantDepartments({ id, departmentIds }: z.infer<typeof setPlantDepartmentsInput>, actorId: ActorId) {
  await getPlant(id)
  const wanted = new Set(departmentIds)
  const links = await plantsRepository.listDepartmentLinks(id)
  const known = new Set(links.map((link) => link.departmentId))
  const leftOut = links.filter((link) => link.isActive && !wanted.has(link.departmentId))
  const used = (link: (typeof links)[number]) =>
    link._count.employees + link._count.candidates + link._count.hodAppointments + link._count.hodEmployees + link._count.jobRecords > 0
  const toRetire = leftOut.filter(used).map((link) => link.departmentId)
  const toDelete = leftOut.filter((link) => !used(link)).map((link) => link.departmentId)
  const toBringBack = links.filter((link) => !link.isActive && wanted.has(link.departmentId)).map((link) => link.departmentId)
  const toAdd = [...wanted].filter((departmentId) => !known.has(departmentId))
  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) await plantsRepository.deleteDepartmentLinks(id, toDelete, tx)
    if (toRetire.length > 0) await plantsRepository.setDepartmentLinksActive(id, toRetire, false, actorId, tx)
    if (toBringBack.length > 0) await plantsRepository.setDepartmentLinksActive(id, toBringBack, true, actorId, tx)
    // an unknown department id fails on its foreign key (409, mapped centrally)
    if (toAdd.length > 0) await plantsRepository.addDepartmentLinks(id, toAdd, actorId, tx)
  })
  return { added: toAdd.length + toBringBack.length, removed: toDelete.length + toRetire.length }
}

// Adds departments to a plant, keeping the ones it has - a retired link stays retired (the VBMS import). Returns how
// many were new.
export async function addPlantDepartments(plantId: number, departmentIds: number[], actorId: ActorId, db?: DbClient) {
  const result = await plantsRepository.addDepartmentLinks(plantId, departmentIds, actorId, db)
  return result.count
}

// Every (plant, department) link that is not retired, as "plantId:departmentId" key -> the link's id - for checking many
// placements at once (and the link is the HOD post - BACKLOG 3e)
export async function listPlantDepartmentKeys(db?: DbClient) {
  const pairs = await plantsRepository.listActiveDepartmentPairs(db)
  return new Map(pairs.map((pair) => [`${pair.plantId}:${pair.departmentId}`, pair.id]))
}

// The id of the department's link at the plant (retired too), or null - an employee's HOD post (BACKLOG 3e)
export async function findPlantDepartmentId(plantId: number, departmentId: number, db?: DbClient) {
  return (await plantsRepository.findDepartmentLink(plantId, departmentId, db))?.id ?? null
}

// Every link (retired too) with its company, plant and department - the HOD posts (BACKLOG 3e)
export function listAllPlantDepartments(db?: DbClient) {
  return plantsRepository.listAllDepartmentLinks(db)
}

// Where an employee / candidate is placed, after the change is applied to what they had
export type Placement = { companyId: number; plantId: number; departmentId?: number | null | undefined }
// What the change chose anew (a new record: both) - only a new choice must still be open; what a person already has may
// have been closed since (a retired plant, a department retired at the plant)
export type PlacementChanged = { plant: boolean; department: boolean }

// Checks a placement before it is saved (400 with a message HR can act on - the database refuses most of it anyway):
// the plant is one of the company's, the department runs at the plant.
export async function assertPlacement(placement: Placement, changed: PlacementChanged, db?: DbClient) {
  const plant = await plantsRepository.findById(placement.plantId, db)
  if (!plant || plant.company.id !== placement.companyId) {
    throw new ORPCError('BAD_REQUEST', { message: "The plant is not one of the company's plants - choose a plant of the company" })
  }
  if (changed.plant && !plant.isActive) {
    throw new ORPCError('BAD_REQUEST', { message: `Plant ${plant.plantCode} ${plant.name} is no longer active` })
  }
  if (placement.departmentId == null) return
  const link = await plantsRepository.findDepartmentLink(plant.id, placement.departmentId, db)
  if (!link || (!link.isActive && (changed.plant || changed.department))) {
    throw new ORPCError('BAD_REQUEST', {
      message: `The department does not run at plant ${plant.plantCode} ${plant.name} - choose one of the plant's departments, or add it to the plant on the Organization page`,
    })
  }
}

// --- From the API (data access, A4 2026-11-18): a company's plants need Organization Edit for that whole company; a plant's departments, for that plant ---
export async function createPlantFor(viewer: CurrentUser, input: z.infer<typeof createPlantInput>) {
  assertWholeSlice(viewer, 'ORGANIZATION', { companyId: input.companyId, plantId: null, departmentId: null }, "The company's plants")
  return createPlant(input, viewer.employeeId)
}
export async function updatePlantFor(viewer: CurrentUser, input: z.infer<typeof updatePlantInput>) {
  const plant = await getPlant(input.id)
  assertWholeSlice(viewer, 'ORGANIZATION', { companyId: plant.company.id, plantId: null, departmentId: null }, "The company's plants")
  return updatePlant(input, viewer.employeeId)
}
export async function setPlantDepartmentsFor(viewer: CurrentUser, input: z.infer<typeof setPlantDepartmentsInput>) {
  const plant = await getPlant(input.id)
  assertWholeSlice(viewer, 'ORGANIZATION', { companyId: plant.company.id, plantId: plant.id, departmentId: null }, "The plant's departments")
  return setPlantDepartments(input, viewer.employeeId)
}
