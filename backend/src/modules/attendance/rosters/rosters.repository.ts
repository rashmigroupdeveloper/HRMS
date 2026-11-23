import { createdBy, prisma, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'

// Database access for roster days.

const entrySelect = { employeeId: true, date: true, shiftId: true, publishedAt: true } as const

export function listEntries(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.rosterEntry.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to } }, select: entrySelect })
}

// Sets a day (a draft stays a draft; `publish` makes it published at once - an approved change, HR's edit)
export function upsertEntry(data: { employeeId: number; date: Date; shiftId: number | null; publish: boolean }, actorId: ActorId, db: DbClient = prisma) {
  const published = data.publish ? { publishedAt: new Date(), publishedById: actorId } : {}
  return db.rosterEntry.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date: data.date } },
    create: { employeeId: data.employeeId, date: data.date, shiftId: data.shiftId, ...published, ...createdBy(actorId) },
    update: { shiftId: data.shiftId, ...published, ...updatedBy(actorId) },
    select: entrySelect,
  })
}

// Takes a draft day out (a published one stays)
export function deleteDraft(employeeId: number, date: Date, db: DbClient = prisma) {
  return db.rosterEntry.deleteMany({ where: { employeeId, date, publishedAt: null } })
}

// Takes a day out, draft or published - back to the default (a day set to the default is not kept - 2026-11-22)
export function deleteEntry(employeeId: number, date: Date, db: DbClient = prisma) {
  return db.rosterEntry.deleteMany({ where: { employeeId, date } })
}

// Publishes the draft days of these employees in the range; returns how many
export async function publish(employeeIds: number[], from: Date, to: Date, actorId: ActorId, db: DbClient = prisma) {
  const result = await db.rosterEntry.updateMany({
    where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to }, publishedAt: null },
    data: { publishedAt: new Date(), publishedById: actorId, ...updatedBy(actorId) },
  })
  return result.count
}

// One day of an employee (published or not), or null
export function findEntry(employeeId: number, date: Date, db: DbClient = prisma) {
  return db.rosterEntry.findUnique({ where: { employeeId_date: { employeeId, date } }, select: entrySelect })
}
