import { hasLevelAt } from '#core/auth/scope'
import { prisma, type DbClient, type LeaveStatus } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { employeesService } from '#modules/employees'
import { attendanceService } from '#modules/attendance'
import { today } from '#shared/utils/dates'
import { dayKey, eachDay } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as balancesService from '../balances/balances.service.js'
import * as balancesRepository from '../balances/balances.repository.js'
import * as leaveService from '../leave.service.js'
import * as typesService from '../types/types.service.js'
import * as applicationsRepository from './applications.repository.js'
import type { applyInput, cancelInput, listInput, previewInput } from './applications.schema.js'

// Leave applications (2026-11-22 - the old HRMS's lv.applications and its rules):
// - The days are counted from the attendance plan: each working half is 0.5 (a half-day weekday such as RML's Saturday
//   counts its first half only); weekly offs and holidays inside count only for a type that counts them (the "sandwich"
//   rule - EL, ML), and stay weekly off / holiday on the attendance days.
// - Refused (old HRMS): a type that does not apply to the employee (gender, employment type) or is retired; half days on a
//   type without them; days when they are not employed; a day of a locked attendance month; any half already on leave or
//   asked for (leave, a regularization, on duty - approved or waiting); more days than the type allows at once; more than
//   the balance less what already waits (paid types - leave without pay has no balance). No limit on how far back or
//   ahead (old HRMS: only the month lock).
// - Approved through the approval service (kind LEAVE - seeded: the reporting manager, 48 h, then their manager). When
//   approved, the days are counted again (a holiday / shift changed meanwhile: refused - apply again) and the balance must
//   still cover them; the days are taken from the balance and the attendance days show the leave.
// - Withdrawn by the employee while it waits; an approved leave is cancelled through approval of its own (LEAVE_CANCEL,
//   old HRMS) - when approved the days come back and the attendance days are worked out again.

const MAX_SPAN_DAYS = 366
const round1 = (n: number) => Math.round(n * 10) / 10 + 0
const fullName = (e: { firstName: string; middleName: string | null; lastName: string | null }) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
const dateText = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

type Days = z.infer<typeof previewInput>
type Problem = { code: 'BAD_REQUEST' | 'CONFLICT'; message: string }

const halvesOfLeave = (v: Pick<Days, 'fromDate' | 'toDate' | 'fromSecondHalf' | 'toFirstHalf'>) =>
  attendanceService.halvesOf(v.fromDate, v.toDate, v.fromSecondHalf ? 'SECOND' : 'FIRST', v.toFirstHalf ? 'FIRST' : 'SECOND')

// The leave days the request takes (by the attendance plan), or why it cannot be counted
async function countDays(employeeId: number, type: typesService.LeaveType, v: Days) {
  const plan = await attendanceService.planDays(employeeId, v.fromDate, v.toDate)
  if (!plan.length || plan.some((d) => !d.employed)) return { days: 0, problem: 'You are not employed on every one of those days' }
  const planOf = new Map(plan.map((d) => [dayKey(d.date), d]))
  let halves = 0
  for (const { date, half } of halvesOfLeave(v)) {
    const day = planOf.get(dayKey(date))!
    const working = day.kind === 'WORK' && !(day.halfDay && half === 'SECOND')
    if (working || type.countsOffDays) halves++
  }
  return { days: halves / 2, problem: null }
}

// Every rule an application must meet (create and preview); the days it takes and the balance
async function check(employeeId: number, v: Days) {
  const problems: Problem[] = []
  const person = await leaveService.findPerson(employeeId)
  if (!person) throw new ORPCError('NOT_FOUND', { message: 'No such employee' })
  const type = await typesService.getType(v.leaveTypeId)
  if (!type.isActive) problems.push({ code: 'BAD_REQUEST', message: `${type.name} is no longer used` })
  if (!leaveService.typeAppliesTo(type, person)) problems.push({ code: 'BAD_REQUEST', message: `${type.name} does not apply to you` })
  if (!type.allowHalfDay && (v.fromSecondHalf || v.toFirstHalf)) problems.push({ code: 'BAD_REQUEST', message: `${type.name} is taken in whole days only` })
  if (eachDay(v.fromDate, v.toDate).length > MAX_SPAN_DAYS) problems.push({ code: 'BAD_REQUEST', message: `A leave is for at most ${MAX_SPAN_DAYS} days` })
  if (problems.length) return { person, type, days: 0, balance: null, problems }
  const counted = await countDays(employeeId, type, v)
  if (counted.problem) problems.push({ code: 'BAD_REQUEST', message: counted.problem })
  else if (counted.days <= 0) problems.push({ code: 'BAD_REQUEST', message: 'Those are weekly offs or holidays - no leave is needed' })
  if (type.maxPerRequest !== null && counted.days > type.maxPerRequest) problems.push({ code: 'BAD_REQUEST', message: `${type.name} is at most ${daysText(type.maxPerRequest)} at a time` })
  try {
    await attendanceService.assertOpenDays(eachDay(v.fromDate, v.toDate))
  } catch (error) {
    problems.push({ code: 'CONFLICT', message: error instanceof Error ? error.message : 'A locked attendance month' })
  }
  // nothing twice on the same half: leave or a regularization / on-duty request, approved or waiting
  const taken = await attendanceService.loadCovers([employeeId], v.fromDate, v.toDate, { pending: true })
  const clash = halvesOfLeave(v).find(({ date, half }) => taken.get(`${employeeId}:${dayKey(date)}`)?.some((c) => c.half === half))
  if (clash) {
    const what = taken.get(`${employeeId}:${dayKey(clash.date)}`)!.find((c) => c.half === clash.half)!
    problems.push({ code: 'CONFLICT', message: `${dateText(clash.date)} already has ${what.status === 'LEAVE' ? `leave (${what.label})` : `a request (${what.label})`}` })
  }
  const balance = await balancesService.availableOf(employeeId, type)
  if (balance && counted.days > balance.available && !counted.problem) {
    problems.push({ code: 'CONFLICT', message: `Not enough ${type.code}: ${balance.available} available${balance.pending ? ` (${balance.pending} waiting for approval)` : ''}, ${counted.days} asked` })
  }
  return { person, type, days: counted.days, balance, problems }
}

// The team coverage warning (the old HRMS's - a warning, never a block; 2026-11-22): the employee's teammates (the same
// reporting manager) with leave approved or asked for overlapping from..to - their name and days only (no type, no reason)
async function teamOff(person: { id: number; reportingManagerId: number | null }, from: Date, to: Date) {
  const ids = await employeesService.listTeammateIds(person.id, person.reportingManagerId)
  const rows = await applicationsRepository.listForEmployees(ids, from, to, ['PENDING', 'APPROVED'])
  return rows.map((r) => ({
    employee: { employeeCode: r.employee.employeeCode, name: fullName(r.employee) },
    fromDate: r.fromDate,
    toDate: r.toDate,
    fromSecondHalf: r.fromSecondHalf,
    toFirstHalf: r.toFirstHalf,
    waiting: r.status === 'PENDING',
  }))
}

// What the leave would take, before applying: the days, the balance after it, anything that would stop it, and who of the
// team is away then
export async function preview(viewer: CurrentUser, input: Days) {
  const result = await check(viewer.employeeId, input)
  return {
    teamOff: await teamOff(result.person, input.fromDate, input.toDate),
    days: result.days,
    // null: leave without pay (no balance)
    available: result.balance?.available ?? null,
    after: result.balance ? round1(result.balance.available - result.days) : null,
    problems: result.problems.map((p) => p.message),
  }
}

// For the API: the leave, its type, where its approval stands (and its cancelling's)
async function toApplications(rows: applicationsRepository.ApplicationRow[]) {
  const approvals = await approvalsService.statusOf(rows.flatMap((r) => [r.approvalRequestId, ...(r.cancelApprovalRequestId ? [r.cancelApprovalRequestId] : [])]))
  return rows.map((r) => {
    const cancelling = r.cancelApprovalRequestId ? (approvals.get(r.cancelApprovalRequestId) ?? null) : null
    return {
      id: r.id,
      employee: { employeeCode: r.employee.employeeCode, name: fullName(r.employee) },
      leaveType: r.leaveType,
      fromDate: r.fromDate,
      toDate: r.toDate,
      fromSecondHalf: r.fromSecondHalf,
      toFirstHalf: r.toFirstHalf,
      days: r.days.toNumber(),
      reason: r.reason,
      status: r.status,
      approvalRequestId: r.approvalRequestId,
      approval: approvals.get(r.approvalRequestId) ?? null,
      // the request to cancel it after approval (its latest), and why
      cancelRequest: cancelling && { approvalRequestId: r.cancelApprovalRequestId!, ...cancelling },
      cancelReason: r.cancelReason,
      createdAt: r.createdAt,
    }
  })
}

// "Casual leave (CL), 2 days: Mon, 01 Dec 2026 to Tue, 02 Dec 2026" - the approval's summary
function describe(type: { code: string; name: string }, v: Days & { days: number }) {
  const from = `${dateText(v.fromDate)}${v.fromSecondHalf ? ' (second half)' : ''}`
  const to = `${dateText(v.toDate)}${v.toFirstHalf ? ' (first half)' : ''}`
  const span = v.fromDate.getTime() === v.toDate.getTime() ? `${dateText(v.fromDate)}${v.fromSecondHalf ? ' (second half)' : v.toFirstHalf ? ' (first half)' : ''}` : `${from} to ${to}`
  return `${type.name} (${type.code}), ${daysText(v.days)}: ${span}`
}

export async function apply(viewer: CurrentUser, input: z.infer<typeof applyInput>) {
  const result = await check(viewer.employeeId, input)
  const problem = result.problems[0]
  if (problem) throw new ORPCError(problem.code, { message: problem.message })
  const summary = describe(result.type, { ...input, days: result.days })
  const created = await prisma.$transaction(async (tx) => {
    const approval = await approvalsService.raiseRequest({ feature: 'LEAVE', kinds: ['LEAVE'], employeeId: viewer.employeeId, requestedById: viewer.employeeId, summary }, tx)
    const application = await applicationsRepository.create(
      {
        employeeId: viewer.employeeId,
        leaveTypeId: result.type.id,
        fromDate: input.fromDate,
        toDate: input.toDate,
        fromSecondHalf: input.fromSecondHalf,
        toFirstHalf: input.toFirstHalf,
        days: result.days,
        reason: input.reason,
        status: 'PENDING',
        approvalRequestId: approval.id,
      },
      viewer.employeeId,
      tx,
    )
    return { approval, application }
  })
  await approvalsService.finishAndNotify(created.approval.id, created.approval.outcome)
  return (await toApplications([(await applicationsRepository.find(created.application.id))!]))[0]!
}

// The employee withdraws a leave still waiting (at once), or asks to cancel an approved one (through approval, with a reason)
export async function cancel(viewer: CurrentUser, { id, reason }: z.infer<typeof cancelInput>) {
  const application = await applicationsRepository.find(id)
  if (!application || application.employeeId !== viewer.employeeId) throw new ORPCError('NOT_FOUND', { message: `No leave with id ${id}` })
  if (application.status === 'PENDING') {
    await approvalsService.cancel(viewer, { id: application.approvalRequestId, ...(reason && { reason }) })
  } else if (application.status === 'APPROVED') {
    if (!reason || reason.length < 3) throw new ORPCError('BAD_REQUEST', { message: 'Say why you want to cancel the approved leave' })
    if (application.cancelApprovalRequestId) {
      const [current] = (await approvalsService.statusOf([application.cancelApprovalRequestId])).values()
      if (current?.status === 'PENDING') throw new ORPCError('CONFLICT', { message: 'You already asked to cancel this leave - it is waiting for approval' })
    }
    await attendanceService.assertOpenDays(eachDay(application.fromDate, application.toDate))
    const summary = `Cancel ${describe(application.leaveType, { ...application, days: application.days.toNumber() })}`
    const raised = await prisma.$transaction(async (tx) => {
      const approval = await approvalsService.raiseRequest({ feature: 'LEAVE', kinds: ['LEAVE_CANCEL'], employeeId: viewer.employeeId, requestedById: viewer.employeeId, summary }, tx)
      await applicationsRepository.update(application.id, { cancelApprovalRequestId: approval.id, cancelReason: reason }, viewer.employeeId, tx)
      return approval
    })
    await approvalsService.finishAndNotify(raised.id, raised.outcome)
  } else throw new ORPCError('CONFLICT', { message: 'This leave was rejected or cancelled already' })
  return (await toApplications([(await applicationsRepository.find(id))!]))[0]!
}

export async function listMine(viewer: CurrentUser) {
  return toApplications(await applicationsRepository.listByEmployee(viewer.employeeId, 100))
}

// The leave of the viewer's team / department / everyone they may see (Leave View) overlapping from..to - who is away
export async function list(viewer: CurrentUser, { from, to, statuses, ...filter }: z.infer<typeof listInput>) {
  if (to < from) throw new ORPCError('BAD_REQUEST', { message: 'The last day is before the first' })
  const people = await leaveService.peopleInScope(viewer, filter, from, to)
  const rows = await applicationsRepository.listForEmployees(
    people.map((p) => p.id),
    from,
    to,
    statuses?.length ? statuses : (['PENDING', 'APPROVED'] as LeaveStatus[]),
  )
  return toApplications(rows)
}

// The leave behind an approval request, for the people who may see that request (its approvers...): the leave and the
// employee's balance of its type now
export async function getForApproval(viewer: CurrentUser, approvalRequestId: number) {
  const application = await applicationsRepository.findByApprovalRequestId(approvalRequestId)
  if (!application || !(await approvalsService.canSeeRequest(viewer, approvalRequestId))) throw new ORPCError('NOT_FOUND', { message: 'No such leave' })
  const [view] = await toApplications([application])
  const [balance, person] = await Promise.all([balancesService.availableOf(application.employeeId, application.leaveType), leaveService.findPerson(application.employeeId)])
  // who else of the employee's team is away then (not the leave itself)
  const away = person ? (await teamOff(person, application.fromDate, application.toDate)) : []
  return { ...view!, isCancelRequest: application.cancelApprovalRequestId === approvalRequestId, balance, teamOff: away }
}

// --- The approval's decision (the approval service calls these) ---

async function recordOf(requestId: number, db?: DbClient) {
  const record = await applicationsRepository.findByApprovalRequestId(requestId, db)
  if (!record) throw new Error(`No leave application for approval request ${requestId}`)
  return { record, isCancel: record.cancelApprovalRequestId === requestId }
}

approvalsService.registerFeature('LEAVE', {
  label: 'Leave',
  onApproved: async (requestId, actorId, tx) => {
    const { record, isCancel } = await recordOf(requestId, tx)
    // a month locked meanwhile: the approval is refused (nothing changes)
    await attendanceService.assertOpenDays(eachDay(record.fromDate, record.toDate))
    const days = record.days.toNumber()
    if (isCancel) {
      if (record.leaveType.isPaid) {
        await balancesRepository.addEntries([{ employeeId: record.employeeId, leaveTypeId: record.leaveTypeId, kind: 'RETURNED', days, effectiveDate: record.fromDate, applicationId: record.id }], actorId, tx)
      }
      await applicationsRepository.update(record.id, { status: 'CANCELLED' }, actorId, tx)
      return
    }
    // counted again: a holiday or shift changed meanwhile would make it another leave (old HRMS: send it back)
    const type = await typesService.getType(record.leaveTypeId)
    const counted = await countDays(record.employeeId, type, { ...record, leaveTypeId: record.leaveTypeId })
    if (counted.problem || counted.days !== days) {
      throw new ORPCError('CONFLICT', { message: `This leave now counts ${daysText(counted.days)}, not ${daysText(days)} (the holidays or shifts changed) - reject it and ask the employee to apply again` })
    }
    if (type.isPaid) {
      const sums = await balancesRepository.sumBalances([record.employeeId], undefined, tx)
      const balance = sums.find((s) => s.leaveTypeId === type.id)?.days ?? 0
      if (balance < days) throw new ORPCError('CONFLICT', { message: `Not enough ${type.code} left: ${balance}, the leave takes ${days}` })
      await balancesRepository.addEntries([{ employeeId: record.employeeId, leaveTypeId: type.id, kind: 'TAKEN', days: -days, effectiveDate: record.fromDate, applicationId: record.id }], actorId, tx)
    }
    await applicationsRepository.update(record.id, { status: 'APPROVED' }, actorId, tx)
  },
  // a cancel request rejected / withdrawn: the leave stays approved
  onRejected: async (requestId, actorId, tx) => {
    const { record, isCancel } = await recordOf(requestId, tx)
    if (!isCancel) await applicationsRepository.update(record.id, { status: 'REJECTED' }, actorId, tx)
  },
  onCancelled: async (requestId, actorId, tx) => {
    const { record, isCancel } = await recordOf(requestId, tx)
    if (!isCancel) await applicationsRepository.update(record.id, { status: 'CANCELLED' }, actorId, tx)
  },
  // after it is saved: the days already come are worked out again (days to come show the leave as they are read)
  afterClosed: async (requestId, status) => {
    if (status !== 'APPROVED') return
    const { record } = await recordOf(requestId)
    if (record.fromDate <= today()) await attendanceService.recompute([record.employeeId], record.fromDate, record.toDate)
  },
  // HR's view: Leave View covering the employee sees it, Leave Edit may cancel one still waiting
  canView: (viewer, placement) => hasLevelAt(viewer, 'LEAVE', placement, 'READ'),
  canCancel: (viewer, placement) => hasLevelAt(viewer, 'LEAVE', placement, 'WRITE'),
  link: () => '/leave',
})

// --- The leave on the attendance days (attendance asks for it - registered once, when this loads) ---

// data access: attendance asks for the employees it works out / shows - it chose them
attendanceService.registerLeaveCovers(async (employeeIds, from, to, { pending }) => {
  const rows = await applicationsRepository.listForEmployees(employeeIds, from, to, pending ? ['APPROVED', 'PENDING'] : ['APPROVED'])
  return rows.flatMap((r) =>
    halvesOfLeave(r)
      .filter(({ date }) => date >= from && date <= to)
      .map(({ date, half }) => ({ employeeId: r.employeeId, date, half, status: 'LEAVE' as const, code: r.leaveType.code, label: r.leaveType.name })),
  )
})
