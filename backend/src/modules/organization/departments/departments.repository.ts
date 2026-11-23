import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const departmentSelect = { id: true, code: true, name: true, isActive: true } satisfies Prisma.DepartmentSelect

// `plantId`: only the departments that run at that plant (not retired there)
export function list(filter: { includeInactive: boolean; plantId?: number | undefined }, db: DbClient = prisma) {
  return db.department.findMany({
    where: {
      ...(!filter.includeInactive && { isActive: true }),
      // (a department retired at the plant no longer runs there)
      ...(filter.plantId !== undefined && { plants: { some: { plantId: filter.plantId, isActive: true } } }),
    },
    orderBy: { name: 'asc' },
    select: departmentSelect,
  })
}

export function create(data: NewRow<Prisma.DepartmentCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.department.create({ data: { ...data, ...createdBy(actorId) }, select: departmentSelect })
}

export function update(id: number, data: Prisma.DepartmentUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.department.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: departmentSelect })
}
