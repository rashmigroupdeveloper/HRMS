import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const regionSelect = { id: true, name: true, isActive: true } satisfies Prisma.RegionSelect

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.region.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    select: regionSelect,
  })
}

export function create(data: NewRow<Prisma.RegionCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.region.create({ data: { ...data, ...createdBy(actorId) }, select: regionSelect })
}

export function update(id: number, data: Prisma.RegionUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.region.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: regionSelect })
}
