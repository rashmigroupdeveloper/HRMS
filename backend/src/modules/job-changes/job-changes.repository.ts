import { type DataScope, scopeWhere } from '#core/auth/scope'
import {
  createdBy,
  prisma,
  updatedBy,
  type ActorId,
  type DbClient,
  type JobChangeKind,
  type JobChangeStatus,
  type Prisma,
} from '#core/db/prisma'

// Database access for job_change_requests.

const person = { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } } as const

const changeSelect = {
  id: true,
  employeeId: true,
  approvalRequestId: true,
  effectiveFrom: true,
  kind: true,
  reason: true,
  status: true,
  changedFields: true,
  companyId: true,
  plantId: true,
  departmentId: true,
  workLocationId: true,
  designationId: true,
  gradeId: true,
  positionId: true,
  costCenterId: true,
  reportingManagerId: true,
  functionalManagerId: true,
  employmentType: true,
  workforceCategory: true,
  applyError: true,
  appliedAt: true,
  appliedById: true,
  before: true,
  cancelledAt: true,
  cancelledById: true,
  cancelReason: true,
  notifiedAt: true,
  createdAt: true,
  createdById: true,
  employee: { select: { ...person.select, status: true, companyId: true, plantId: true, departmentId: true, workEmail: true, personalEmail: true } },
  // the proposed salary (confidential - the service decides who sees it)
  salary: {
    select: {
      annualCtc: true,
      performancePayAnnual: true,
      currency: true,
      lines: {
        select: { monthlyAmount: true, salaryComponent: { select: { id: true, name: true, kind: true } } },
        orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
      },
    },
  },
} satisfies Prisma.JobChangeRequestSelect

export type ChangeRow = Prisma.JobChangeRequestGetPayload<{ select: typeof changeSelect }>

export function create(data: Omit<Prisma.JobChangeRequestUncheckedCreateInput, 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  return db.jobChangeRequest.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

// The salary a change proposes, with its breakup
export function createSalary(
  jobChangeRequestId: number,
  data: { annualCtc: number; performancePayAnnual: number | null; currency: string; lines: { salaryComponentId: number; monthlyAmount: number }[] },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  const { lines, ...salary } = data
  return db.jobChangeSalary.create({
    data: { ...salary, jobChangeRequestId, ...createdBy(actorId), lines: { create: lines.map((line) => ({ ...line, ...createdBy(actorId) })) } },
    select: { id: true },
  })
}

export function findById(id: number, db: DbClient = prisma) {
  return db.jobChangeRequest.findUnique({ where: { id }, select: changeSelect })
}

export function findByApprovalRequestId(approvalRequestId: number, db: DbClient = prisma) {
  return db.jobChangeRequest.findUnique({ where: { approvalRequestId }, select: changeSelect })
}

// The employee's open change (waiting for approval, or approved and waiting for its day), or null - one at a time
export function findOpen(employeeId: number, db: DbClient = prisma) {
  return db.jobChangeRequest.findFirst({ where: { employeeId, status: { in: ['PENDING', 'APPROVED'] } }, select: { id: true, status: true, effectiveFrom: true } })
}

export function update(id: number, data: Prisma.JobChangeRequestUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.jobChangeRequest.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// Changes a record only while it still has this status - false when it moved on a moment before (2026-11-23: a cancel and
// the apply, or two applies, each read "approved" and both wrote)
export async function updateIfStatus(
  id: number,
  status: Prisma.JobChangeRequestWhereInput['status'],
  data: Prisma.JobChangeRequestUncheckedUpdateManyInput,
  actorId: ActorId,
  db: DbClient = prisma,
) {
  const result = await db.jobChangeRequest.updateMany({ where: { id, status }, data: { ...data, ...updatedBy(actorId) } })
  return result.count === 1
}

export type ChangeFilter = {
  scope: DataScope
  employeeId?: number | undefined
  // the changes this employee asked for (their "Raise a change" list)
  requestedById?: number | undefined
  statuses?: JobChangeStatus[] | undefined
  kinds?: JobChangeKind[] | undefined
  companyIds?: number[] | undefined
  from?: Date | undefined
  to?: Date | undefined
}

function whereOf(filter: ChangeFilter): Prisma.JobChangeRequestWhereInput {
  return {
    AND: [
      { employee: scopeWhere(filter.scope) },
      ...(filter.employeeId !== undefined ? [{ employeeId: filter.employeeId }] : []),
      ...(filter.requestedById !== undefined ? [{ createdById: filter.requestedById }] : []),
      ...(filter.statuses?.length ? [{ status: { in: filter.statuses } }] : []),
      ...(filter.kinds?.length ? [{ kind: { in: filter.kinds } }] : []),
      ...(filter.companyIds?.length ? [{ employee: { companyId: { in: filter.companyIds } } }] : []),
      ...(filter.from ? [{ effectiveFrom: { gte: filter.from } }] : []),
      ...(filter.to ? [{ effectiveFrom: { lte: filter.to } }] : []),
    ],
  }
}

// The changes of the employees inside the viewer's data access, the latest asked first
export async function list(filter: ChangeFilter, paging: { skip: number; take: number }, db: DbClient = prisma) {
  const where = whereOf(filter)
  const [rows, total] = await Promise.all([
    db.jobChangeRequest.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...paging, select: changeSelect }),
    db.jobChangeRequest.count({ where }),
  ])
  return { rows, total }
}

// Approved changes whose day has come and that are not applied yet (or could not be), earliest first
// data access: the daily job (jobChanges.applyDue) - every employee's due changes, no logged-in person
export function listDue(day: Date, db: DbClient = prisma) {
  return db.jobChangeRequest.findMany({
    where: { status: 'APPROVED', effectiveFrom: { lte: day } },
    orderBy: [{ effectiveFrom: 'asc' }, { id: 'asc' }],
    select: changeSelect,
  })
}

