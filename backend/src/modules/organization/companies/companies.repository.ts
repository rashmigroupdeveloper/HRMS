import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

const companySelect = {
  id: true,
  code: true,
  name: true,
  ecodePrefix: true,
  nextEmployeeNumber: true,
  sapCompanyCode: true,
  isIndiaPayroll: true,
  address: true,
  postalCode: true,
  countryCode: true,
  region: true,
  pfEstablishmentCode: true,
  esicEmployerCode: true,
  pan: true,
  tan: true,
  gstin: true,
  ptRegistrationNo: true,
  isActive: true,
} satisfies Prisma.CompanySelect

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.company.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    select: companySelect,
  })
}

// The company with this id, or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.company.findUnique({ where: { id }, select: companySelect })
}

export function create(data: NewRow<Prisma.CompanyCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.company.create({ data: { ...data, ...createdBy(actorId) }, select: companySelect })
}

// Takes the company's next employee number and moves its counter on by one. The UPDATE locks the company row until the
// transaction ends, so two people joining at the same moment never get the same number. Null when no series is set.
export async function takeNextEmployeeNumber(id: number, actorId: ActorId, db: DbClient = prisma) {
  const row = await db.company.update({
    where: { id },
    data: { nextEmployeeNumber: { increment: 1 }, ...updatedBy(actorId) },
    select: { ecodePrefix: true, nextEmployeeNumber: true },
  })
  return row.nextEmployeeNumber === null ? null : { prefix: row.ecodePrefix, number: row.nextEmployeeNumber - 1 }
}

export function update(id: number, data: Prisma.CompanyUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.company.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: companySelect })
}
