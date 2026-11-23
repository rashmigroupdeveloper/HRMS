import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for shift-change requests.

// (with where they are - the approval's people are limited by data access)
const person = { select: { id: true, employeeCode: true, firstName: true, middleName: true, lastName: true, companyId: true, plantId: true, departmentId: true } } as const
const requestSelect = {
  id: true,
  employeeId: true,
  date: true,
  kind: true,
  requestedShiftId: true,
  swapWithEmployeeId: true,
  reason: true,
  status: true,
  approvalRequestId: true,
  createdAt: true,
  employee: person,
  swapWith: person,
  requestedShift: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ShiftChangeRequestSelect
export type RequestRow = Prisma.ShiftChangeRequestGetPayload<{ select: typeof requestSelect }>

export function create(data: Omit<Prisma.ShiftChangeRequestUncheckedCreateInput, 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  return db.shiftChangeRequest.create({ data: { ...data, ...createdBy(actorId) }, select: requestSelect })
}

export function update(id: number, data: Prisma.ShiftChangeRequestUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.shiftChangeRequest.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: requestSelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.shiftChangeRequest.findUnique({ where: { id }, select: requestSelect })
}

// A request of this employee for this day still waiting
export function findOpen(employeeId: number, date: Date, db: DbClient = prisma) {
  return db.shiftChangeRequest.findFirst({ where: { employeeId, date, status: 'PENDING' }, select: { id: true } })
}

// The request of an approval request (the approval service's decision comes back by it)
export function findByApprovalRequestId(approvalRequestId: number, db: DbClient = prisma) {
  return db.shiftChangeRequest.findUnique({ where: { approvalRequestId }, select: requestSelect })
}

export function listByEmployee(employeeId: number, take: number, db: DbClient = prisma) {
  return db.shiftChangeRequest.findMany({ where: { employeeId }, orderBy: { id: 'desc' }, take, select: requestSelect })
}
