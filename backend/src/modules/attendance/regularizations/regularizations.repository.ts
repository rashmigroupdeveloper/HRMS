import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for regularization / on-duty requests (2026-11-22).

const requestSelect = {
  id: true,
  employeeId: true,
  kind: true,
  fromDate: true,
  toDate: true,
  portion: true,
  reason: true,
  status: true,
  approvalRequestId: true,
  createdAt: true,
  employee: { select: { id: true, employeeCode: true, firstName: true, middleName: true, lastName: true } },
} satisfies Prisma.RegularizationRequestSelect
export type RequestRow = Prisma.RegularizationRequestGetPayload<{ select: typeof requestSelect }>

export function create(data: Omit<Prisma.RegularizationRequestUncheckedCreateInput, 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  return db.regularizationRequest.create({ data: { ...data, ...createdBy(actorId) }, select: requestSelect })
}

export function update(id: number, data: Prisma.RegularizationRequestUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.regularizationRequest.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: requestSelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.regularizationRequest.findUnique({ where: { id }, select: requestSelect })
}

// The request of an approval request (the approval service's decision comes back by it)
export function findByApprovalRequestId(approvalRequestId: number, db: DbClient = prisma) {
  return db.regularizationRequest.findUnique({ where: { approvalRequestId }, select: requestSelect })
}

// One employee's requests, newest first
export function listByEmployee(employeeId: number, take: number, db: DbClient = prisma) {
  return db.regularizationRequest.findMany({ where: { employeeId }, orderBy: { id: 'desc' }, take, select: requestSelect })
}
