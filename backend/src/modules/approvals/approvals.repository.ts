import {
  createdBy,
  prisma,
  updatedBy,
  type ActorId,
  type ApprovalBreachAction,
  type ApprovalFeature,
  type ApprovalKind,
  type ApproverType,
  type AccessArea,
  type DbClient,
  type Prisma,
} from '#core/db/prisma'

// Database access for approval_requests and approval_request_steps (the chains are in chains/).

const stepSelect = {
  id: true,
  stepNo: true,
  approverType: true,
  roleId: true,
  roleName: true,
  accessArea: true,
  seesConfidential: true,
  approverId: true,
  byFallback: true,
  status: true,
  note: true,
  openedAt: true,
  decidedAt: true,
  decidedById: true,
  comment: true,
  remindedAt: true,
  slaHours: true,
  onBreach: true,
  escalateRoleId: true,
  escalateRoleName: true,
  dueAt: true,
  breachedAt: true,
  autoDecided: true,
} satisfies Prisma.ApprovalRequestStepSelect

const requestSelect = {
  id: true,
  feature: true,
  kinds: true,
  employeeId: true,
  requestedById: true,
  status: true,
  summary: true,
  targetCompanyId: true,
  targetPlantId: true,
  targetDepartmentId: true,
  heldAt: true,
  heldReason: true,
  closedAt: true,
  closedById: true,
  cancelReason: true,
  createdAt: true,
  employee: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true, status: true, companyId: true, plantId: true, departmentId: true } },
  steps: { orderBy: { stepNo: 'asc' }, select: stepSelect },
} satisfies Prisma.ApprovalRequestSelect

export type RequestRow = Prisma.ApprovalRequestGetPayload<{ select: typeof requestSelect }>
export type StepRow = RequestRow['steps'][number]

export type NewStep = {
  stepNo: number
  approverType: ApproverType
  roleId: number | null
  roleName: string | null
  accessArea: AccessArea | null
  seesConfidential: boolean
  slaHours: number | null
  onBreach: ApprovalBreachAction
  escalateRoleId: number | null
  escalateRoleName: string | null
  approverId?: number | null
}

// A new request with its steps (all waiting)
export function createRequest(
  data: {
    feature: ApprovalFeature
    kinds: ApprovalKind[]
    employeeId: number
    requestedById: number
    summary: string
    targetCompanyId: number | null
    targetPlantId: number | null
    targetDepartmentId: number | null
    steps: NewStep[]
  },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  const { steps, ...request } = data
  return db.approvalRequest.create({
    data: { ...request, ...createdBy(actorId), steps: { create: steps.map((step) => ({ ...step, ...createdBy(actorId) })) } },
    select: { id: true },
  })
}

export function findRequest(id: number, db: DbClient = prisma) {
  return db.approvalRequest.findUnique({ where: { id }, select: requestSelect })
}

// Several requests by id, with their steps (a feature shows where each of its records stands)
// data access: the requests of records the feature already chose (and checked)
export function findRequests(ids: number[], db: DbClient = prisma) {
  if (!ids.length) return Promise.resolve([])
  return db.approvalRequest.findMany({ where: { id: { in: ids } }, select: requestSelect })
}

export function updateRequest(id: number, data: Prisma.ApprovalRequestUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.approvalRequest.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

export function updateStep(id: number, data: Prisma.ApprovalRequestStepUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.approvalRequestStep.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// Decides a step only if it is still open - false when someone else decided it a moment before
export async function decideStepIfOpen(id: number, data: Prisma.ApprovalRequestStepUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  const result = await db.approvalRequestStep.updateMany({ where: { id, status: 'OPEN' }, data: { ...data, ...updatedBy(actorId) } })
  return result.count === 1
}

// Ends the steps not decided yet (the request was rejected or cancelled)
export function cancelOpenSteps(requestId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.approvalRequestStep.updateMany({ where: { requestId, status: { in: ['WAITING', 'OPEN'] } }, data: { status: 'CANCELLED', ...updatedBy(actorId) } })
}

// Makes room for a step after `stepNo` (an escalation): the later steps move one place down - in two moves, as each step
// number is unique within its request
export async function shiftStepsAfter(requestId: number, stepNo: number, actorId: ActorId, db: DbClient = prisma) {
  await db.approvalRequestStep.updateMany({ where: { requestId, stepNo: { gt: stepNo } }, data: { stepNo: { increment: 1000 }, ...updatedBy(actorId) } })
  await db.approvalRequestStep.updateMany({ where: { requestId, stepNo: { gt: stepNo + 1000 } }, data: { stepNo: { decrement: 999 }, ...updatedBy(actorId) } })
}

export function addStep(requestId: number, step: NewStep, actorId: ActorId, db: DbClient = prisma) {
  return db.approvalRequestStep.create({ data: { ...step, requestId, ...createdBy(actorId) }, select: { id: true } })
}

// Every request still waiting, with its steps - the service keeps what the viewer may decide (or what the daily job
// looks at)
// data access: the service filters each request by whether the viewer may decide its open step (a named manager / HOD,
// or a role / access covering the employee) - or it is the daily job. `ids`: only these (the tests)
export function listPending(ids?: number[], db: DbClient = prisma) {
  return db.approvalRequest.findMany({ where: { AND: [{ status: 'PENDING' }, ids ? { id: { in: ids } } : {}] }, orderBy: { createdAt: 'asc' }, select: requestSelect })
}

// The requests whose open step passed its SLA: not acted on yet, or a "wait" one (reminded again every SLA hours) - the
// hourly job. `ids`: only these (the tests)
// data access: the hourly job - no logged-in person
export function listLate(now: Date, ids?: number[], db: DbClient = prisma) {
  return db.approvalRequest.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      status: 'PENDING',
      heldAt: null,
      steps: { some: { status: 'OPEN', dueAt: { lte: now }, OR: [{ breachedAt: null }, { onBreach: 'WAIT' }] } },
    },
    orderBy: { createdAt: 'asc' },
    select: requestSelect,
  })
}

// A late step's time-limit action - made only while it is still open, late and not acted on (a decision, or a new
// approver given by the daily job, a moment before wins)
export async function breachStepIfDue(id: number, now: Date, data: Prisma.ApprovalRequestStepUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  const result = await db.approvalRequestStep.updateMany({
    where: { id, status: 'OPEN', breachedAt: null, dueAt: { lte: now } },
    data: { ...data, ...updatedBy(actorId) },
  })
  return result.count === 1
}

// The requests in which the employee decided a step (approved or rejected), the latest raised first - the Approvals
// page's "Decided by me" (the user, 2026-11-22)
// data access: the viewer's own decisions (they decided a step of each, so they could see it then)
export function listDecidedBy(decidedById: number, take: number, db: DbClient = prisma) {
  return db.approvalRequest.findMany({ where: { steps: { some: { decidedById } } }, orderBy: { createdAt: 'desc' }, take, select: requestSelect })
}

// The requests the viewer raised, the latest first
// data access: the viewer's own requests (they raised them)
export function listRaisedBy(requestedById: number, take: number, db: DbClient = prisma) {
  return db.approvalRequest.findMany({ where: { requestedById }, orderBy: { createdAt: 'desc' }, take, select: requestSelect })
}
