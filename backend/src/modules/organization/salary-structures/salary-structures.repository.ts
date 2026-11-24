import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

const structureSelect = {
  id: true,
  name: true,
  joiningType: true,
  employmentType: true,
  workforceCategory: true,
  basicComponentId: true,
  isActive: true,
  lines: {
    select: {
      salaryComponentId: true,
      method: true,
      value: true,
      minimumBase: true,
      onlyIfGrossAtMost: true,
      salaryComponent: { select: { id: true, name: true, kind: true, isActive: true } },
    },
    // as the breakup prints them
    orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
  },
} satisfies Prisma.SalaryStructureSelect

export type StructureRow = Prisma.SalaryStructureGetPayload<{ select: typeof structureSelect }>

type LineData = Omit<Prisma.SalaryStructureLineUncheckedCreateInput, 'structureId' | 'createdById' | 'updatedById'>

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.salaryStructure.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { name: 'asc' }, select: structureSelect })
}

export function findById(id: number, db: DbClient = prisma) {
  return db.salaryStructure.findUnique({ where: { id }, select: structureSelect })
}

export function create(
  data: Omit<Prisma.SalaryStructureUncheckedCreateInput, 'createdById' | 'updatedById' | 'lines'>,
  lines: LineData[],
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.salaryStructure.create({
    data: { ...data, ...createdBy(actorId), lines: { create: lines.map((line) => ({ ...line, ...createdBy(actorId) })) } },
    select: structureSelect,
  })
}

// `lines` given: the structure's lines are replaced by them
export function update(
  id: number,
  data: Omit<Prisma.SalaryStructureUncheckedUpdateInput, 'lines'>,
  lines: LineData[] | undefined,
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.salaryStructure.update({
    where: { id },
    data: {
      ...data,
      ...updatedBy(actorId),
      ...(lines && { lines: { deleteMany: {}, create: lines.map((line) => ({ ...line, ...createdBy(actorId) })) } }),
    },
    select: structureSelect,
  })
}
