import { hasLevelAt, SYSTEM_SCOPE } from '#core/auth/scope'
import { env } from '#core/config/env'
import { prisma, type ActorId, type DbClient } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { dayKey } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as rostersService from '../rosters/rosters.service.js'
import * as shiftsService from '../shifts/shifts.service.js'
import * as shiftChangesRepository from './shift-changes.repository.js'
import type { createShiftChangeInput } from './shift-changes.schema.js'

// Shift-change requests (attendance, 2026-11-16): an employee asks to change one day - another shift or off - or to swap
// it with a colleague. Approved through the approval service (2026-11-22 - the user: every approval goes through it; kind
// SHIFT_CHANGE, its chain on the Approval rules page, seeded as before: reporting manager -> Attendance: Edit). Only when
// it is approved does the roster day change (published at once; a day already come is worked out again). In a swap the
// colleague is told - both days change. Nobody decides their own request (the approval service).

const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }
const fullName = (e: { firstName: string; middleName: string | null; lastName: string | null }) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
const dateText = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

// The shift an employee has on a day now (null = off / holiday) - what a swap exchanges
async function shiftOn(employeeId: number, date: Date) {
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employeeId], ...EVER })
  if (!person) return { employed: false, shiftId: null as number | null, kind: 'WEEKLY_OFF' as const }
  const plan = (await daysService.loadPlans([person], date, date)).get(person.id)!.get(dayKey(date))!
  const employed = date >= person.dateOfJoining && (!person.dateOfLeaving || date <= person.dateOfLeaving)
  return { employed, shiftId: plan.kind === 'WORK' ? (plan.shift?.id ?? null) : null, kind: plan.kind }
}

// For the API: the people as { employeeCode, name }, the shift asked for, and where its approval stands (who has it)
async function toRequests(rows: shiftChangesRepository.RequestRow[]) {
  const approvals = await approvalsService.statusOf(rows.map((r) => r.approvalRequestId))
  return rows.map((r) => ({
    id: r.id,
    employee: { employeeCode: r.employee.employeeCode, name: fullName(r.employee) },
    date: r.date,
    kind: r.kind,
    requestedShift: r.requestedShift,
    swapWith: r.swapWith ? { employeeCode: r.swapWith.employeeCode, name: fullName(r.swapWith) } : null,
    reason: r.reason,
    status: r.status,
    approvalRequestId: r.approvalRequestId,
    approval: approvals.get(r.approvalRequestId) ?? null,
    createdAt: r.createdAt,
  }))
}

// "Mon, 01 Dec 2026: Night shift" / "swap Mon, 01 Dec 2026 with Meena Das" - the approval request's summary
function describe(r: { date: Date; kind: 'CHANGE' | 'SWAP'; requestedShift: { name: string } | null; swapWith: { firstName: string; middleName: string | null; lastName: string | null } | null }) {
  return r.kind === 'SWAP'
    ? `swap ${dateText(r.date)} with ${r.swapWith ? fullName(r.swapWith) : 'a colleague'}`
    : `${dateText(r.date)}: ${r.requestedShift ? `${r.requestedShift.name} shift` : 'off'}`
}

async function mail(to: { email: string | null; name: string } | null | undefined, subject: string, lines: string[]) {
  if (!to?.email) return
  await sendMail({ to: to.email, subject, text: [`Dear ${to.name},`, '', ...lines, '', `Attendance: ${env.APP_URL}/attendance`].join('\n') }).catch((error: unknown) =>
    console.error('[mail] shift change e-mail failed:', error),
  )
}

// The employee asks (today onwards; not a holiday; one open request per day) - the request goes for approval
export async function createRequest(viewer: CurrentUser, input: z.infer<typeof createShiftChangeInput>) {
  if (input.date < today()) throw new ORPCError('BAD_REQUEST', { message: 'A shift change is for today or a day to come' })
  await daysService.assertOpenDays([input.date])
  const mine = await shiftOn(viewer.employeeId, input.date)
  if (!mine.employed) throw new ORPCError('BAD_REQUEST', { message: 'You are not employed on that day' })
  if (mine.kind === 'HOLIDAY') throw new ORPCError('BAD_REQUEST', { message: 'That day is a holiday' })
  if (await shiftChangesRepository.findOpen(viewer.employeeId, input.date)) throw new ORPCError('CONFLICT', { message: 'You already asked for a change on that day' })
  let swapWithEmployeeId: number | null = null
  let requestedShift: { id: number; name: string } | null = null
  if (input.kind === 'CHANGE') {
    const requested = input.requestedShiftId ?? null
    if (requested !== null) {
      requestedShift = (await shiftsService.listShifts(viewer, false)).find((s) => s.id === requested) ?? null
      if (!requestedShift) throw new ORPCError('BAD_REQUEST', { message: 'That shift does not exist or is retired' })
    }
    if (requested === mine.shiftId) throw new ORPCError('BAD_REQUEST', { message: 'That is already your shift on that day' })
  } else {
    swapWithEmployeeId = (await employeesService.mapCodesToIds([input.swapWithCode!])).get(input.swapWithCode!) ?? null
    if (!swapWithEmployeeId) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${input.swapWithCode}` })
    if (swapWithEmployeeId === viewer.employeeId) throw new ORPCError('BAD_REQUEST', { message: 'Pick a colleague, not yourself' })
    const theirs = await shiftOn(swapWithEmployeeId, input.date)
    if (!theirs.employed || theirs.kind === 'HOLIDAY') throw new ORPCError('BAD_REQUEST', { message: 'Your colleague is not working on that day' })
    if (theirs.shiftId === mine.shiftId) throw new ORPCError('BAD_REQUEST', { message: 'You and your colleague have the same shift that day' })
  }
  const [colleague] = swapWithEmployeeId ? await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [swapWithEmployeeId], ...EVER }) : []
  const summary = `Shift change - ${describe({ date: input.date, kind: input.kind, requestedShift, swapWith: colleague ?? null })}`
  const created = await prisma.$transaction(async (tx) => {
    const approval = await approvalsService.raiseRequest({ feature: 'SHIFT_CHANGE', kinds: ['SHIFT_CHANGE'], employeeId: viewer.employeeId, requestedById: viewer.employeeId, summary }, tx)
    const request = await shiftChangesRepository.create(
      {
        employeeId: viewer.employeeId,
        date: input.date,
        kind: input.kind,
        requestedShiftId: input.kind === 'CHANGE' ? (input.requestedShiftId ?? null) : null,
        swapWithEmployeeId,
        reason: input.reason,
        status: 'PENDING',
        approvalRequestId: approval.id,
      },
      viewer.employeeId,
      tx,
    )
    return { approval, request }
  })
  await approvalsService.finishAndNotify(created.approval.id, created.approval.outcome)
  const fresh = await shiftChangesRepository.find(created.request.id)
  return (await toRequests([fresh!]))[0]!
}

// The employee takes back a request still waiting (its approval is cancelled too)
export async function cancelRequest(viewer: CurrentUser, id: number) {
  const request = await shiftChangesRepository.find(id)
  if (!request || request.employeeId !== viewer.employeeId) throw new ORPCError('NOT_FOUND', { message: `No request with id ${id}` })
  if (request.status !== 'PENDING') throw new ORPCError('CONFLICT', { message: 'This request is already decided' })
  await approvalsService.cancel(viewer, { id: request.approvalRequestId })
  return (await toRequests([(await shiftChangesRepository.find(id))!]))[0]!
}

export async function listMine(viewer: CurrentUser) {
  return toRequests(await shiftChangesRepository.listByEmployee(viewer.employeeId, 50))
}

// --- The approval's decision (the approval service calls these) ---

async function recordOf(requestId: number, db?: DbClient) {
  const record = await shiftChangesRepository.findByApprovalRequestId(requestId, db)
  if (!record) throw new Error(`No shift change for approval request ${requestId}`)
  return record
}

approvalsService.registerFeature('SHIFT_CHANGE', {
  label: 'Shift change',
  // approved: the roster day(s) change, in the deciding transaction (a swap exchanges both people's shifts as they are now)
  onApproved: async (requestId, actorId: ActorId, tx) => {
    const request = await recordOf(requestId, tx)
    // its month locked meanwhile: the approval is refused (nothing changes)
    await daysService.assertOpenDays([request.date])
    if (request.kind === 'CHANGE') await rostersService.setPublishedDay(request.employeeId, request.date, request.requestedShiftId, actorId, tx)
    else {
      const mine = await shiftOn(request.employeeId, request.date)
      const theirs = await shiftOn(request.swapWithEmployeeId!, request.date)
      await rostersService.setPublishedDay(request.employeeId, request.date, theirs.shiftId, actorId, tx)
      await rostersService.setPublishedDay(request.swapWithEmployeeId!, request.date, mine.shiftId, actorId, tx)
    }
    await shiftChangesRepository.update(request.id, { status: 'APPROVED' }, actorId, tx)
  },
  onRejected: async (requestId, actorId, tx) => {
    const request = await recordOf(requestId, tx)
    await shiftChangesRepository.update(request.id, { status: 'REJECTED' }, actorId, tx)
  },
  onCancelled: async (requestId, actorId, tx) => {
    const request = await recordOf(requestId, tx)
    await shiftChangesRepository.update(request.id, { status: 'CANCELLED' }, actorId, tx)
  },
  // after it is saved: a day already come is worked out again; the colleague of a swap is told (the requester is told by
  // the approval service)
  afterClosed: async (requestId, status) => {
    if (status !== 'APPROVED') return
    const request = await recordOf(requestId)
    if (request.date <= today()) await daysService.recompute([request.employeeId, ...(request.swapWithEmployeeId ? [request.swapWithEmployeeId] : [])], request.date, request.date)
    if (request.swapWithEmployeeId) {
      await mail(await employeesService.findMailContact(request.swapWithEmployeeId), 'Your shift was swapped', [
        `${fullName(request.employee)} swapped ${dateText(request.date)} with you (approved). Your roster is updated.`,
      ])
    }
  },
  // HR's view: Attendance View covering the employee sees it, Attendance Edit may cancel it
  canView: (viewer, placement) => hasLevelAt(viewer, 'ATTENDANCE', placement, 'READ'),
  canCancel: (viewer, placement) => hasLevelAt(viewer, 'ATTENDANCE', placement, 'WRITE'),
  link: () => '/attendance',
})
