import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for punches and their uploads.

export function createUpload(data: { fileName: string; rowCount: number }, actorId: ActorId, db: DbClient = prisma) {
  return db.punchUpload.create({ data: { ...data, addedCount: 0, duplicateCount: 0, unmatchedCount: 0, ...createdBy(actorId) }, select: { id: true } })
}

export function finishUpload(id: number, counts: { addedCount: number; duplicateCount: number; unmatchedCount: number }, actorId: ActorId, db: DbClient = prisma) {
  return db.punchUpload.update({ where: { id }, data: { ...counts, ...updatedBy(actorId) }, select: { id: true } })
}

// Adds punches; the same code + time already kept is skipped. Returns how many were added.
export async function addPunches(rows: Omit<Prisma.PunchCreateManyInput, 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  let added = 0
  for (let i = 0; i < rows.length; i += 2000) {
    const result = await db.punch.createMany({ data: rows.slice(i, i + 2000).map((r) => ({ ...r, ...createdBy(actorId) })), skipDuplicates: true })
    added += result.count
  }
  return added
}

export function listUploads(take: number, db: DbClient = prisma) {
  return db.punchUpload.findMany({
    orderBy: { id: 'desc' },
    take,
    select: { id: true, fileName: true, rowCount: true, addedCount: true, duplicateCount: true, unmatchedCount: true, createdAt: true, createdById: true },
  })
}

// The codes that matched no employee: how many punches each, the first and the last
export async function listUnmatched(db: DbClient = prisma) {
  const rows = await db.punch.groupBy({ by: ['employeeCode'], where: { employeeId: null }, _count: { _all: true }, _min: { punchedAt: true }, _max: { punchedAt: true }, orderBy: { employeeCode: 'asc' } })
  return rows.map((r) => ({ code: r.employeeCode, punches: r._count._all, first: r._min.punchedAt, last: r._max.punchedAt }))
}

// Gives every unmatched punch of a code to an employee; returns their times
export async function linkCode(code: string, employeeId: number, actorId: ActorId, db: DbClient = prisma) {
  const punches = await db.punch.findMany({ where: { employeeCode: code, employeeId: null }, select: { punchedAt: true } })
  await db.punch.updateMany({ where: { employeeCode: code, employeeId: null }, data: { employeeId, ...updatedBy(actorId) } })
  return punches.map((p) => p.punchedAt)
}

export function countUnmatched(db: DbClient = prisma) {
  return db.punch.count({ where: { employeeId: null } })
}
