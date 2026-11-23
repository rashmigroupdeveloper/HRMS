import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type LeaveStatus, type Prisma } from '#core/db/prisma'

// Database access for leave applications (2026-11-22).

const applicationSelect = {
  id: true,
  employeeId: true,
  leaveTypeId: true,
  fromDate: true,
  toDate: true,
  fromSecondHalf: true,
  toFirstHalf: true,
  days: true,
  reason: true,
  status: true,
  approvalRequestId: true,
  cancelApprovalRequestId: true,
  cancelReason: true,
  createdAt: true,
  leaveType: { select: { id: true, code: true, name: true, isPaid: true } },
  employee: { select: { id: true, employeeCode: true, firstName: true, middleName: true, lastName: true, companyId: true, plantId: true, departmentId: true } },
} satisfies Prisma.LeaveApplicationSelect
export type ApplicationRow = Prisma.LeaveApplicationGetPayload<{ select: typeof applicationSelect }>

export function create(data: Omit<Prisma.LeaveApplicationUncheckedCreateInput, 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  return db.leaveApplication.create({ data: { ...data, ...createdBy(actorId) }, select: applicationSelect })
}

export function update(id: number, data: Prisma.LeaveApplicationUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.leaveApplication.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: applicationSelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.leaveApplication.findUnique({ where: { id }, select: applicationSelect })
}

// data access: by its approval request - the approval service decided who may act on it
// The application of an approval request - the leave's own, or the one to cancel it
export function findByApprovalRequestId(approvalRequestId: number, db: DbClient = prisma) {
  return db.leaveApplication.findFirst({ where: { OR: [{ approvalRequestId }, { cancelApprovalRequestId: approvalRequestId }] }, select: applicationSelect })
}

// One employee's applications, newest first
export function listByEmployee(employeeId: number, take: number, db: DbClient = prisma) {
  return db.leaveApplication.findMany({ where: { employeeId }, orderBy: [{ fromDate: 'desc' }, { id: 'desc' }], take, select: applicationSelect })
}

// These employees' applications overlapping from..to, of these statuses (the service chose the employees)
export function listForEmployees(employeeIds: number[], from: Date, to: Date, statuses: LeaveStatus[], db: DbClient = prisma) {
  if (!employeeIds.length) return Promise.resolve([])
  return db.leaveApplication.findMany({
    where: { employeeId: { in: employeeIds }, fromDate: { lte: to }, toDate: { gte: from }, status: { in: statuses } },
    orderBy: [{ fromDate: 'asc' }, { id: 'asc' }],
    take: 2000,
    select: applicationSelect,
  })
}
