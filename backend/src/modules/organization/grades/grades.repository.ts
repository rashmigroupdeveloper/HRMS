import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const gradeSelect = { id: true, code: true, name: true, rank: true, isActive: true } satisfies Prisma.GradeSelect

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.grade.findMany({
    where: includeInactive ? {} : { isActive: true },
    // by seniority, most senior first
    orderBy: [{ rank: 'asc' }, { name: 'asc' }],
    select: gradeSelect,
  })
}

export function create(data: NewRow<Prisma.GradeCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.grade.create({ data: { ...data, ...createdBy(actorId) }, select: gradeSelect })
}

export function update(id: number, data: Prisma.GradeUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.grade.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: gradeSelect })
}
