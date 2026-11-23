import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const workLocationSelect = {
  id: true,
  name: true,
  countryCode: true,
  stateCode: true,
  timezone: true,
  address: true,
  postalCode: true,
  region: { select: { id: true, name: true } },
  isActive: true,
} satisfies Prisma.WorkLocationSelect

// One group-wide list (a site can be used by several companies)
export function list(filter: { includeInactive: boolean }, db: DbClient = prisma) {
  return db.workLocation.findMany({
    where: filter.includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    select: workLocationSelect,
  })
}

// The work location with this id, or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.workLocation.findUnique({ where: { id }, select: workLocationSelect })
}

export function create(data: NewRow<Prisma.WorkLocationUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.workLocation.create({ data: { ...data, ...createdBy(actorId) }, select: workLocationSelect })
}

export function update(id: number, data: Prisma.WorkLocationUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.workLocation.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: workLocationSelect })
}
