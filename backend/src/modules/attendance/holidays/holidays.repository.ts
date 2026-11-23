import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for the holiday calendar.

const holidaySelect = {
  id: true,
  date: true,
  name: true,
  companyId: true,
  workLocationId: true,
  company: { select: { code: true, name: true } },
  workLocation: { select: { name: true } },
} satisfies Prisma.HolidaySelect

export function listBetween(from: Date, to: Date, db: DbClient = prisma) {
  return db.holiday.findMany({ where: { date: { gte: from, lte: to } }, orderBy: [{ date: 'asc' }, { name: 'asc' }], select: holidaySelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.holiday.findUnique({ where: { id }, select: holidaySelect })
}

// The same holiday for the same company / location already on that date
export function findSame(date: Date, companyId: number | null, workLocationId: number | null, db: DbClient = prisma) {
  return db.holiday.findFirst({ where: { date, companyId, workLocationId }, select: { id: true } })
}

export function create(data: NewRow<Prisma.HolidayUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.holiday.create({ data: { ...data, ...createdBy(actorId) }, select: holidaySelect })
}

export function update(id: number, data: Prisma.HolidayUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.holiday.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: holidaySelect })
}

export function remove(id: number, db: DbClient = prisma) {
  return db.holiday.delete({ where: { id }, select: { id: true } })
}
