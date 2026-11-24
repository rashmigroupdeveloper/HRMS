import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for the holiday categories (2026-11-24).

const categorySelect = { id: true, name: true, tone: true, isActive: true } satisfies Prisma.HolidayCategorySelect

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.holidayCategory.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { name: 'asc' }, select: categorySelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.holidayCategory.findUnique({ where: { id }, select: categorySelect })
}

export function create(data: NewRow<Prisma.HolidayCategoryUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.holidayCategory.create({ data: { ...data, ...createdBy(actorId) }, select: categorySelect })
}

export function update(id: number, data: Prisma.HolidayCategoryUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.holidayCategory.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: categorySelect })
}
