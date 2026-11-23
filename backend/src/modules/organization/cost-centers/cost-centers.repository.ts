import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

// Database access for cost_centers.

const costCenterSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  company: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, plantCode: true, name: true } },
} satisfies Prisma.CostCenterSelect

export function list(filter: { companyId?: number | undefined; includeInactive: boolean }, db: DbClient = prisma) {
  return db.costCenter.findMany({
    where: {
      ...(filter.companyId !== undefined && { companyId: filter.companyId }),
      ...(!filter.includeInactive && { isActive: true }),
    },
    orderBy: [{ company: { name: 'asc' } }, { code: 'asc' }],
    select: costCenterSelect,
  })
}

// The cost centre with this id, or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.costCenter.findUnique({ where: { id }, select: costCenterSelect })
}

export function create(data: NewRow<Prisma.CostCenterUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.costCenter.create({ data: { ...data, ...createdBy(actorId) }, select: costCenterSelect })
}

export function update(id: number, data: Prisma.CostCenterUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.costCenter.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: costCenterSelect })
}
