import { assertGroupWide } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import type { z } from 'zod'
import * as gradesRepository from './grades.repository.js'
import type { createGradeInput, updateGradeInput } from './grades.schema.js'

// Duplicate name -> 409 and unknown id -> 404 are mapped centrally (core/rpc/errors.ts).

export function listGrades(includeInactive = false) {
  return gradesRepository.list(includeInactive)
}

// For the API: active entries are for everyone (every form needs them); inactive ones need ORGANIZATION READ.
export function listGradesFor(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listGrades(includeInactive)
}

export function createGrade(input: z.infer<typeof createGradeInput>, actorId: ActorId) {
  return gradesRepository.create(input, actorId)
}

export function updateGrade({ id, ...changes }: z.infer<typeof updateGradeInput>, actorId: ActorId) {
  return gradesRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): one list for every company - Organization Edit for all companies ---
export async function createGradeFor(viewer: CurrentUser, input: z.infer<typeof createGradeInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of grades')
  return createGrade(input, viewer.employeeId)
}
export async function updateGradeFor(viewer: CurrentUser, input: z.infer<typeof updateGradeInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of grades')
  return updateGrade(input, viewer.employeeId)
}
