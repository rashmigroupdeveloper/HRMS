import { createdBy, prisma, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'

// Database access for the attendance month locks and the attendance settings (the month's start day).

const lockSelect = { id: true, year: true, month: true, lockedAt: true, lockedById: true, unlockedAt: true, unlockedById: true, unlockReason: true } as const

// Every lock (open and opened again) of a year's attendance months, the latest first
export function listLocks(year: number, db: DbClient = prisma) {
  return db.attendanceMonthLock.findMany({ where: { year }, orderBy: [{ month: 'asc' }, { id: 'desc' }], select: lockSelect })
}

// The open lock of a month, if any
export function findOpenLock(year: number, month: number, db: DbClient = prisma) {
  return db.attendanceMonthLock.findFirst({ where: { year, month, unlockedAt: null }, select: lockSelect })
}

// Every month locked now, with when it was locked (for payroll: is a run's whole period locked, and since when)
export function listOpenLocks(db: DbClient = prisma) {
  return db.attendanceMonthLock.findMany({ where: { unlockedAt: null }, select: { year: true, month: true, lockedAt: true } })
}

export function countOpenLocks(db: DbClient = prisma) {
  return db.attendanceMonthLock.count({ where: { unlockedAt: null } })
}

// Holds one attendance month until the transaction ends (locking it is checked and saved only while held)
export async function holdMonth(year: number, month: number, db: DbClient) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('attendance-month-lock'), ${year * 100 + month}::int)::text AS locked`
}

export function createLock(data: { year: number; month: number; lockedAt: Date; lockedById: number }, actorId: ActorId, db: DbClient = prisma) {
  return db.attendanceMonthLock.create({ data: { ...data, ...createdBy(actorId) }, select: lockSelect })
}

export function unlock(id: number, data: { unlockedAt: Date; unlockedById: number; unlockReason: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.attendanceMonthLock.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: lockSelect })
}

export async function findCycleStartDay(db: DbClient = prisma) {
  return (await db.attendanceSetting.findUnique({ where: { id: 1 }, select: { cycleStartDay: true } }))?.cycleStartDay ?? 1
}

export function setCycleStartDay(cycleStartDay: number, actorId: ActorId, db: DbClient = prisma) {
  return db.attendanceSetting.upsert({ where: { id: 1 }, create: { id: 1, cycleStartDay, ...createdBy(actorId) }, update: { cycleStartDay, ...updatedBy(actorId) }, select: { cycleStartDay: true } })
}

// --- the checklist before locking (the whole group's month) ---

// data access: the month lock is for the whole group (Attendance setup Edit for all companies) - counts of every company's days
export function countMissedPunches(from: Date, to: Date, db: DbClient = prisma) {
  return db.attendanceDay.count({ where: { date: { gte: from, lte: to }, OR: [{ firstHalf: 'MISSED_PUNCH' }, { secondHalf: 'MISSED_PUNCH' }] } })
}

// data access: the month lock is for the whole group - every company's shift changes still waiting
export function countPendingShiftChanges(from: Date, to: Date, db: DbClient = prisma) {
  return db.shiftChangeRequest.count({ where: { status: 'PENDING', date: { gte: from, lte: to } } })
}

// data access: the month lock is for the whole group - punches of machine codes that match nobody (no employee), by the
// punch's moment from the month's first day to the day after its last (close enough for a warning)
export function countUnmatchedPunches(from: Date, toExclusive: Date, db: DbClient = prisma) {
  return db.punch.count({ where: { employeeId: null, punchedAt: { gte: from, lt: toExclusive } } })
}
