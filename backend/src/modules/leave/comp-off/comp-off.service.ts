import { hasLevelAt } from '#core/auth/scope'
import { prisma, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { attendanceService } from '#modules/attendance'
import { today } from '#shared/utils/dates'
import { addDays } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as balancesRepository from '../balances/balances.repository.js'
import * as leaveService from '../leave.service.js'
import * as typesService from '../types/types.service.js'
import * as compOffRepository from './comp-off.repository.js'
import type { claimCompOffInput } from './comp-off.schema.js'

// Comp-off claims (the user, 2026-11-22): an employee who worked on a weekly off or a holiday (e.g. a Sunday) claims
// comp-off for it; the manager approves (the approval service, kind COMP_OFF - seeded: the reporting manager, 48 h, then
// their manager); approved, the days are credited to the comp-off leave type (the seeded CO) and used later like any
// leave. With the old HRMS's numbers (the user: "build it with those defaults"):
// - the day's punches decide: at least 8 hours worked = 1 day, at least 4 hours = half a day, less = nothing;
// - only a whole weekly off or holiday already over, claimed at most 30 days after it; one claim per day;
// - the comp-off expires 90 days after the day worked - not used by then, it lapses (the nightly leave job); a claim
//   approved late still leaves at least 30 days from the approval to use it (expiresOn).
// The hours are counted again when the claim is approved (punches uploaded meanwhile count).

export const FULL_DAY_MINUTES = 480
export const HALF_DAY_MINUTES = 240
export const CLAIM_DAYS_BACK = 30
export const VALID_DAYS = 90
export const MIN_DAYS_LEFT = 30

// The day a comp-off expires: 90 days after the day worked - or, for a claim approved so late that less than 30 days
// would be left, 30 days after the approval (2026-11-23, the review: a claim approved after its 90 days was credited
// already expired and lapsed the next night, before the employee could use it)
export const expiresOn = (workDate: Date, approvedOn: Date) => {
  const normal = addDays(workDate, VALID_DAYS)
  const least = addDays(approvedOn, MIN_DAYS_LEFT)
  return normal < least ? least : normal
}

const fullName = (e: { firstName: string; middleName: string | null; lastName: string | null }) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
const dateText = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const hoursText = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`

// The comp-off a day's work earns (0: none)
export const daysFor = (workedMinutes: number) => (workedMinutes >= FULL_DAY_MINUTES ? 1 : workedMinutes >= HALF_DAY_MINUTES ? 0.5 : 0)

// The day worked, checked: a whole weekly off / holiday already over, with enough hours - the days it earns
async function checkDay(employeeId: number, workDate: Date) {
  const day = await attendanceService.workedOn(employeeId, workDate)
  if (!day) throw new ORPCError('BAD_REQUEST', { message: 'You were not employed on that day' })
  if (day.planned !== 'WEEKLY_OFF' && day.planned !== 'HOLIDAY') throw new ORPCError('BAD_REQUEST', { message: 'Comp-off is for work on a weekly off or a holiday - that was a working day' })
  const days = daysFor(day.workedMinutes)
  if (!days) {
    throw new ORPCError('BAD_REQUEST', {
      message: `The punches show ${day.workedMinutes ? hoursText(day.workedMinutes) : 'no time'} worked that day - comp-off needs at least ${HALF_DAY_MINUTES / 60} hours (half a day) or ${FULL_DAY_MINUTES / 60} hours (a day)`,
    })
  }
  return { day, days }
}

async function toClaims(rows: compOffRepository.ClaimRow[]) {
  const approvals = await approvalsService.statusOf(rows.map((r) => r.approvalRequestId))
  return rows.map((r) => ({
    id: r.id,
    employee: { employeeCode: r.employee.employeeCode, name: fullName(r.employee) },
    workDate: r.workDate,
    days: r.days.toNumber(),
    reason: r.reason,
    status: r.status,
    // approved: the day the comp-off expires
    expiresOn: r.entry?.expiresOn ?? null,
    approvalRequestId: r.approvalRequestId,
    approval: approvals.get(r.approvalRequestId) ?? null,
    createdAt: r.createdAt,
  }))
}

export async function claim(viewer: CurrentUser, input: z.infer<typeof claimCompOffInput>) {
  const now = today()
  if (input.workDate >= now) throw new ORPCError('BAD_REQUEST', { message: 'Comp-off is claimed once the day is over' })
  if (input.workDate < addDays(now, -CLAIM_DAYS_BACK)) throw new ORPCError('BAD_REQUEST', { message: `Comp-off is claimed within ${CLAIM_DAYS_BACK} days of the day worked` })
  const type = await typesService.compOffType()
  if (!type) throw new ORPCError('CONFLICT', { message: 'No leave type receives comp-off - ask HR to tick one on Team leave > Leave types' })
  const person = await leaveService.findPerson(viewer.employeeId)
  if (!person || !leaveService.typeAppliesTo(type, person)) throw new ORPCError('BAD_REQUEST', { message: `${type.name} does not apply to you` })
  if (await compOffRepository.findOpen(viewer.employeeId, input.workDate)) throw new ORPCError('CONFLICT', { message: 'You already claimed comp-off for that day' })
  const { day, days } = await checkDay(viewer.employeeId, input.workDate)
  const summary = `Comp-off - ${dateText(input.workDate)} (${day.holiday ?? 'weekly off'}): worked ${hoursText(day.workedMinutes)}${day.inAt ? ` (${day.inAt}-${day.outAt ?? '?'})` : ''}, ${days === 1 ? '1 day' : 'half a day'}`
  const created = await prisma.$transaction(async (tx) => {
    // one claim of this employee at a time, checked again now that the one before (a double click) is saved
    await compOffRepository.lockEmployee(viewer.employeeId, tx)
    if (await compOffRepository.findOpen(viewer.employeeId, input.workDate, tx)) throw new ORPCError('CONFLICT', { message: 'You already claimed comp-off for that day' })
    const approval = await approvalsService.raiseRequest({ feature: 'COMP_OFF', kinds: ['COMP_OFF'], employeeId: viewer.employeeId, requestedById: viewer.employeeId, summary }, tx)
    const row = await compOffRepository.create({ employeeId: viewer.employeeId, workDate: input.workDate, days, reason: input.reason, status: 'PENDING', approvalRequestId: approval.id }, viewer.employeeId, tx)
    return { approval, row }
  })
  await approvalsService.finishAndNotify(created.approval.id, created.approval.outcome)
  return (await toClaims([(await compOffRepository.find(created.row.id))!]))[0]!
}

// The employee withdraws a claim still waiting (its approval is cancelled too)
export async function cancel(viewer: CurrentUser, id: number) {
  const row = await compOffRepository.find(id)
  if (!row || row.employeeId !== viewer.employeeId) throw new ORPCError('NOT_FOUND', { message: `No comp-off claim with id ${id}` })
  if (row.status !== 'PENDING') throw new ORPCError('CONFLICT', { message: 'This claim is already decided' })
  await approvalsService.cancel(viewer, { id: row.approvalRequestId })
  return (await toClaims([(await compOffRepository.find(id))!]))[0]!
}

export async function listMine(viewer: CurrentUser) {
  return toClaims(await compOffRepository.listByEmployee(viewer.employeeId, 50))
}

// --- The approval's decision (the approval service calls these) ---

async function recordOf(requestId: number, db?: DbClient) {
  const record = await compOffRepository.findByApprovalRequestId(requestId, db)
  if (!record) throw new Error(`No comp-off claim for approval request ${requestId}`)
  return record
}

approvalsService.registerFeature('COMP_OFF', {
  label: 'Comp-off claim',
  // approved: the hours are counted again and the days credited to the comp-off type, expiring 90 days after the day worked
  // (at least 30 days from today - expiresOn)
  onApproved: async (requestId, actorId, tx) => {
    const record = await recordOf(requestId, tx)
    const type = await typesService.compOffType()
    if (!type) throw new ORPCError('CONFLICT', { message: 'No leave type receives comp-off - ask HR to tick one on Team leave > Leave types' })
    const { days } = await checkDay(record.employeeId, record.workDate)
    await balancesRepository.addEntries(
      [{ employeeId: record.employeeId, leaveTypeId: type.id, kind: 'COMP_OFF', days, effectiveDate: record.workDate, expiresOn: expiresOn(record.workDate, today()), compOffClaimId: record.id }],
      actorId,
      tx,
    )
    await compOffRepository.update(record.id, { status: 'APPROVED', days }, actorId, tx)
  },
  onRejected: async (requestId, actorId, tx) => {
    await compOffRepository.update((await recordOf(requestId, tx)).id, { status: 'REJECTED' }, actorId, tx)
  },
  onCancelled: async (requestId, actorId, tx) => {
    await compOffRepository.update((await recordOf(requestId, tx)).id, { status: 'CANCELLED' }, actorId, tx)
  },
  // HR's view: Leave View covering the employee sees it, Leave Edit may cancel one still waiting
  canView: (viewer, placement) => hasLevelAt(viewer, 'LEAVE', placement, 'READ'),
  canCancel: (viewer, placement) => hasLevelAt(viewer, 'LEAVE', placement, 'WRITE'),
  link: () => '/leave',
})
