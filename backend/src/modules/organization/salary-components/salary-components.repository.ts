import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const salaryComponentSelect = { id: true, name: true, code: true, kind: true, enteredMonthly: true, cutForUnpaidDays: true, displayOrder: true, isActive: true } satisfies Prisma.SalaryComponentSelect

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.salaryComponent.findMany({
    where: includeInactive ? {} : { isActive: true },
    // the order of the lines in a salary breakup
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: salaryComponentSelect,
  })
}

export function findById(id: number, db: DbClient = prisma) {
  return db.salaryComponent.findUnique({ where: { id }, select: salaryComponentSelect })
}

export function create(data: NewRow<Prisma.SalaryComponentCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.salaryComponent.create({ data: { ...data, ...createdBy(actorId) }, select: salaryComponentSelect })
}

export function update(id: number, data: Prisma.SalaryComponentUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.salaryComponent.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: salaryComponentSelect })
}
