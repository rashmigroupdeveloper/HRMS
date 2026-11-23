import { assertGroupWide } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId } from '#core/db/prisma'
import { ORPCError } from '@orpc/server'
import type { CurrentUser } from '#core/rpc/procedures'
import type { z } from 'zod'
import * as salaryComponentsRepository from './salary-components.repository.js'
import type { createSalaryComponentInput, updateSalaryComponentInput } from './salary-components.schema.js'

// The lines of a salary breakup (Basic, HRA, Employer PF...). Duplicate name -> 409 and unknown id -> 404 are
// mapped centrally (core/rpc/errors.ts). A retired component stays on the offers that already use it.

export function listSalaryComponents(includeInactive = false) {
  return salaryComponentsRepository.list(includeInactive)
}

// For the API: active entries are for everyone (the offer form needs them); inactive ones need ORGANIZATION READ.
export function listSalaryComponentsFor(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listSalaryComponents(includeInactive)
}

// A salary breakup (an offer's, or a revision's - 2026-11-20): every line an active component, and the monthly lines x
// 12 adding up to the annual fixed CTC. Throws BAD_REQUEST. An empty breakup is allowed (no lines given).
export async function checkBreakup(lines: { salaryComponentId: number; monthlyAmount: number }[], annualCtc: number) {
  if (lines.length === 0) return
  const active = new Set((await listSalaryComponents()).map((c) => c.id))
  if (lines.some((line) => !active.has(line.salaryComponentId))) {
    throw new ORPCError('BAD_REQUEST', { message: 'The salary breakup uses a salary component that is not active' })
  }
  const annual = lines.reduce((total, line) => total + line.monthlyAmount, 0) * 12
  if (annual !== annualCtc) {
    throw new ORPCError('BAD_REQUEST', { message: `The salary breakup adds up to ${annual} a year (monthly total x 12), but the annual CTC is ${annualCtc}` })
  }
}

export function createSalaryComponent(input: z.infer<typeof createSalaryComponentInput>, actorId: ActorId) {
  return salaryComponentsRepository.create(input, actorId)
}

export function updateSalaryComponent({ id, ...changes }: z.infer<typeof updateSalaryComponentInput>, actorId: ActorId) {
  return salaryComponentsRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): one list for every company - Organization Edit for all companies ---
export async function createSalaryComponentFor(viewer: CurrentUser, input: z.infer<typeof createSalaryComponentInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of salary components')
  return createSalaryComponent(input, viewer.employeeId)
}
export async function updateSalaryComponentFor(viewer: CurrentUser, input: z.infer<typeof updateSalaryComponentInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of salary components')
  return updateSalaryComponent(input, viewer.employeeId)
}
