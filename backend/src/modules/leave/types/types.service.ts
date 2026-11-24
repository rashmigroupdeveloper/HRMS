import { reportFile, reportSheet } from '#core/excel/report'
import { hasAccess } from '#core/auth/access'
import { assertGroupWide } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as typesRepository from './types.repository.js'
import type { leaveTypeInput, updateLeaveTypeInput } from './types.schema.js'

// Leave types (2026-11-22 - the old HRMS's lv.leave_types): what kinds of leave there are and their rules. One list for
// every company (like shifts), so changing it needs Leave Edit for all companies. Never deleted - retired (inactive):
// balances and applications keep pointing at it.

const round2 = (n: number) => Math.round(n * 100) / 100
const firstOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const nextMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
const monthText = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

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
  // (a type taken on its holiday dates lapses at the year end - 2026-11-24)
  maxCarryForward: input.holidaysOnly ? 0 : input.maxCarryForward === null ? null : round2(input.maxCarryForward),
  maxPerRequest: input.maxPerRequest,
  allowHalfDay: input.allowHalfDay,
  countsOffDays: input.countsOffDays,
  // (0 days' notice = none)
  noticeDays: input.noticeDays || null,
  todayOrPastOnly: input.todayOrPastOnly ?? false,
  maxDaysBack: input.maxDaysBack ?? null,
  genders: [...new Set(input.genders)],
  employmentTypes: [...new Set(input.employmentTypes)],
  isCompOff: input.isCompOff ?? false,
  holidaysOnly: input.holidaysOnly ?? false,
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
  // credits start the month after it is added - never months back
  return toType(await typesRepository.create({ ...dataOf(input), isActive: input.isActive ?? true, creditsFrom: nextMonth(today()) }, viewer.employeeId))
}

export async function updateType(viewer: CurrentUser, input: z.infer<typeof updateLeaveTypeInput>) {
  assertGroupWide(viewer, 'LEAVE', 'The list of leave types')
  const current = await getType(input.id)
  await assertCompOff(input, input.id)
  // (old HRMS) paid / unpaid never flips once used - balances and payroll would mean something else; make a new type
  if (current.isPaid !== input.isPaid && (await typesRepository.isUsed(input.id))) {
    throw new ORPCError('CONFLICT', { message: `${current.code} is already used - paid / unpaid cannot change; add a new leave type instead` })
  }
  // a change of who is credited what (the user, 2026-11-23, as Keka / Zoho People: from an effective date): the month it
  // credits from - before, every month back to when the type was added was credited at once to whoever it now covered
  const next = dataOf(input)
  const isActive = input.isActive ?? current.isActive
  const creditRulesChange =
    next.isPaid &&
    (next.creditPerMonth !== current.creditPerMonth ||
      next.creditAfterMonths !== current.creditAfterMonths ||
      !sameSet(next.genders, current.genders) ||
      !sameSet(next.employmentTypes, current.employmentTypes) ||
      (isActive && !current.isActive))
  let creditsFrom: Date | undefined
  if (creditRulesChange) {
    if (!input.creditsFrom) throw new ORPCError('BAD_REQUEST', { message: 'Give the month the new credit rules credit from' })
    creditsFrom = firstOfMonth(input.creditsFrom)
    const first = nextMonth(current.createdAt)
    if (creditsFrom < first) throw new ORPCError('BAD_REQUEST', { message: `${current.code} was added in ${monthText(current.createdAt)} - its credits start ${monthText(first)} at the earliest` })
  }
  return toType(await typesRepository.update(input.id, { ...next, ...(input.isActive !== undefined && { isActive: input.isActive }), ...(creditsFrom && { creditsFrom }) }, viewer.employeeId))
}

export async function exportTypes(viewer: CurrentUser, includeInactive = false) {
  return reportFile([reportSheet('Leave types',await listTypes(viewer,includeInactive),[
    {header:'Code',text:true,value:r=>r.code},{header:'Name',value:r=>r.name},
    {header:'Paid',value:r=>r.isPaid?'Yes':'No'},{header:'Credit per month',value:r=>r.creditPerMonth},
    {header:'Credit after months',value:r=>r.creditAfterMonths},{header:'Carry forward limit',value:r=>r.maxCarryForward??'All'},
    {header:'Per-request limit',value:r=>r.maxPerRequest??'No limit'},{header:'Half days',value:r=>r.allowHalfDay?'Yes':'No'},
    {header:'Counts off days',value:r=>r.countsOffDays?'Yes':'No'},
    {header:'Notice (days)',value:r=>r.noticeDays??'None'},{header:'Today or past only',value:r=>r.todayOrPastOnly?'Yes':'No'},
    {header:'Days back at most',value:r=>r.maxDaysBack??'Open months'},
    {header:'Genders',value:r=>r.genders.join(', ')||'All'},
    {header:'Employment types',width:35,value:r=>r.employmentTypes.join(', ')||'All'},
    {header:'Comp-off',value:r=>r.isCompOff?'Yes':'No'},{header:'Only on its holiday dates',value:r=>r.holidaysOnly?'Yes':'No'},{header:'Status',value:r=>r.isActive?'Active':'Retired'},
  ])],{title:'Leave types',preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:'Shared leave rules. Retired types are included only when requested and the active role has Leave View.'},'leave-types')
}
