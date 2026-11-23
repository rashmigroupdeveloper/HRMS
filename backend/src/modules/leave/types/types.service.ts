import { hasAccess } from '#core/auth/access'
import { assertGroupWide } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as typesRepository from './types.repository.js'
import type { leaveTypeInput, updateLeaveTypeInput } from './types.schema.js'

// Leave types (2026-11-22 - the old HRMS's lv.leave_types): what kinds of leave there are and their rules. One list for
// every company (like shifts), so changing it needs Leave Edit for all companies. Never deleted - retired (inactive):
// balances and applications keep pointing at it.

const round2 = (n: number) => Math.round(n * 100) / 100

// For the API: the decimals as numbers
export function toType(row: typesRepository.TypeRow) {
  return {
    ...row,
    creditPerMonth: row.creditPerMonth.toNumber(),
    maxCarryForward: row.maxCarryForward?.toNumber() ?? null,
    maxPerRequest: row.maxPerRequest?.toNumber() ?? null,
  }
}
export type LeaveType = ReturnType<typeof toType>

// Every logged-in employee sees the active types (to apply); retired ones only with Leave View
export async function listTypes(viewer: CurrentUser, includeInactive = false) {
  return (await typesRepository.list(includeInactive && hasAccess(viewer.access, 'LEAVE', 'READ'))).map(toType)
}

// Every type, retired ones too (for the module's own reads)
export async function allTypes() {
  return (await typesRepository.list(true)).map(toType)
}

export async function getType(id: number) {
  const row = await typesRepository.find(id)
  if (!row) throw new ORPCError('NOT_FOUND', { message: `No leave type with id ${id}` })
  return toType(row)
}

const dataOf = (input: z.infer<typeof leaveTypeInput>) => ({
  code: input.code,
  name: input.name,
  isPaid: input.isPaid,
  creditPerMonth: round2(input.creditPerMonth),
  creditAfterMonths: input.creditAfterMonths,
  maxCarryForward: input.maxCarryForward === null ? null : round2(input.maxCarryForward),
  maxPerRequest: input.maxPerRequest,
  allowHalfDay: input.allowHalfDay,
  countsOffDays: input.countsOffDays,
  genders: [...new Set(input.genders)],
  employmentTypes: [...new Set(input.employmentTypes)],
  isCompOff: input.isCompOff ?? false,
})

// Comp-off goes to one type only, and it must be paid (it has a balance)
async function assertCompOff(input: z.infer<typeof leaveTypeInput>, id?: number) {
  if (!input.isCompOff) return
  if (!input.isPaid) throw new ORPCError('BAD_REQUEST', { message: 'Comp-off needs a paid leave type (it has a balance)' })
  const other = (await allTypes()).find((t) => t.isCompOff && t.id !== id)
  if (other) throw new ORPCError('CONFLICT', { message: `${other.code} already receives comp-off - untick it there first` })
}

// The type comp-off claims are credited to (null: none set)
export async function compOffType() {
  return (await allTypes()).find((t) => t.isCompOff && t.isActive) ?? null
}

export async function createType(viewer: CurrentUser, input: z.infer<typeof leaveTypeInput>) {
  assertGroupWide(viewer, 'LEAVE', 'The list of leave types')
  await assertCompOff(input)
  return toType(await typesRepository.create({ ...dataOf(input), isActive: input.isActive ?? true }, viewer.employeeId))
}

export async function updateType(viewer: CurrentUser, input: z.infer<typeof updateLeaveTypeInput>) {
  assertGroupWide(viewer, 'LEAVE', 'The list of leave types')
  const current = await getType(input.id)
  await assertCompOff(input, input.id)
  // (old HRMS) paid / unpaid never flips once used - balances and payroll would mean something else; make a new type
  if (current.isPaid !== input.isPaid && (await typesRepository.isUsed(input.id))) {
    throw new ORPCError('CONFLICT', { message: `${current.code} is already used - paid / unpaid cannot change; add a new leave type instead` })
  }
  return toType(await typesRepository.update(input.id, { ...dataOf(input), ...(input.isActive !== undefined && { isActive: input.isActive }) }, viewer.employeeId))
}
