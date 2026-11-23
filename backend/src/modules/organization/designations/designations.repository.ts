import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const designationSelect = { id: true, name: true, isActive: true } satisfies Prisma.DesignationSelect

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.designation.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    select: designationSelect,
  })
}

export function create(data: NewRow<Prisma.DesignationCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.designation.create({ data: { ...data, ...createdBy(actorId) }, select: designationSelect })
}

export function update(id: number, data: Prisma.DesignationUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.designation.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: designationSelect })
}
