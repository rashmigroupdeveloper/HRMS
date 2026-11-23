import { hasLevelAt, type Placement } from '#core/auth/scope'
import { env } from '#core/config/env'
import { prisma, SYSTEM_ACTOR, type ActorId, type ApprovalFeature, type ApprovalKind, type ApproverType, type DbClient } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { accountsService } from '#modules/accounts'
import { employeesService, hodsService } from '#modules/employees'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as approvalsRepository from './approvals.repository.js'
import type { RequestRow, StepRow } from './approvals.repository.js'
import type { cancelApprovalInput, decideApprovalInput } from './approvals.schema.js'
import * as chainsService from './chains/chains.service.js'

// The approval service (the user, 2026-11-20): a feature raises a request about an employee; it follows the chain(s) of
// its kind(s) one step at a time; the final decision goes back to the feature, in the same transaction.
// - A manager / functional manager / HOD step with nobody to decide it (none, the employee themselves, the requester,
//   cannot sign in) is SKIPPED with the reason.
// - A role / access step nobody holds for the employee goes to the FALLBACK approver (the role marked as fallback -
//   seeded "Admin" - covering the employee); when every step was skipped, a fallback step is added: never approved by
//   nobody.
// - If even the fallback approver has nobody, the request is HELD - not approved - until the routing is repaired and it
//   is sent through again ("vacancy is not consent", as the old HRMS). The daily job retries held requests itself.
// - Nobody decides a request about themselves or one they raised.

// --- What a feature gives the service (registerFeature) ---

export type ClosedStatus = 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
export type FeatureHandler = {
  // how a request of this feature is called ("Job change")
  label: string
  // the final decision, inside the deciding transaction - throwing undoes the decision too
  onApproved: (requestId: number, actorId: ActorId, tx: DbClient) => Promise<void>
  onRejected: (requestId: number, actorId: ActorId, tx: DbClient) => Promise<void>
  onCancelled: (requestId: number, actorId: ActorId, tx: DbClient, reason: string | null) => Promise<void>
  // after the decision is saved (e-mails); a failure here never undoes it
  afterClosed?: (requestId: number, status: ClosedStatus) => Promise<void>
  // who else may see a request (e.g. Employees View covering the employee) and cancel one still waiting
  canView: (viewer: CurrentUser, placement: Placement) => boolean
  canCancel: (viewer: CurrentUser, placement: Placement) => boolean
  // where it is seen in the app, e.g. /employees/RML035384?tab=job
  link: (employeeCode: string) => string
}
const handlers = new Map<ApprovalFeature, FeatureHandler>()

// A feature tells the service how to act on its requests - once, when its service module loads
export function registerFeature(feature: ApprovalFeature, handler: FeatureHandler) {
  handlers.set(feature, handler)
}
function handlerOf(feature: ApprovalFeature) {
  const handler = handlers.get(feature)
  if (!handler) throw new Error(`No approval handler registered for ${feature}`)
  return handler
}

// --- Who decides a step ---

const NAMED: Partial<Record<ApproverType, string>> = { REPORTING_MANAGER: 'reporting manager', FUNCTIONAL_MANAGER: 'functional manager', HOD: 'HOD' }
// named to one person: a manager / functional manager / HOD step, or an escalation to the late approver's manager
const isNamed = (step: Pick<StepRow, 'approverType'>) => step.approverType in NAMED || step.approverType === 'ESCALATION'
const HOUR_MS = 60 * 60 * 1000
// a fallback step the service adds itself waits, its approvers reminded every 3 days
const FALLBACK_REMIND_HOURS = 72
// when an opening step must be decided by (none without a time limit)
const dueFrom = (step: Pick<StepRow, 'slaHours'>, from: Date) => (step.slaHours ? new Date(from.getTime() + step.slaHours * HOUR_MS) : null)

// How a step is shown: "Reporting manager", "HR" (a role), "Approve job & salary changes" (an access), "Fallback approver"
export function stepLabel(step: Pick<StepRow, 'approverType' | 'roleName' | 'accessArea'>) {
  switch (step.approverType) {
    case 'REPORTING_MANAGER':
      return 'Reporting manager'
    case 'FUNCTIONAL_MANAGER':
      return 'Functional manager'
    case 'HOD':
      return 'HOD'
    case 'ROLE':
      return step.roleName ?? 'A role (deleted)'
    case 'ACCESS':
      return step.accessArea ? accountsService.areaLabel(step.accessArea) : 'An access'
    case 'FALLBACK':
      return 'Fallback approver'
    case 'ESCALATION':
      return "The late approver's manager"
  }
}

const fullName = employeesService.fullName

// Where the request's employee is - and the second place a move touches: ROLE / ACCESS / FALLBACK approvers cover both
function placementsOf(request: RequestRow): Placement[] {
  const here = { companyId: request.employee.companyId, plantId: request.employee.plantId, departmentId: request.employee.departmentId }
  if (request.targetCompanyId === null || request.targetPlantId === null) return [here]
  return [here, { companyId: request.targetCompanyId, plantId: request.targetPlantId, departmentId: request.targetDepartmentId }]
}

// The person a manager / functional manager / HOD step is named to now - or why there is nobody
async function namedApprover(step: StepRow, request: RequestRow): Promise<{ id: number } | { vacant: string }> {
  const subject = await employeesService.findApprovalSubject(request.employeeId)
  const label = NAMED[step.approverType]!
  const id =
    step.approverType === 'REPORTING_MANAGER'
      ? subject?.reportingManagerId
      : step.approverType === 'FUNCTIONAL_MANAGER'
        ? subject?.functionalManagerId
        : subject?.hodPostId
          ? await hodsService.currentHodOf(subject.hodPostId)
          : null
  if (!id) return { vacant: step.approverType === 'HOD' ? 'The place has no HOD' : `No ${label}` }
  if (id === request.employeeId) return { vacant: `The employee is their own ${label}` }
  if (id === request.requestedById) return { vacant: `The ${label} raised the request` }
  if (!(await accountsService.listSignInIds([id])).has(id)) return { vacant: `The ${label} cannot sign in (no login, or has left)` }
  return { id }
}

// Who may decide each of these role / access / fallback steps: the holders covering the employee (and the place a move
// goes to), never the employee themselves nor the requester - for a step named to one holder (the user, 2026-11-20),
// only them, while they still qualify
async function poolsOf(items: { step: Pick<StepRow, 'approverType' | 'roleId' | 'accessArea' | 'byFallback' | 'approverId'>; request: RequestRow }[]) {
  const lists = await accountsService.listApprovers(
    items.map(({ step, request }) => {
      const placements = placementsOf(request)
      if (step.approverType === 'FALLBACK' || step.byFallback) return { fallback: true, placements }
      if (step.approverType === 'ROLE') return { roleId: step.roleId, placements }
      return { area: step.accessArea, placements }
    }),
  )
  return lists.map((ids, n) => {
    const { step, request } = items[n]!
    const named = !(step.approverType === 'FALLBACK' || step.byFallback) && step.approverId ? step.approverId : null
    return ids.filter((id) => id !== request.employeeId && id !== request.requestedById && (named === null || id === named))
  })
}

// The viewer may decide this open step
async function mayDecide(viewer: CurrentUser, request: RequestRow, step: StepRow) {
  if (viewer.employeeId === request.employeeId || viewer.employeeId === request.requestedById) return false
  if (isNamed(step)) return step.approverId === viewer.employeeId
  const [pool] = await poolsOf([{ step, request }])
  return pool!.includes(viewer.employeeId)
}

// --- Moving a request along ---

type Outcome = { opened?: number; closed?: ClosedStatus; held?: string }

// Opens a role / access / fallback step - or, when nobody can decide it, holds the request
async function openPoolStep(request: RequestRow, step: StepRow, actorId: ActorId, tx: DbClient, why?: string): Promise<Outcome> {
  const now = new Date()
  let byFallback = step.byFallback || step.approverType === 'FALLBACK'
  let note = why ?? step.note
  let [pool] = await poolsOf([{ step: { ...step, byFallback }, request }])
  if (!pool!.length && !byFallback) {
    byFallback = true
    const named = step.approverId ? (await employeesService.lookupPeople([step.approverId], tx))(step.approverId) : null
    note = named
      ? `${named.name} cannot decide "${stepLabel(step)}" for this employee (left, no login, or their role / data access changed) - the fallback approver decides it`
      : `Nobody holds "${stepLabel(step)}" for this employee - the fallback approver decides it`
    ;[pool] = await poolsOf([{ step: { ...step, byFallback }, request }])
  }
  if (!pool!.length) {
    const reason = `Nobody can decide step ${step.stepNo} (${stepLabel(step)}) - not even the fallback approver covers this employee`
    await approvalsRepository.updateStep(step.id, { byFallback, note }, actorId, tx)
    await approvalsRepository.updateRequest(request.id, { heldAt: now, heldById: actorId, heldReason: reason }, actorId, tx)
    return { held: reason }
  }
  await approvalsRepository.updateStep(step.id, { status: 'OPEN', byFallback, note, openedAt: now, openedById: actorId, dueAt: dueFrom(step, now) }, actorId, tx)
  return { opened: step.id }
}

// An escalation whose manager cannot sign in any more becomes a fallback step (no time limit of its own)
async function toFallback(request: RequestRow, step: StepRow, actorId: ActorId, tx: DbClient) {
  // back to waiting first: if even the fallback approver has nobody, the request is held at this step and a retry finds it
  const fallback = { approverType: 'FALLBACK' as const, approverId: null, slaHours: FALLBACK_REMIND_HOURS, onBreach: 'WAIT' as const, dueAt: null, status: 'WAITING' as const, openedAt: null, openedById: null }
  await approvalsRepository.updateStep(step.id, fallback, actorId, tx)
  return openPoolStep(request, { ...step, ...fallback }, actorId, tx, 'The manager it was escalated to cannot decide it - the fallback approver decides it')
}

// Opens the next step someone can decide - skipping the vacant manager / HOD steps; with no step left, approves the
// request if someone approved it, else adds the fallback step
async function advance(requestId: number, actorId: ActorId, tx: DbClient): Promise<Outcome> {
  const request = (await approvalsRepository.findRequest(requestId, tx))!
  const now = new Date()
  for (const step of request.steps.filter((s) => s.status === 'WAITING')) {
    // an escalation waiting (it was held): its manager if they can still sign in, else the fallback approver
    if (step.approverType === 'ESCALATION') {
      if (step.approverId && (await accountsService.listSignInIds([step.approverId])).has(step.approverId)) {
        await approvalsRepository.updateStep(step.id, { status: 'OPEN', openedAt: now, openedById: actorId, dueAt: dueFrom(step, now) }, actorId, tx)
        return { opened: step.id }
      }
      return toFallback(request, step, actorId, tx)
    }
    if (!isNamed(step)) return openPoolStep(request, step, actorId, tx)
    const found = await namedApprover(step, request)
    if ('vacant' in found) {
      await approvalsRepository.updateStep(step.id, { status: 'SKIPPED', note: found.vacant }, actorId, tx)
      continue
    }
    await approvalsRepository.updateStep(step.id, { status: 'OPEN', approverId: found.id, openedAt: now, openedById: actorId, dueAt: dueFrom(step, now) }, actorId, tx)
    return { opened: step.id }
  }
  if (request.steps.some((s) => s.status === 'APPROVED')) {
    await approvalsRepository.updateRequest(request.id, { status: 'APPROVED', closedAt: now, closedById: actorId }, actorId, tx)
    await handlerOf(request.feature).onApproved(request.id, actorId, tx)
    return { closed: 'APPROVED' }
  }
  // every step was skipped - nobody has approved it: the fallback approver decides (and sees what any step would have)
  const stepNo = (request.steps.at(-1)?.stepNo ?? 0) + 1
  const seesConfidential = request.steps.length === 0 || request.steps.some((s) => s.seesConfidential)
  await approvalsRepository.addStep(
    request.id,
    { stepNo, approverType: 'FALLBACK', roleId: null, roleName: null, accessArea: null, seesConfidential, slaHours: FALLBACK_REMIND_HOURS, onBreach: 'WAIT', escalateRoleId: null, escalateRoleName: null },
    actorId,
    tx,
  )
  const again = (await approvalsRepository.findRequest(request.id, tx))!
  return openPoolStep(again, again.steps.at(-1)!, actorId, tx, request.steps.length ? 'Every step was skipped - nobody has approved it yet' : 'The chain has no step')
}

// --- For features ---

// Raises a request inside the feature's transaction (the feature saves its own record with the id). Steps: per kind the
// company's own chain or the shared one, merged. Send the notices after the transaction (sendNotices).
export async function raiseRequest(
  input: { feature: ApprovalFeature; kinds: ApprovalKind[]; employeeId: number; requestedById: number; summary: string; target?: Placement | null },
  tx: DbClient,
) {
  const subject = await employeesService.findApprovalSubject(input.employeeId, tx)
  if (!subject) throw new ORPCError('NOT_FOUND', { message: `No employee found with id ${input.employeeId}` })
  const steps = await chainsService.stepsFor(input.kinds, subject.companyId)
  const { id } = await approvalsRepository.createRequest(
    {
      feature: input.feature,
      kinds: input.kinds,
      employeeId: input.employeeId,
      requestedById: input.requestedById,
      summary: input.summary,
      targetCompanyId: input.target?.companyId ?? null,
      targetPlantId: input.target?.plantId ?? null,
      targetDepartmentId: input.target?.departmentId ?? null,
      steps: steps.map((step, index) => ({ ...step, stepNo: index + 1 })),
    },
    input.requestedById,
    tx,
  )
  const outcome = await advance(id, input.requestedById, tx)
  return { id, outcome }
}

// Cancels a request still waiting, from a feature's own step (e.g. the employee left) - inside its transaction
export async function cancelRequest(requestId: number, reason: string, actorId: ActorId, tx: DbClient) {
  const request = await approvalsRepository.findRequest(requestId, tx)
  if (!request || request.status !== 'PENDING') return false
  return closeAsCancelled(request, reason, actorId, tx)
}

// Cancels the request if it is still waiting (false: it was decided or cancelled in the meantime - nothing is written)
async function closeAsCancelled(request: RequestRow, reason: string | null, actorId: ActorId, tx: DbClient) {
  const closed = await approvalsRepository.closeRequestIfPending(
    request.id,
    { status: 'CANCELLED', closedAt: new Date(), closedById: actorId, cancelReason: reason, heldAt: null, heldById: null, heldReason: null },
    actorId,
    tx,
  )
  if (!closed) return false
  await approvalsRepository.cancelOpenSteps(request.id, actorId, tx)
  await handlerOf(request.feature).onCancelled(request.id, actorId, tx, reason)
  return true
}


// Whether the viewer sees the confidential part of a request (e.g. the proposed salary): they may decide now a step set
// to see it
export async function seesConfidential(viewer: CurrentUser, requestId: number) {
  const request = await approvalsRepository.findRequest(requestId)
  return request ? confidentialFor(viewer, request) : false
}
// Only while approving (the user, 2026-11-21 - P2): the step set to see it is open and the viewer may decide it. Once they
// have decided, the figures are hidden again (unless their own salary access shows them) - before, an approver kept seeing
// the salary for good, also once in force.
async function confidentialFor(viewer: CurrentUser, request: RequestRow) {
  for (const step of request.steps.filter((s) => s.seesConfidential)) {
    if (step.status === 'OPEN' && (await mayDecide(viewer, request, step))) return true
  }
  return false
}

// What a request is, in words: its kinds ("Salary revision", "Job / position change + Salary revision") - not the
// feature's name, which called a salary revision a "Job change" (2026-11-21 - P3)
const labelOf = (request: Pick<RequestRow, 'kinds'>) => request.kinds.map((kind) => chainsService.KIND_INFO[kind].label).join(' + ')

// Past its time limit, still waiting
const isLate = (step: Pick<StepRow, 'status' | 'dueAt'>) => step.status === 'OPEN' && !!step.dueAt && step.dueAt.getTime() <= Date.now()

// Where a request stands, as a feature shows it ("Waiting - step 2 of 3: HR")
export async function statusOf(requestIds: number[]) {
  const rows = await approvalsRepository.findRequests([...new Set(requestIds)])
  const named = await employeesService.lookupPeople(rows.flatMap((r) => r.steps.map((s) => s.approverId)))
  return new Map(
    rows.flatMap((r) => {
      const open = r.steps.find((s) => s.status === 'OPEN')
      return [[r.id, { status: r.status, held: r.heldReason, closedAt: r.closedAt, closedById: r.closedById, step: open ? { stepNo: open.stepNo, of: r.steps.length, who: stepLabel(open), approver: named(open.approverId), byFallback: open.byFallback, late: isLate(open) } : null }] as const]
    }),
  )
}

// --- Notices (after the transaction - an e-mail never undoes a decision) ---

async function mail(to: { email: string | null; name: string } | null | undefined, subject: string, lines: string[]) {
  if (!to?.email) return
  await sendMail({ to: to.email, subject, text: [`Dear ${to.name},`, '', ...lines.filter(Boolean), '', `Approvals: ${env.APP_URL}/approvals`].join('\n') }).catch((error: unknown) =>
    console.error('[mail] approval e-mail failed:', error),
  )
}

async function mailApprovers(request: RequestRow, step: StepRow, subject: string, lines: string[]) {
  const ids = isNamed(step) ? (step.approverId ? [step.approverId] : []) : (await poolsOf([{ step, request }]))[0]!
  for (const person of await employeesService.listMailContacts(ids)) await mail(person, subject, lines)
}

// After a step of a request: the e-mails, then the feature's own step once it is closed (e.g. a job change whose day has
// come is applied) - both waited for (the background jobs)
export async function sendNotices(requestId: number, outcome: Outcome) {
  await mailNotices(requestId, outcome)
  await afterClose(requestId, outcome)
}

// The same for a person's own action (raise, decide, cancel, repair): the feature's step is waited for (the approver sees
// the change in force), the e-mails are not - so the screen answers at once; a failed e-mail is logged and kept in the
// outbox for the worker to send again (2026-11-21: raising a change waited ~4 s for the approver's e-mail)
export async function finishAndNotify(requestId: number, outcome: Outcome) {
  await afterClose(requestId, outcome)
  void mailNotices(requestId, outcome).catch((error: unknown) => console.error('[approvals] notices not sent:', error))
}

async function afterClose(requestId: number, outcome: Outcome) {
  if (!outcome.closed) return
  const request = await approvalsRepository.findRequest(requestId)
  if (!request) return
  await handlerOf(request.feature).afterClosed?.(request.id, outcome.closed).catch((error: unknown) => console.error('[approvals] after-close failed:', error))
}

async function mailNotices(requestId: number, outcome: Outcome) {
  const request = await approvalsRepository.findRequest(requestId)
  if (!request) return
  const who = `${fullName(request.employee)} (${request.employee.employeeCode})`
  const about = `${labelOf(request)} of ${who}: ${request.summary}`
  try {
    if (outcome.opened) {
      const step = request.steps.find((s) => s.id === outcome.opened)!
      await mailApprovers(request, step, `To approve: ${labelOf(request).toLowerCase()} of ${who}`, [
        about,
        step.byFallback ? `You decide it as the fallback approver - ${step.note}` : '',
        'Please approve or reject it on the Approvals page.',
      ])
    }
    if (outcome.held) {
      const requester = await employeesService.findMailContact(request.requestedById)
      const repairers = await accountsService.mailRecipients('APPROVAL_CHAINS', 'WRITE', placementsOf(request)[0])
      for (const person of [requester, ...repairers]) {
        await mail(person, `Held: ${labelOf(request).toLowerCase()} of ${who}`, [about, `It is held - not approved: ${outcome.held}.`, 'Repair the approval routing (give the role, appoint the HOD, change the chain), then send it through again from the held list.'])
      }
    }
    if (outcome.closed === 'APPROVED' || outcome.closed === 'REJECTED' || outcome.closed === 'EXPIRED') {
      const rejected = request.steps.find((s) => s.status === 'REJECTED')
      const word = { APPROVED: 'Approved', REJECTED: 'Rejected', EXPIRED: 'Expired' }[outcome.closed]
      await mail(await employeesService.findMailContact(request.requestedById), `${word}: ${labelOf(request).toLowerCase()} of ${who}`, [
        about,
        outcome.closed === 'APPROVED'
          ? 'It is approved.'
          : outcome.closed === 'EXPIRED'
            ? `It expired: ${request.cancelReason ?? 'not decided in time'}.`
            : `It was rejected (${stepLabel(rejected!)}): ${rejected?.comment ?? ''}`,
      ])
    }
  } catch (error) {
    console.error('[approvals] notice failed:', error)
  }
}

// --- The API ---

// The viewer may see the request: they raised it, decided or are named to a step, may decide the open step, may repair
// it while held (Approval chains Edit covering the employee) - or the feature lets them (e.g. Employees View)
async function canSee(viewer: CurrentUser, request: RequestRow) {
  if (request.requestedById === viewer.employeeId) return true
  if (request.steps.some((s) => s.decidedById === viewer.employeeId || s.approverId === viewer.employeeId)) return true
  const placement = placementsOf(request)[0]!
  if (request.heldAt && hasLevelAt(viewer, 'APPROVAL_CHAINS', placement, 'WRITE')) return true
  if (handlerOf(request.feature).canView(viewer, placement)) return true
  const open = request.steps.find((s) => s.status === 'OPEN')
  return open ? mayDecide(viewer, request, open) : false
}

// Whether the viewer may see the request (a feature shows its record to the request's people)
export async function canSeeRequest(viewer: CurrentUser, requestId: number) {
  const request = await approvalsRepository.findRequest(requestId)
  return request ? canSee(viewer, request) : false
}

async function getVisible(viewer: CurrentUser, id: number, db?: DbClient) {
  const request = await approvalsRepository.findRequest(id, db)
  if (!request || !(await canSee(viewer, request))) throw new ORPCError('NOT_FOUND', { message: `No approval request found with id ${id}` })
  return request
}

// One request with its whole trail: who was to decide each step, what they decided, when and why
export async function getRequest(viewer: CurrentUser, id: number) {
  const request = await getVisible(viewer, id)
  const handler = handlerOf(request.feature)
  const person = await employeesService.lookupPeople([request.requestedById, request.closedById, ...request.steps.flatMap((s) => [s.approverId, s.decidedById])])
  const open = request.steps.find((s) => s.status === 'OPEN')
  const placement = placementsOf(request)[0]!
  return {
    id: request.id,
    feature: request.feature,
    label: labelOf(request),
    kinds: request.kinds.map((kind) => ({ kind, label: chainsService.KIND_INFO[kind].label })),
    status: request.status,
    summary: request.summary,
    employee: { employeeCode: request.employee.employeeCode, name: fullName(request.employee) },
    requestedBy: person(request.requestedById),
    raisedAt: request.createdAt,
    closedAt: request.closedAt,
    closedBy: person(request.closedById),
    cancelReason: request.cancelReason,
    held: request.heldAt ? { at: request.heldAt, reason: request.heldReason } : null,
    steps: request.steps.map((s) => ({
      stepNo: s.stepNo,
      who: stepLabel(s),
      approverType: s.approverType,
      status: s.status,
      byFallback: s.byFallback,
      note: s.note,
      seesConfidential: s.seesConfidential,
      approver: person(s.approverId),
      openedAt: s.openedAt,
      decidedAt: s.decidedAt,
      decidedBy: person(s.decidedById),
      comment: s.comment,
      // the time limit (2026-11-20): hours, the action when it passes, the role to escalate to, the day it is due, late
      slaHours: s.slaHours,
      onBreach: s.onBreach,
      escalateRoleName: s.escalateRoleName,
      dueAt: s.dueAt,
      breachedAt: s.breachedAt,
      autoDecided: s.autoDecided,
      late: isLate(s),
    })),
    canDecide: request.status === 'PENDING' && !!open && (await mayDecide(viewer, request, open)),
    canCancel: request.status === 'PENDING' && (request.requestedById === viewer.employeeId || handler.canCancel(viewer, placement)),
    canRetry: request.status === 'PENDING' && !!request.heldAt && hasLevelAt(viewer, 'APPROVAL_CHAINS', placement, 'WRITE'),
    seesConfidential: await confidentialFor(viewer, request),
    link: handler.link(request.employee.employeeCode),
  }
}

// A list row: the request and the step it is at
async function toRows(requests: RequestRow[]) {
  const person = await employeesService.lookupPeople(requests.flatMap((r) => [r.requestedById, ...r.steps.map((s) => s.approverId)]))
  return requests.map((r) => {
    const open = r.steps.find((s) => s.status === 'OPEN')
    return {
      id: r.id,
      feature: r.feature,
      label: labelOf(r),
      status: r.status,
      summary: r.summary,
      employee: { employeeCode: r.employee.employeeCode, name: fullName(r.employee) },
      requestedBy: person(r.requestedById),
      raisedAt: r.createdAt,
      closedAt: r.closedAt,
      held: r.heldAt ? { at: r.heldAt, reason: r.heldReason } : null,
      step: open
        ? { stepNo: open.stepNo, of: r.steps.length, who: stepLabel(open), approver: person(open.approverId), byFallback: open.byFallback, note: open.note, openedAt: open.openedAt, dueAt: open.dueAt, late: isLate(open) }
        : null,
      link: handlerOf(r.feature).link(r.employee.employeeCode),
    }
  })
}

// What waits for the viewer's decision: steps named to them, and role / access / fallback steps they hold for the
// employee - oldest first
async function waitingFor(viewer: CurrentUser) {
  const open = (await approvalsRepository.listPending())
    .filter((r) => !r.heldAt && r.employeeId !== viewer.employeeId && r.requestedById !== viewer.employeeId)
    .flatMap((request) => {
      const step = request.steps.find((s) => s.status === 'OPEN')
      return step ? [{ request, step }] : []
    })
  const named = open.filter(({ step }) => isNamed(step) && step.approverId === viewer.employeeId)
  const pooled = open.filter(({ step }) => !isNamed(step))
  const pools = await poolsOf(pooled)
  return [...named, ...pooled.filter((_, n) => pools[n]!.includes(viewer.employeeId))]
    .sort((a, b) => (a.step.openedAt?.getTime() ?? 0) - (b.step.openedAt?.getTime() ?? 0))
    .map(({ request }) => request)
}

export async function listToDecide(viewer: CurrentUser) {
  return toRows(await waitingFor(viewer))
}

export async function countToDecide(viewer: CurrentUser) {
  return (await waitingFor(viewer)).length
}

// The requests the viewer raised, the latest first
export async function listMine(viewer: CurrentUser) {
  return toRows(await approvalsRepository.listRaisedBy(viewer.employeeId, 100))
}

// The requests in which the viewer decided a step - with their own decision (the last, if they decided more than one
// step) and where the request stands now - the latest decision first (the user, 2026-11-22: "Decided by me")
export async function listDecided(viewer: CurrentUser) {
  const requests = await approvalsRepository.listDecidedBy(viewer.employeeId, 200)
  const rows = await toRows(requests)
  return rows
    .map((row, n) => {
      const mine = requests[n]!.steps.filter((s) => s.decidedById === viewer.employeeId).at(-1)!
      return { ...row, decision: { status: mine.status, decidedAt: mine.decidedAt, comment: mine.comment } }
    })
    .sort((a, b) => (b.decision.decidedAt?.getTime() ?? 0) - (a.decision.decidedAt?.getTime() ?? 0))
}

// The held requests the viewer may repair (Approval chains Edit covering the employee)
export async function listHeld(viewer: CurrentUser) {
  const held = (await approvalsRepository.listPending()).filter((r) => r.heldAt && hasLevelAt(viewer, 'APPROVAL_CHAINS', placementsOf(r)[0]!, 'WRITE'))
  return toRows(held)
}

export async function decide(viewer: CurrentUser, { id, approve, comment }: z.infer<typeof decideApprovalInput>) {
  if (!approve && !comment) throw new ORPCError('BAD_REQUEST', { message: 'Give the reason for rejecting it' })
  const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
    const request = await getVisible(viewer, id, tx)
    if (request.status !== 'PENDING') throw new ORPCError('CONFLICT', { message: 'This request is already decided' })
    const step = request.steps.find((s) => s.status === 'OPEN')
    if (!step) throw new ORPCError('CONFLICT', { message: 'This request is held - nobody can decide it until its approval routing is repaired' })
    if (!(await mayDecide(viewer, request, step))) throw new ORPCError('FORBIDDEN', { message: 'This step is not yours to decide' })
    const decided = await approvalsRepository.decideStepIfOpen(
      step.id,
      { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date(), decidedById: viewer.employeeId, comment: comment ?? null },
      viewer.employeeId,
      tx,
    )
    if (!decided) throw new ORPCError('CONFLICT', { message: 'Someone decided this step a moment ago - reload' })
    if (approve) return advance(id, viewer.employeeId, tx)
    await approvalsRepository.cancelOpenSteps(id, viewer.employeeId, tx)
    await approvalsRepository.updateRequest(id, { status: 'REJECTED', closedAt: new Date(), closedById: viewer.employeeId }, viewer.employeeId, tx)
    await handlerOf(request.feature).onRejected(id, viewer.employeeId, tx)
    return { closed: 'REJECTED' }
  })
  await finishAndNotify(id, outcome)
  return getRequest(viewer, id)
}

export async function cancel(viewer: CurrentUser, { id, reason }: z.infer<typeof cancelApprovalInput>) {
  await prisma.$transaction(async (tx) => {
    const request = await getVisible(viewer, id, tx)
    if (request.status !== 'PENDING') throw new ORPCError('CONFLICT', { message: 'This request is already decided' })
    if (request.requestedById !== viewer.employeeId && !handlerOf(request.feature).canCancel(viewer, placementsOf(request)[0]!)) {
      throw new ORPCError('FORBIDDEN', { message: 'Only the person who raised it (or HR for the employee) can cancel it' })
    }
    if (!(await closeAsCancelled(request, reason ?? null, viewer.employeeId, tx))) {
      throw new ORPCError('CONFLICT', { message: 'This request was decided a moment ago - it cannot be cancelled now' })
    }
  })
  await finishAndNotify(id, { closed: 'CANCELLED' })
  return getRequest(viewer, id)
}

// Sends a held request through its chain again, after its routing was repaired - never approves anything by itself
async function retry(request: RequestRow, actorId: ActorId, tx: DbClient) {
  await approvalsRepository.updateRequest(request.id, { heldAt: null, heldById: null, heldReason: null }, actorId, tx)
  // the step it stopped at is worked out afresh (the role may be held by someone now)
  const stuck = request.steps.find((s) => s.status === 'WAITING' && s.approverType !== 'FALLBACK')
  if (stuck) await approvalsRepository.updateStep(stuck.id, { byFallback: false, note: null }, actorId, tx)
  return advance(request.id, actorId, tx)
}

export async function retryRouting(viewer: CurrentUser, id: number) {
  const outcome = await prisma.$transaction(async (tx) => {
    const request = await getVisible(viewer, id, tx)
    if (request.status !== 'PENDING' || !request.heldAt) throw new ORPCError('CONFLICT', { message: 'This request is not held' })
    if (!hasLevelAt(viewer, 'APPROVAL_CHAINS', placementsOf(request)[0]!, 'WRITE')) throw new ORPCError('FORBIDDEN', { message: 'Repairing approval routing needs Approval chains: Edit' })
    return retry(request, viewer.employeeId, tx)
  })
  await finishAndNotify(id, outcome)
  return getRequest(viewer, id)
}

// --- The daily job (approvals.daily) ---

// a held request the daily job tried again, still with nobody to decide it (its transaction is undone)
class StillHeld extends Error {}

// Every request still waiting: cancelled if the employee left; a held one sent through again; a manager / HOD step given
// to the new manager / HOD (or skipped when there is none now); a fallback step given back to the role once someone holds
// it (reminders follow each step's SLA - the hourly job, runTimeLimits). `only`: just these requests - for the tests, so
// they do not go through every request earlier runs left in the test database (the job itself passes nothing)
export type JobFilter = { requestIds: number[] }
export function runDaily(only?: JobFilter) {
  return accountsService.withSignInsReadOnce(() => daily(only))
}
async function daily(only?: JobFilter) {
  const counts = { cancelled: 0, moved: 0 }
  const failures: string[] = []
  for (const request of await approvalsRepository.listPending(only?.requestIds)) {
    try {
      if (request.employee.status === 'EXITED') {
        const cancelled = await prisma.$transaction((tx) => closeAsCancelled(request, 'The employee has left', SYSTEM_ACTOR, tx))
        if (cancelled) {
          await sendNotices(request.id, { closed: 'CANCELLED' })
          counts.cancelled++
        }
        continue
      }
      if (request.heldAt) {
        // tried again - and undone when still nobody can decide it, so a held request writes nothing night after night
        try {
          const outcome = await prisma.$transaction(async (tx) => {
            const tried = await retry(request, SYSTEM_ACTOR, tx)
            if (tried.held) throw new StillHeld()
            return tried
          })
          await sendNotices(request.id, outcome)
          counts.moved++
        } catch (error) {
          if (!(error instanceof StillHeld)) throw error
        }
        continue
      }
      const step = request.steps.find((s) => s.status === 'OPEN')
      if (!step) continue
      if (step.approverType in NAMED) {
        const found = await namedApprover(step, request)
        if ('vacant' in found) {
          const outcome = await prisma.$transaction(async (tx) => {
            await approvalsRepository.updateStep(step.id, { status: 'SKIPPED', note: found.vacant, approverId: null }, SYSTEM_ACTOR, tx)
            return advance(request.id, SYSTEM_ACTOR, tx)
          })
          await sendNotices(request.id, outcome)
          counts.moved++
          continue
        }
        if (found.id !== step.approverId) {
          await approvalsRepository.updateStep(
            step.id,
            { approverId: found.id, openedAt: new Date(), openedById: SYSTEM_ACTOR, remindedAt: null, remindedById: null, dueAt: dueFrom(step, new Date()), breachedAt: null, breachedById: null },
            SYSTEM_ACTOR,
          )
          await sendNotices(request.id, { opened: step.id })
          counts.moved++
          continue
        }
      } else if (step.approverType === 'ESCALATION') {
        if (!step.approverId || !(await accountsService.listSignInIds([step.approverId])).has(step.approverId)) {
          const outcome = await prisma.$transaction(async (tx) => toFallback((await approvalsRepository.findRequest(request.id, tx))!, step, SYSTEM_ACTOR, tx))
          await sendNotices(request.id, outcome)
          counts.moved++
          continue
        }
      } else if (step.byFallback && step.approverType !== 'FALLBACK') {
        const [pool] = await poolsOf([{ step: { ...step, byFallback: false }, request }])
        if (pool!.length) {
          await approvalsRepository.updateStep(step.id, { byFallback: false, note: null, openedAt: new Date(), openedById: SYSTEM_ACTOR }, SYSTEM_ACTOR)
          await sendNotices(request.id, { opened: step.id })
          counts.moved++
          continue
        }
      }
    } catch (error) {
      failures.push(`#${request.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const done = `${counts.cancelled} cancelled (employee left), ${counts.moved} moved on`
  return failures.length ? `${done}; ${failures.length} failed - ${failures.join('; ')}` : done
}

// --- Time limits (the user, 2026-11-20 - the old HRMS's SLA, plus "wait") ---

// The step after a late one that escalates: the role named on the step; else the late approver's own reporting manager
// (a named step) - who must be able to sign in and not be the employee nor the requester; else the fallback approver
async function escalationOf(request: RequestRow, step: StepRow): Promise<approvalsRepository.NewStep> {
  const base = { stepNo: step.stepNo + 1, roleName: null, accessArea: null, seesConfidential: step.seesConfidential, escalateRoleId: null, escalateRoleName: null }
  // a role deleted since the request was raised: as if none was named
  if (step.escalateRoleId && (await accountsService.roleNames()).has(step.escalateRoleId)) {
    return { ...base, approverType: 'ROLE', roleId: step.escalateRoleId, roleName: step.escalateRoleName, slaHours: step.slaHours, onBreach: 'WAIT' }
  }
  if (isNamed(step) && step.approverId) {
    const managerId = (await employeesService.findApprovalSubject(step.approverId))?.reportingManagerId ?? null
    const usable =
      managerId !== null && managerId !== request.employeeId && managerId !== request.requestedById && (await accountsService.listSignInIds([managerId])).has(managerId)
    // the manager's step escalates again when late - up the reporting line, as the old HRMS
    if (usable) return { ...base, approverType: 'ESCALATION', roleId: null, approverId: managerId, slaHours: step.slaHours, onBreach: 'ESCALATE' }
  }
  return { ...base, approverType: 'FALLBACK', roleId: null, slaHours: FALLBACK_REMIND_HOURS, onBreach: 'WAIT' }
}

// What the chain says happens when a step passes its time limit - null when it was decided a moment ago
async function breach(request: RequestRow, step: StepRow, tx: DbClient): Promise<Outcome | null> {
  const now = new Date()
  const limit = `not decided within ${step.slaHours} hours`
  const marked = { breachedAt: now, breachedById: SYSTEM_ACTOR }
  // the first change of each action is made only while the step is still open
  const stillOpen = (data: Parameters<typeof approvalsRepository.breachStepIfDue>[2]) => approvalsRepository.breachStepIfDue(step.id, now, data, SYSTEM_ACTOR, tx)
  switch (step.onBreach) {
    case 'WAIT':
      // nothing moves - its approver is reminded instead (remind)
      return {}
    case 'AUTO_APPROVE':
      if (!(await stillOpen({ ...marked, status: 'APPROVED', decidedAt: now, decidedById: SYSTEM_ACTOR, autoDecided: true, comment: `Approved automatically - ${limit}` }))) return null
      return advance(request.id, SYSTEM_ACTOR, tx)
    case 'AUTO_REJECT':
      if (!(await stillOpen({ ...marked, status: 'REJECTED', decidedAt: now, decidedById: SYSTEM_ACTOR, autoDecided: true, comment: `Rejected automatically - ${limit}` }))) return null
      await approvalsRepository.cancelOpenSteps(request.id, SYSTEM_ACTOR, tx)
      await approvalsRepository.updateRequest(request.id, { status: 'REJECTED', closedAt: now, closedById: SYSTEM_ACTOR }, SYSTEM_ACTOR, tx)
      await handlerOf(request.feature).onRejected(request.id, SYSTEM_ACTOR, tx)
      return { closed: 'REJECTED' }
    case 'EXPIRE': {
      const reason = `Expired - step ${step.stepNo} (${stepLabel(step)}) ${limit}`
      if (!(await stillOpen(marked))) return null
      await approvalsRepository.cancelOpenSteps(request.id, SYSTEM_ACTOR, tx)
      await approvalsRepository.updateRequest(request.id, { status: 'EXPIRED', closedAt: now, closedById: SYSTEM_ACTOR, cancelReason: reason }, SYSTEM_ACTOR, tx)
      // the feature records it as it records a cancellation, with the reason
      await handlerOf(request.feature).onCancelled(request.id, SYSTEM_ACTOR, tx, reason)
      return { closed: 'EXPIRED' }
    }
    case 'ESCALATE': {
      const next = await escalationOf(request, step)
      if (!(await stillOpen({ ...marked, status: 'ESCALATED', note: `${limit[0]!.toUpperCase()}${limit.slice(1)} - escalated` }))) return null
      await approvalsRepository.shiftStepsAfter(request.id, step.stepNo, SYSTEM_ACTOR, tx)
      await approvalsRepository.addStep(request.id, next, SYSTEM_ACTOR, tx)
      return advance(request.id, SYSTEM_ACTOR, tx)
    }
  }
}

// "Wait": nothing moves - only its approver decides, even late; they are reminded each time its SLA hours pass (the user,
// 2026-11-20: with "wait" the SLA is only for the reminder). The first reminder marks the step late.
async function remind(request: RequestRow, step: StepRow) {
  const now = new Date()
  if (step.remindedAt && now.getTime() - step.remindedAt.getTime() < step.slaHours! * HOUR_MS) return false
  await approvalsRepository.updateStep(
    step.id,
    { remindedAt: now, remindedById: SYSTEM_ACTOR, ...(step.breachedAt ? {} : { breachedAt: now, breachedById: SYSTEM_ACTOR }) },
    SYSTEM_ACTOR,
  )
  const who = `${fullName(request.employee)} (${request.employee.employeeCode})`
  await mailApprovers(request, step, `Reminder - to approve: ${labelOf(request).toLowerCase()} of ${who}`, [
    `${labelOf(request)} of ${who}: ${request.summary}`,
    `It has waited for your decision since ${step.openedAt?.toISOString().slice(0, 10)} - it was to be decided within ${step.slaHours} hours.`,
  ])
  return true
}

// The hourly job (approvals.timeLimits): every open step past its SLA - "wait" reminds (again every SLA hours), any other
// action is taken once, each in a transaction of its own. `only`: as runDaily. Both jobs read the logins once per run.
export function runTimeLimits(only?: JobFilter) {
  return accountsService.withSignInsReadOnce(() => timeLimits(only))
}
async function timeLimits(only?: JobFilter) {
  const counts: Record<string, number> = {}
  const failures: string[] = []
  for (const request of await approvalsRepository.listLate(new Date(), only?.requestIds)) {
    const step = request.steps.find((s) => s.status === 'OPEN')
    if (!step?.dueAt) continue
    try {
      if (step.onBreach === 'WAIT') {
        if (await remind(request, step)) counts.reminded = (counts.reminded ?? 0) + 1
        continue
      }
      const outcome = await prisma.$transaction((tx) => breach(request, step, tx))
      if (!outcome) continue
      await sendNotices(request.id, outcome)
      counts[step.onBreach] = (counts[step.onBreach] ?? 0) + 1
    } catch (error) {
      failures.push(`#${request.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const done = Object.entries(counts).map(([action, n]) => `${n} ${action.toLowerCase()}`).join(', ') || 'none late'
  return failures.length ? `${done}; ${failures.length} failed - ${failures.join('; ')}` : done
}
