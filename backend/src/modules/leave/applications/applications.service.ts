import { reportFile, reportSheet } from '#core/excel/report'
import { env } from '#core/config/env'
import { hasLevelAt, scopeOf } from '#core/auth/scope'
import { sendMail } from '#core/mail/mailer'
import { prisma, SYSTEM_ACTOR, type DbClient, type LeaveStatus } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { employeesService } from '#modules/employees'
import { attendanceService } from '#modules/attendance'
import { today } from '#shared/utils/dates'
import { addDays, DAY_MS, dayKey, eachDay } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as balancesService from '../balances/balances.service.js'
import * as balancesRepository from '../balances/balances.repository.js'
import * as leaveService from '../leave.service.js'
import * as typesService from '../types/types.service.js'
import * as applicationsRepository from './applications.repository.js'
import type { applyInput, cancelInput, listInput, previewInput, recountInput, recountsInput } from './applications.schema.js'

// Leave applications (2026-11-22 - the old HRMS's lv.applications and its rules):
// - The days are counted from the attendance plan: each working half is 0.5 (a half-day weekday such as RML's Saturday
//   counts its first half only); weekly offs and holidays inside count only for a type that counts them (the "sandwich"
//   rule - EL, ML), and stay weekly off / holiday on the attendance days.
// - Refused (old HRMS): a type that does not apply to the employee (gender, employment type) or is retired; half days on a
//   type without them; days when they are not employed; a day of a locked attendance month; any half already on leave or
//   asked for (leave, a regularization, on duty - approved or waiting); more days than the type allows at once; more than
//   the balance less what already waits (paid types - leave without pay has no balance). When it may be asked for is the
//   type's (the user, 2026-11-24 - HR sets it): at least N calendar days' notice before the first day, only today or days
//   already passed, the first day at most N days back; beyond those, only the month lock (old HRMS). A type "only on its
//   holiday dates" (2026-11-24) is taken on the on-application holidays naming it in the employee's holiday list - every
//   day of the leave one, half days only where the holiday allows; approved, the day is a holiday for them (not leave).
//   Such leave no longer fitting after a holiday or list change is cancelled and its days given back (the employee told).
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
  const isWorking = (date: Date, half: 'FIRST' | 'SECOND') => {
    const day = planOf.get(dayKey(date))!
    // (a half-day holiday's half is off too - 2026-11-24)
    return day.kind === 'WORK' && !(day.halfDay && half === 'SECOND') && day.holidayHalf !== half
  }
  const leaveHalves = halvesOfLeave(v)
  // a leave starts and ends on a working day - never on a weekly off or a holiday (the user, 2026-11-23: a type that
  // counts off days took a day for a leave on a Sunday alone); off days inside follow the type (countsOffDays)
  for (const end of [leaveHalves[0], leaveHalves.at(-1)]) {
    if (end && !isWorking(end.date, end.half)) return { days: 0, problem: `${dateText(end.date)} is a weekly off or a holiday - a leave starts and ends on a working day` }
  }
  let halves = 0
  for (const { date, half } of leaveHalves) if (isWorking(date, half) || type.countsOffDays) halves++
  return { days: halves / 2, problem: null }
}

// When the type may be applied for (the user, 2026-11-24), in calendar days from today (India): the notice before the first
// day (applied on the 1st with 7 days' notice: the 8th is the earliest), only today or days passed, how far back
function timingProblems(type: typesService.LeaveType, v: Pick<Days, 'fromDate' | 'toDate'>): Problem[] {
  const now = today()
  const daysFromNow = (d: Date) => Math.round((d.getTime() - now.getTime()) / DAY_MS)
  const problems: Problem[] = []
  if (type.noticeDays && daysFromNow(v.fromDate) < type.noticeDays) {
    problems.push({ code: 'BAD_REQUEST', message: `${type.name} needs ${daysText(type.noticeDays)}' notice - the earliest first day applied for today is ${dateText(addDays(now, type.noticeDays))}` })
  }
  if (type.todayOrPastOnly && v.toDate > now) problems.push({ code: 'BAD_REQUEST', message: `${type.name} is applied for today or days already passed only` })
  if (type.maxDaysBack !== null && -daysFromNow(v.fromDate) > type.maxDaysBack) {
    problems.push({ code: 'BAD_REQUEST', message: `${type.name} goes back at most ${daysText(type.maxDaysBack)} - the first day can be ${dateText(addDays(now, -type.maxDaysBack))} at the earliest` })
  }
  return problems
}

// A type taken only on its holiday dates (2026-11-24): every day of the leave an on-application holiday naming it in the
// employee's list that day; half of one only where the holiday allows. Refused: says which dates are theirs to take
async function holidayProblems(employeeId: number, type: Pick<typesService.LeaveType, 'id' | 'name'>, v: Pick<Days, 'fromDate' | 'toDate' | 'fromSecondHalf' | 'toFirstHalf'>): Promise<Problem[]> {
  const theirs = (from: Date, to: Date) => attendanceService.onApplicationHolidaysOf(employeeId, from, to).then((hs) => hs.filter((h) => h.leaveTypeId === type.id))
  const byDay = new Map((await theirs(v.fromDate, v.toDate)).map((h) => [dayKey(h.date), h]))
  if (eachDay(v.fromDate, v.toDate).some((d) => !byDay.has(dayKey(d)))) {
    const coming = await theirs(today(), addDays(today(), 366))
    const dates = coming.slice(0, 6).map((h) => `${dateText(h.date)} (${h.name})`)
    return [{ code: 'BAD_REQUEST', message: `${type.name} is taken only on its holiday dates - ${dates.length ? `yours: ${dates.join(', ')}` : 'none is open to you'}` }]
  }
  const whole = [...byDay.values()].find((h) => !h.allowHalfDay)
  if (whole && (v.fromSecondHalf || v.toFirstHalf)) return [{ code: 'BAD_REQUEST', message: `${whole.name} is taken as a whole day` }]
  return []
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
  problems.push(...timingProblems(type, v))
  if (type.holidaysOnly) problems.push(...(await holidayProblems(employeeId, type, v)))
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
    // one application of this employee at a time, checked again now that the one before (a double click) is saved
    await applicationsRepository.lockEmployee(viewer.employeeId, tx)
    const again = (await check(viewer.employeeId, input)).problems[0]
    if (again) throw new ORPCError(again.code, { message: again.message })
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

// An approved leave of a year already ended, of a type that lapses at the year end, is not cancelled or counted again
// (2026-11-23, the review): the year end already lapsed what was above the carry-forward, so days given back would come
// past it - days that lapsed would come back. HR puts such a leave right with an adjustment. Checked when asked and when
// approved (a cancel asked in December may be approved in January).
const yearLapsed = (fromDate: Date, type: Pick<typesService.LeaveType, 'isPaid' | 'maxCarryForward'>) =>
  // the year end job's own rule: a year has ended on 1 January after it
  type.isPaid && type.maxCarryForward !== null && Date.UTC(fromDate.getUTCFullYear() + 1, 0, 1) <= today().getTime()

async function assertNotLapsed(record: { fromDate: Date; leaveTypeId: number }) {
  const type = await typesService.getType(record.leaveTypeId)
  if (!yearLapsed(record.fromDate, type)) return
  throw new ORPCError('CONFLICT', {
    message: `This leave is of ${record.fromDate.getUTCFullYear()}, whose year end has passed (${type.code} above the carry-forward lapsed) - it cannot be cancelled or counted again now; HR puts it right with a balance adjustment`,
  })
}

// The employee withdraws a leave still waiting (at once), or asks to cancel an approved one (through approval, with a reason)
export async function cancel(viewer: CurrentUser, { id, reason }: z.infer<typeof cancelInput>) {
  const application = await applicationsRepository.find(id)
  if (!application || application.employeeId !== viewer.employeeId) throw new ORPCError('NOT_FOUND', { message: `No leave with id ${id}` })
  if (application.status === 'PENDING') {
    await approvalsService.cancel(viewer, { id: application.approvalRequestId, ...(reason && { reason }) })
  } else if (application.status === 'APPROVED') {
    if (!reason || reason.length < 3) throw new ORPCError('BAD_REQUEST', { message: 'Say why you want to cancel the approved leave' })
    const assertNoCancelWaiting = async (record: applicationsRepository.ApplicationRow) => {
      if (!record.cancelApprovalRequestId) return
      const [current] = (await approvalsService.statusOf([record.cancelApprovalRequestId])).values()
      if (current?.status === 'PENDING') throw new ORPCError('CONFLICT', { message: 'You already asked to cancel this leave - it is waiting for approval' })
    }
    await assertNoCancelWaiting(application)
    await assertNotLapsed(application)
    await attendanceService.assertOpenDays(eachDay(application.fromDate, application.toDate))
    const summary = `Cancel ${describe(application.leaveType, { ...application, days: application.days.toNumber() })}`
    const raised = await prisma.$transaction(async (tx) => {
      // one change of this employee's leave at a time, checked again now that the one before is saved (2026-11-23, the
      // review: two cancel requests sent at the same moment both raised an approval)
      await applicationsRepository.lockEmployee(viewer.employeeId, tx)
      const record = await applicationsRepository.find(application.id, tx)
      if (record?.status !== 'APPROVED') throw new ORPCError('CONFLICT', { message: 'This leave was rejected or cancelled already' })
      await assertNoCancelWaiting(record)
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

// --- Approved leave the calendar now counts otherwise (the user, 2026-11-23) ---
// A holiday added on an approved leave day, one removed, a weekly off changed: the leave keeps the days it was approved
// with - never changed on its own (as in Keka, Zoho People and SAP, where it is put right by hand). HR sees these leaves
// and puts each right: days the calendar no longer counts come back to the balance, days it now counts more are taken
// (if the balance has them); the employee is e-mailed.

// The days an approved leave takes by today's calendar - no "starts and ends on a working day" rule, it is approved
// already - and the holidays on it
async function recountOf(employeeId: number, type: Pick<typesService.LeaveType, 'countsOffDays'>, v: Pick<Days, 'fromDate' | 'toDate' | 'fromSecondHalf' | 'toFirstHalf'>) {
  const plan = await attendanceService.planDays(employeeId, v.fromDate, v.toDate)
  const planOf = new Map(plan.map((d) => [dayKey(d.date), d]))
  let halves = 0
  for (const { date, half } of halvesOfLeave(v)) {
    const day = planOf.get(dayKey(date))
    if (day && (type.countsOffDays || (day.kind === 'WORK' && !(day.halfDay && half === 'SECOND') && day.holidayHalf !== half))) halves++
  }
  const holidays = plan.filter((d) => d.holiday).map((d) => `${d.holiday} (${dateText(d.date)})`)
  return { days: halves / 2, holidays }
}

// Approved leave overlapping from..to of everyone in the viewer's Leave View data access whose days the calendar now
// counts otherwise
export async function listRecounts(viewer: CurrentUser, { from, to }: z.infer<typeof recountsInput>) {
  const people = await employeesService.listLeavePeople({ scope: scopeOf(viewer, 'LEAVE', 'READ'), from, to })
  const rows = await applicationsRepository.listForEmployees(
    people.map((p) => p.id),
    from,
    to,
    ['APPROVED'],
  )
  const types = new Map((await typesService.allTypes()).map((t) => [t.id, t]))
  const out = []
  for (const row of rows) {
    // (not a leave of a year whose year end has lapsed - it is put right by an adjustment, assertNotLapsed)
    if (yearLapsed(row.fromDate, types.get(row.leaveType.id)!)) continue
    const now = await recountOf(row.employeeId, types.get(row.leaveType.id)!, row)
    const counted = row.days.toNumber()
    if (now.days === counted) continue
    const [view] = await toApplications([row])
    out.push({ ...view!, now: now.days, difference: round1(now.days - counted), holidays: now.holidays })
  }
  return out
}

// Puts one approved leave right by today's calendar: Leave Edit covering the employee ("not found" outside the View range)
export async function recount(viewer: CurrentUser, { id }: z.infer<typeof recountInput>) {
  const notFound = new ORPCError('NOT_FOUND', { message: `No leave with id ${id}` })
  const application = await applicationsRepository.find(id)
  if (!application) throw notFound
  const person = await leaveService.findPerson(application.employeeId)
  if (!person || !hasLevelAt(viewer, 'LEAVE', leaveService.placementOf(person), 'READ')) throw notFound
  if (!hasLevelAt(viewer, 'LEAVE', leaveService.placementOf(person), 'WRITE')) throw new ORPCError('FORBIDDEN', { message: "You do not have access to change this employee's leave" })
  if (application.status !== 'APPROVED') throw new ORPCError('CONFLICT', { message: 'Only an approved leave is counted again' })
  if (application.cancelApprovalRequestId) {
    const [cancelling] = (await approvalsService.statusOf([application.cancelApprovalRequestId])).values()
    if (cancelling?.status === 'PENDING') throw new ORPCError('CONFLICT', { message: 'The employee asked to cancel this leave - decide that first' })
  }
  await assertNotLapsed(application)
  await attendanceService.assertOpenDays(eachDay(application.fromDate, application.toDate))
  const type = await typesService.getType(application.leaveTypeId)
  const result = await prisma.$transaction(async (tx) => {
    // one change of this employee's leave at a time (a double click puts it right once)
    await applicationsRepository.lockEmployee(application.employeeId, tx)
    const record = await applicationsRepository.find(id, tx)
    if (!record || record.status !== 'APPROVED') throw new ORPCError('CONFLICT', { message: 'Only an approved leave is counted again' })
    const before = record.days.toNumber()
    const now = await recountOf(record.employeeId, type, record)
    const difference = round1(now.days - before)
    if (!difference) throw new ORPCError('CONFLICT', { message: `This leave already counts ${daysText(before)}` })
    const why = now.holidays.length ? `holidays on it now: ${now.holidays.join(', ')}` : 'the weekly offs / holidays changed'
    if (type.isPaid) {
      if (difference < 0) {
        await balancesRepository.addEntries([{ employeeId: record.employeeId, leaveTypeId: type.id, kind: 'RETURNED', days: -difference, effectiveDate: record.fromDate, applicationId: record.id, note: `Counted again: ${daysText(now.days)}, not ${daysText(before)} (${why})` }], viewer.employeeId, tx)
      } else {
        const sums = await balancesRepository.sumBalances([record.employeeId], undefined, tx)
        const balance = sums.find((s) => s.leaveTypeId === type.id)?.days ?? 0
        if (balance < difference) throw new ORPCError('CONFLICT', { message: `Not enough ${type.code} left to take ${daysText(difference)} more: ${balance}` })
        await balancesRepository.addEntries([{ employeeId: record.employeeId, leaveTypeId: type.id, kind: 'TAKEN', days: -difference, effectiveDate: record.fromDate, applicationId: record.id, note: `Counted again: ${daysText(now.days)}, not ${daysText(before)} (${why})` }], viewer.employeeId, tx)
      }
    }
    await applicationsRepository.update(record.id, { days: now.days }, viewer.employeeId, tx)
    return { before, now: now.days, difference, why, record }
  })
  // the employee is told (after the change - an e-mail never undoes it)
  const contact = await employeesService.findMailContact(application.employeeId)
  if (contact?.email) {
    const what = describe(type, { ...application, days: result.now })
    const change = result.difference < 0 ? `${daysText(-result.difference)} given back to your ${type.code} balance` : `${daysText(result.difference)} more taken from your ${type.code} balance`
    await sendMail({
      to: contact.email,
      subject: `Your leave was counted again - ${change}`,
      text: [`Dear ${contact.name},`, '', `Your approved leave was counted again by the calendar: ${what} (it was ${daysText(result.before)}).`, `${change[0]!.toUpperCase()}${change.slice(1)} - ${result.why}.`, '', `Leave: ${env.APP_URL}/leave`].join('\n'),
    }).catch((error: unknown) => console.error('[mail] leave recount e-mail failed:', error))
  }
  const [view] = await toApplications([(await applicationsRepository.find(id))!])
  return { ...view!, difference: result.difference }
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
    // a cancel whose year end passed while it waited: refused (nothing changes)
    if (isCancel) await assertNotLapsed(record)
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
      // (a holiday taken from a type only on its holiday dates makes the half a holiday - 2026-11-24)
      .map(({ date, half }) => ({ employeeId: r.employeeId, date, half, status: r.leaveType.holidaysOnly ? ('HOLIDAY' as const) : ('LEAVE' as const), code: r.leaveType.code, label: r.leaveType.name })),
  )
})

// --- On-application holidays (2026-11-24): attendance asks when a holiday or someone's list changes ---

// A leave taking an on-application holiday that no longer fits (the holiday moved, removed, off their list): cancelled - a
// waiting one's approval closed, an approved one's days given back and the days worked out again - and the employee told.
// One of a year already ended (its balance lapsed) is left to HR.
async function cancelForHoliday(application: applicationsRepository.ApplicationRow, why: string) {
  const reason = `The holiday changed - ${why}`
  if (application.status === 'PENDING') {
    if (!(await prisma.$transaction((tx) => approvalsService.cancelRequest(application.approvalRequestId, reason, SYSTEM_ACTOR, tx)))) return
  } else {
    const type = await typesService.getType(application.leaveTypeId)
    if (yearLapsed(application.fromDate, type)) return
    const cancelled = await prisma.$transaction(async (tx) => {
      await applicationsRepository.lockEmployee(application.employeeId, tx)
      const record = await applicationsRepository.find(application.id, tx)
      if (record?.status !== 'APPROVED') return false
      if (record.cancelApprovalRequestId) await approvalsService.cancelRequest(record.cancelApprovalRequestId, reason, SYSTEM_ACTOR, tx)
      const days = record.days.toNumber()
      await balancesRepository.addEntries([{ employeeId: record.employeeId, leaveTypeId: record.leaveTypeId, kind: 'RETURNED', days, effectiveDate: record.fromDate, applicationId: record.id, note: reason }], SYSTEM_ACTOR, tx)
      await applicationsRepository.update(record.id, { status: 'CANCELLED', cancelReason: reason }, SYSTEM_ACTOR, tx)
      return true
    })
    if (!cancelled) return
    if (application.fromDate <= today()) await attendanceService.recompute([application.employeeId], application.fromDate, application.toDate)
  }
  const contact = await employeesService.findMailContact(application.employeeId)
  if (contact?.email) {
    const what = describe(application.leaveType, { ...application, days: application.days.toNumber() })
    await sendMail({
      to: contact.email,
      subject: `Your ${application.leaveType.name} was cancelled - the holiday changed`,
      text: [`Dear ${contact.name},`, '', `${what} was cancelled: ${why}.`, application.status === 'APPROVED' ? `The days are back in your ${application.leaveType.code} balance.` : 'It was still waiting for approval.', '', `Leave: ${env.APP_URL}/leave`].join('\n'),
    }).catch((error: unknown) => console.error('[mail] holiday leave cancel e-mail failed:', error))
  }
}

attendanceService.registerHolidayLeave({
  assertLeaveType: async (leaveTypeId) => {
    const type = await typesService.getType(leaveTypeId)
    if (!type.isActive) throw new ORPCError('BAD_REQUEST', { message: `${type.name} is no longer used` })
    if (!type.holidaysOnly) throw new ORPCError('BAD_REQUEST', { message: `${type.name} is not taken only on its holiday dates - tick that on its leave type first` })
  },
  recheck: async ({ from, to, employeeIds }) => {
    for (const application of await applicationsRepository.listHolidayLeave(from, to, employeeIds)) {
      const [problem] = await holidayProblems(application.employeeId, application.leaveType, application)
      if (problem) await cancelForHoliday(application, problem.message)
    }
  },
})

// Exports reuse the page's relationship- and data-access-aware readers.
function applicationSheet(rows: Awaited<ReturnType<typeof listMine>>) {
  return reportSheet('Applications', rows, [
    {header:'Employee code',text:true,value:r=>r.employee.employeeCode},
    {header:'Employee',value:r=>r.employee.name},
    {header:'Leave type',value:r=>r.leaveType.name},
    {header:'From',date:true,value:r=>r.fromDate},
    {header:'To',date:true,value:r=>r.toDate},
    {header:'Starts in second half',value:r=>r.fromSecondHalf?'Yes':'No'},
    {header:'Ends in first half',value:r=>r.toFirstHalf?'Yes':'No'},
    {header:'Days',value:r=>r.days},
    {header:'Status',value:r=>r.status},
    {header:'Reason',width:45,value:r=>r.reason},
    {header:'Requested at',dateTime:true,value:r=>r.createdAt},
    {header:'Cancellation reason',width:35,value:r=>r.cancelReason},
  ])
}
export async function exportApplications(viewer: CurrentUser, input: z.infer<typeof listInput>) {
  return reportFile([applicationSheet(await list(viewer,input))], {
    title:'Leave applications',preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:'Applications overlapping the selected dates within the same team, HOD department or Leave View data access as the page.',
    filters:[{label:'Scope',value:input.scope},{label:'From',value:input.from.toISOString().slice(0,10)},
      {label:'To',value:input.to.toISOString().slice(0,10)},{label:'Status',value:input.statuses?.join(', ')||'PENDING, APPROVED'},
      {label:'Search',value:input.search||'All'}],
  },'leave-applications')
}
export async function exportMine(viewer: CurrentUser) {
  const [balance, applications] = await Promise.all([balancesService.getBalances(viewer,{}),listMine(viewer)])
  return reportFile([
    reportSheet('Balances',balance.balances,[
      {header:'Leave code',text:true,value:r=>r.leaveType.code},
      {header:'Leave type',value:r=>r.leaveType.name},
      {header:'Balance',value:r=>r.balance},{header:'Pending',value:r=>r.pending},
      {header:'Available',value:r=>r.available},{header:'Credited',value:r=>r.credited},
      {header:'Adjusted',value:r=>r.adjusted},{header:'Taken',value:r=>r.taken},{header:'Lapsed',value:r=>r.lapsed},
    ]),
    reportSheet('Balance history',balance.entries,[
      {header:'Date',date:true,value:r=>r.date},{header:'Leave type',value:r=>r.leaveType.name},
      {header:'Entry',value:r=>r.what},{header:'Days',value:r=>r.days},{header:'Note',width:45,value:r=>r.note},
      {header:'Expires on',date:true,value:r=>r.expiresOn},{header:'Recorded by',value:r=>r.by?.name},
      {header:'Recorded at',dateTime:true,value:r=>r.at},
    ]),applicationSheet(applications),
  ],{title:'My leave',preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:`Your own ${balance.year} balances and ledger; latest 100 applications, matching My leave. Blank balances mean an unmetered leave type.`,
    filters:[{label:'Employee code',value:viewer.employeeCode},{label:'Balance year',value:String(balance.year)}],
  },`my-leave-${balance.year}`)
}

export async function exportRecounts(viewer:CurrentUser,input:z.infer<typeof recountsInput>){
  const rows=await listRecounts(viewer,input)
  return reportFile([reportSheet('Recounts',rows,[
    {header:'Employee code',text:true,value:r=>r.employee.employeeCode},{header:'Employee',value:r=>r.employee.name},
    {header:'Leave type',value:r=>r.leaveType.name},{header:'From',date:true,value:r=>r.fromDate},
    {header:'To',date:true,value:r=>r.toDate},{header:'Approved days',value:r=>r.days},
    {header:'Days now',value:r=>r.now},{header:'Difference',value:r=>r.difference},
  ])],{title:'Leave recounts',preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:'Approved leave currently counted differently, within Leave View data access. Matches the selected dates. Exporting does not recount or adjust balances.',
    filters:[{label:'From',value:input.from.toISOString().slice(0,10)},{label:'To',value:input.to.toISOString().slice(0,10)}],
  },'leave-recounts')
}
