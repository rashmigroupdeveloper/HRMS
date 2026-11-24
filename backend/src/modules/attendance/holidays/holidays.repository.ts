import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for the holidays and the lists that have each (2026-11-24).

const holidaySelect = {
  id: true,
  date: true,
  name: true,
  portion: true,
  mode: true,
  allowHalfDay: true,
  leaveType: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, name: true, tone: true } },
  lists: { orderBy: { holidayList: { name: 'asc' } }, select: { holidayList: { select: { id: true, name: true, companyId: true } } } },
} satisfies Prisma.HolidaySelect
export type HolidayRow = Prisma.HolidayGetPayload<{ select: typeof holidaySelect }>

// the holidays from..to (only one list's, when given)
export function listBetween(from: Date, to: Date, holidayListId?: number, db: DbClient = prisma) {
  return db.holiday.findMany({
    where: { date: { gte: from, lte: to }, ...(holidayListId && { lists: { some: { holidayListId } } }) },
    orderBy: [{ date: 'asc' }, { name: 'asc' }],
    select: holidaySelect,
  })
}

export function find(id: number, db: DbClient = prisma) {
  return db.holiday.findUnique({ where: { id }, select: holidaySelect })
}

// A holiday already on that date in one of these lists (a list has at most one a day) - the other holiday's name and lists
export function findOnDateInLists(date: Date, holidayListIds: number[], exceptId: number | undefined, db: DbClient = prisma) {
  return db.holiday.findFirst({
    where: { date, lists: { some: { holidayListId: { in: holidayListIds } } }, ...(exceptId && { id: { not: exceptId } }) },
    select: { name: true, lists: { where: { holidayListId: { in: holidayListIds } }, select: { holidayList: { select: { name: true } } } } },
  })
}

export function create(data: NewRow<Prisma.HolidayUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.holiday.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

export function update(id: number, data: Prisma.HolidayUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.holiday.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// The lists that have the holiday from now on: those left out are taken off, the new ones added
export async function setLists(holidayId: number, holidayListIds: number[], actorId: ActorId, db: DbClient = prisma) {
  await db.holidayListEntry.deleteMany({ where: { holidayId, holidayListId: { notIn: holidayListIds } } })
  const have = new Set((await db.holidayListEntry.findMany({ where: { holidayId }, select: { holidayListId: true } })).map((e) => e.holidayListId))
  const add = holidayListIds.filter((id) => !have.has(id))
  if (add.length) await db.holidayListEntry.createMany({ data: add.map((holidayListId) => ({ holidayId, holidayListId, ...createdBy(actorId) })) })
}

// The on-application holidays from..to, with the lists that have each (who may take one comes from their list)
export function listOnApplication(from: Date, to: Date, db: DbClient = prisma) {
  return db.holiday.findMany({
    where: { date: { gte: from, lte: to }, mode: 'ON_APPLICATION' },
    orderBy: { date: 'asc' },
    select: { date: true, name: true, leaveTypeId: true, allowHalfDay: true, lists: { select: { holidayListId: true } } },
  })
}

export function remove(id: number, db: DbClient = prisma) {
  return db.holiday.delete({ where: { id }, select: { id: true } })
}
