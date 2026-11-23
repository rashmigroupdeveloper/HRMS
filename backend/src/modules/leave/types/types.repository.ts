import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for leave types (2026-11-22).

const typeSelect = {
  id: true,
  code: true,
  name: true,
  isPaid: true,
  creditPerMonth: true,
  creditAfterMonths: true,
  maxCarryForward: true,
  maxPerRequest: true,
  allowHalfDay: true,
  countsOffDays: true,
  genders: true,
  employmentTypes: true,
  isCompOff: true,
  isActive: true,
  creditsFrom: true,
  createdAt: true,
} satisfies Prisma.LeaveTypeSelect
export type TypeRow = Prisma.LeaveTypeGetPayload<{ select: typeof typeSelect }>

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.leaveType.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ isActive: 'desc' }, { code: 'asc' }], select: typeSelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.leaveType.findUnique({ where: { id }, select: typeSelect })
}

export function create(data: Omit<Prisma.LeaveTypeUncheckedCreateInput, 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  return db.leaveType.create({ data: { ...data, ...createdBy(actorId) }, select: typeSelect })
}

export function update(id: number, data: Prisma.LeaveTypeUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.leaveType.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: typeSelect })
}

// data access: whether a type was used by anyone - returns no one's data, only yes / no
// Whether the type was ever used - a balance row or an application (its paid / unpaid may then not change - old HRMS)
export async function isUsed(id: number, db: DbClient = prisma) {
  const [entry, application] = await Promise.all([
    db.leaveLedgerEntry.findFirst({ where: { leaveTypeId: id }, select: { id: true } }),
    db.leaveApplication.findFirst({ where: { leaveTypeId: id }, select: { id: true } }),
  ])
  return !!entry || !!application
}
