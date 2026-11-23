import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for background_checks.

const backgroundCheckSelect = {
  id: true,
  candidateId: true,
  employeeId: true,
  type: true,
  subject: true,
  status: true,
  vendorName: true,
  vendorReference: true,
  remarks: true,
  completedAt: true,
  completedById: true,
  createdAt: true,
  createdById: true,
  updatedAt: true,
  updatedById: true,
} satisfies Prisma.BackgroundCheckSelect

export function list(candidateId: number, db: DbClient = prisma) {
  return db.backgroundCheck.findMany({
    where: { candidateId },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    select: backgroundCheckSelect,
  })
}

// The check with this id, or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.backgroundCheck.findUnique({ where: { id }, select: backgroundCheckSelect })
}

export function create(data: NewRow<Prisma.BackgroundCheckUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.backgroundCheck.create({ data: { ...data, ...createdBy(actorId) }, select: backgroundCheckSelect })
}

export function update(id: number, data: Prisma.BackgroundCheckUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.backgroundCheck.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: backgroundCheckSelect })
}

// On the joining day: the candidate's checks belong to the new employee from now on
export function linkToEmployee(candidateId: number, employeeId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.backgroundCheck.updateMany({ where: { candidateId, employeeId: null }, data: { employeeId, ...updatedBy(actorId) } })
}

export function deleteById(id: number, db: DbClient = prisma) {
  return db.backgroundCheck.delete({ where: { id }, select: { id: true } })
}

// Checks still open for people who have joined (no result yet), oldest first, with whose they are
export function listOpenAfterJoining(db: DbClient = prisma) {
  return db.backgroundCheck.findMany({
    where: { employeeId: { not: null }, completedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      status: true,
      vendorName: true,
      createdAt: true,
      // (where they are: each reminder goes only to HR whose data access covers them)
      employee: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true, companyId: true, plantId: true, departmentId: true } },
    },
  })
}
