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
  leaveType: { select: { id: true, code: true, name: true, isPaid: true, holidaysOnly: true } },
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

// The leave of types taken only on their holiday dates, waiting or approved, overlapping from..to (only these employees',
// when given) - checked again when holidays or someone's holiday list change (2026-11-24)
// data access: a system step after a holiday change - the leave is checked, nothing is returned to a viewer
export function listHolidayLeave(from: Date, to: Date, employeeIds: number[] | undefined, db: DbClient = prisma) {
  return db.leaveApplication.findMany({
    where: { fromDate: { lte: to }, toDate: { gte: from }, status: { in: ['PENDING', 'APPROVED'] }, leaveType: { holidaysOnly: true }, ...(employeeIds && { employeeId: { in: employeeIds } }) },
    orderBy: { id: 'asc' },
    select: applicationSelect,
  })
}

// Holds this employee's leave requests until the transaction ends: an application is checked again after it, so two sent at
// the same moment (a double click) cannot both pass the overlap and balance checks (2026-11-23)
export async function lockEmployee(employeeId: number, db: DbClient) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('leave-applications'), ${employeeId}::int)::text AS locked`
}
