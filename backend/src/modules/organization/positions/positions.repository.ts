import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const positionSelect = { id: true, name: true, isActive: true } satisfies Prisma.PositionSelect

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.position.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    select: positionSelect,
  })
}

export function create(data: NewRow<Prisma.PositionCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.position.create({ data: { ...data, ...createdBy(actorId) }, select: positionSelect })
}

export function update(id: number, data: Prisma.PositionUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.position.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: positionSelect })
}
