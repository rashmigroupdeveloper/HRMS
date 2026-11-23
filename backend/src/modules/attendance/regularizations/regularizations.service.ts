import { hasLevelAt, SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { addDays, dayKey, eachDay } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as regularizationsRepository from './regularizations.repository.js'
import type { createRegularizationInput } from './regularizations.schema.js'

// Regularization / on-duty requests (attendance, 2026-11-22 - the old HRMS's "attendance regularisation" and "official
// duty"; its "short permission" waits - BACKLOG). An employee asks:
// - MISSED_PUNCH: a day already come with a missed / forgotten punch counts as present (the whole day or one half);
// - ON_DUTY: days of work outside the office (to come too) count as on duty.
// Approved through the approval service (kinds REGULARIZATION / ON_DUTY - seeded: the reporting manager, 48 h, then their
// manager). Approved, the working halves it covers take that status when the days are worked out (HR's correction still
// wins); weekly offs and holidays inside stay so. Rules as the old HRMS: at most 30 days back; no day of a locked month;
// nothing already asked or on leave for the same half. Better than the old HRMS: the employee can withdraw a request still
// waiting.

// how far back a request may go (old HRMS att.ar_max_past_days)
export const MAX_DAYS_BACK = 30
// the longest request (the old HRMS had none - a guard against a typing slip such as a wrong year)
const MAX_DAYS = 31

const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }
const fullName = (e: { firstName: string; middleName: string | null; lastName: string | null }) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
const dateText = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const KIND_LABEL = { MISSED_PUNCH: 'Missed punch', ON_DUTY: 'On duty' } as const
const PORTION_TEXT = { FULL_DAY: '', FIRST_HALF: ' (first half)', SECOND_HALF: ' (second half)' } as const

// "Missed punch - Mon, 01 Dec 2026 (first half)" / "On duty - Mon, 01 Dec 2026 to Wed, 03 Dec 2026" - the approval's summary
function describe(r: { kind: 'MISSED_PUNCH' | 'ON_DUTY'; fromDate: Date; toDate: Date; portion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' }) {
  const days = r.fromDate.getTime() === r.toDate.getTime() ? dateText(r.fromDate) : `${dateText(r.fromDate)} to ${dateText(r.toDate)}`
  return `${KIND_LABEL[r.kind]} - ${days}${PORTION_TEXT[r.portion]}`
}

// For the API: the request with where its approval stands (who has it)
async function toRequests(rows: regularizationsRepository.RequestRow[]) {
  const approvals = await approvalsService.statusOf(rows.map((r) => r.approvalRequestId))
  return rows.map((r) => ({
    id: r.id,
    employee: { employeeCode: r.employee.employeeCode, name: fullName(r.employee) },
    kind: r.kind,
    fromDate: r.fromDate,
    toDate: r.toDate,
    portion: r.portion,
    reason: r.reason,
    status: r.status,
    approvalRequestId: r.approvalRequestId,
    approval: approvals.get(r.approvalRequestId) ?? null,
    createdAt: r.createdAt,
  }))
}

// The halves a request asks for
const halvesAsked = (input: { fromDate: Date; toDate: Date; portion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' }) =>
  daysService.halvesOf(input.fromDate, input.toDate, input.portion === 'SECOND_HALF' ? 'SECOND' : 'FIRST', input.portion === 'FIRST_HALF' ? 'FIRST' : 'SECOND')

export async function createRequest(viewer: CurrentUser, input: z.infer<typeof createRegularizationInput>) {
  const now = today()
  if (input.fromDate < addDays(now, -MAX_DAYS_BACK)) throw new ORPCError('BAD_REQUEST', { message: `A request can go back at most ${MAX_DAYS_BACK} days` })
  if (input.kind === 'MISSED_PUNCH' && input.toDate > now) throw new ORPCError('BAD_REQUEST', { message: 'A missed punch is for a day already come - for work outside the office ask for on duty' })
  if (eachDay(input.fromDate, input.toDate).length > MAX_DAYS) throw new ORPCError('BAD_REQUEST', { message: `A request is for at most ${MAX_DAYS} days` })
  await daysService.assertOpenDays(eachDay(input.fromDate, input.toDate))
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [viewer.employeeId], ...EVER })
  if (!person || input.fromDate < person.dateOfJoining || (person.dateOfLeaving && input.toDate > person.dateOfLeaving)) {
    throw new ORPCError('BAD_REQUEST', { message: 'You are not employed on every one of those days' })
  }
  // only working halves are changed - at least one must be asked for
  const plans = (await daysService.loadPlans([person], input.fromDate, input.toDate)).get(person.id)!
  const halves = halvesAsked(input)
  const working = halves.filter(({ date, half }) => {
    const plan = plans.get(dayKey(date))
    return plan?.kind === 'WORK' && !(plan.halfDay && half === 'SECOND')
  })
  if (!working.length) throw new ORPCError('BAD_REQUEST', { message: 'Those are weekly offs or holidays - there is nothing to regularize' })
  // nothing asked twice for the same half: leave (approved or waiting) or another request (approved or waiting)
  const taken = await daysService.loadCovers([person.id], input.fromDate, input.toDate, { pending: true })
  const clash = working.find(({ date, half }) => taken.get(`${person.id}:${dayKey(date)}`)?.some((c) => c.half === half))
  if (clash) {
    const what = taken.get(`${person.id}:${dayKey(clash.date)}`)!.find((c) => c.half === clash.half)!
    throw new ORPCError('CONFLICT', { message: `${dateText(clash.date)} already has ${what.status === 'LEAVE' ? 'leave' : 'a request'} (${what.label}) - withdraw that first` })
  }
  const summary = describe(input)
  const created = await prisma.$transaction(async (tx) => {
    const approval = await approvalsService.raiseRequest(
      { feature: 'REGULARIZATION', kinds: [input.kind === 'ON_DUTY' ? 'ON_DUTY' : 'REGULARIZATION'], employeeId: viewer.employeeId, requestedById: viewer.employeeId, summary },
      tx,
    )
    const request = await regularizationsRepository.create(
      { employeeId: viewer.employeeId, kind: input.kind, fromDate: input.fromDate, toDate: input.toDate, portion: input.portion, reason: input.reason, status: 'PENDING', approvalRequestId: approval.id },
      viewer.employeeId,
      tx,
    )
    return { approval, request }
  })
  await approvalsService.finishAndNotify(created.approval.id, created.approval.outcome)
  return (await toRequests([(await regularizationsRepository.find(created.request.id))!]))[0]!
}

// The employee withdraws a request still waiting (its approval is cancelled too)
export async function cancelRequest(viewer: CurrentUser, id: number) {
  const request = await regularizationsRepository.find(id)
  if (!request || request.employeeId !== viewer.employeeId) throw new ORPCError('NOT_FOUND', { message: `No request with id ${id}` })
  if (request.status !== 'PENDING') throw new ORPCError('CONFLICT', { message: 'This request is already decided' })
  await approvalsService.cancel(viewer, { id: request.approvalRequestId })
  return (await toRequests([(await regularizationsRepository.find(id))!]))[0]!
}

export async function listMine(viewer: CurrentUser) {
  return toRequests(await regularizationsRepository.listByEmployee(viewer.employeeId, 50))
}

// --- The approval's decision (the approval service calls these) ---

async function recordOf(requestId: number, db?: DbClient) {
  const record = await regularizationsRepository.findByApprovalRequestId(requestId, db)
  if (!record) throw new Error(`No regularization request for approval request ${requestId}`)
  return record
}

approvalsService.registerFeature('REGULARIZATION', {
  label: 'Regularization / on duty',
  onApproved: async (requestId, actorId, tx) => {
    const request = await recordOf(requestId, tx)
    // a month locked meanwhile: the approval is refused (nothing changes)
    await daysService.assertOpenDays(eachDay(request.fromDate, request.toDate))
    await regularizationsRepository.update(request.id, { status: 'APPROVED' }, actorId, tx)
  },
  onRejected: async (requestId, actorId, tx) => {
    await regularizationsRepository.update((await recordOf(requestId, tx)).id, { status: 'REJECTED' }, actorId, tx)
  },
  onCancelled: async (requestId, actorId, tx) => {
    await regularizationsRepository.update((await recordOf(requestId, tx)).id, { status: 'CANCELLED' }, actorId, tx)
  },
  // after it is saved: the days already come are worked out again (days to come show it as they are read)
  afterClosed: async (requestId, status) => {
    if (status !== 'APPROVED') return
    const request = await recordOf(requestId)
    if (request.fromDate <= today()) await daysService.recompute([request.employeeId], request.fromDate, request.toDate)
  },
  // HR's view: Attendance View covering the employee sees it, Attendance Edit may cancel it
  canView: (viewer, placement) => hasLevelAt(viewer, 'ATTENDANCE', placement, 'READ'),
  canCancel: (viewer, placement) => hasLevelAt(viewer, 'ATTENDANCE', placement, 'WRITE'),
  link: () => '/attendance',
})
