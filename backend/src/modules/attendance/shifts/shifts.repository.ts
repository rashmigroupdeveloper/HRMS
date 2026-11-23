import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for shifts, schedule patterns and who follows which (shift assignments).

// a shift's timing (dated - 2026-11-23: each version runs from a date until the next)
const timingSelect = { startMinute: true, endMinute: true, breakMinutes: true, halfSplitMinute: true } satisfies Prisma.ShiftVersionSelect
export type Timing = Prisma.ShiftVersionGetPayload<{ select: typeof timingSelect }>

export const shiftSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  versions: { orderBy: { effectiveFrom: 'asc' }, select: { id: true, effectiveFrom: true, ...timingSelect, updatedAt: true, updatedById: true } },
} satisfies Prisma.ShiftSelect
export type ShiftRow = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>

export function listShifts(includeInactive: boolean, db: DbClient = prisma) {
  return db.shift.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { code: 'asc' }, select: shiftSelect })
}

export function findShift(id: number, db: DbClient = prisma) {
  return db.shift.findUnique({ where: { id }, select: shiftSelect })
}

// a new shift and its first timing
export async function createShift(data: { code: string; name: string }, timing: Timing, effectiveFrom: Date, actorId: ActorId, db: DbClient = prisma) {
  const shift = await db.shift.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
  await db.shiftVersion.create({ data: { shiftId: shift.id, effectiveFrom, ...timing, ...createdBy(actorId) } })
  return shift.id
}

export function updateShift(id: number, data: { code?: string; name?: string; isActive?: boolean }, actorId: ActorId, db: DbClient = prisma) {
  return db.shift.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// the timing from a date (one from the same date is replaced)
export function upsertShiftVersion(shiftId: number, effectiveFrom: Date, timing: Timing, actorId: ActorId, db: DbClient = prisma) {
  return db.shiftVersion.upsert({
    where: { shiftId_effectiveFrom: { shiftId, effectiveFrom } },
    create: { shiftId, effectiveFrom, ...timing, ...createdBy(actorId) },
    update: { ...timing, ...updatedBy(actorId) },
    select: { id: true },
  })
}

// data access: a shift's timing changed from a date - whoever had a day worked out on it since then, in every company
// (the change is group-wide; only the days are worked out again, nothing is returned)
export async function listEmployeeIdsWithShiftFrom(shiftId: number, from: Date, db: DbClient = prisma) {
  const rows = await db.attendanceDay.findMany({ where: { shiftId, date: { gte: from } }, distinct: ['employeeId'], select: { employeeId: true } })
  return rows.map((r) => r.employeeId)
}


// --- assignments ---

const assignmentSelect = { id: true, employeeId: true, patternId: true, patternDay: true, policyId: true, effectiveFrom: true, createdAt: true, createdById: true } satisfies Prisma.ShiftAssignmentSelect

// Every assignment of these employees that starts on or before `to` (the ones in force are picked per day)
export function listAssignments(employeeIds: number[], to: Date, db: DbClient = prisma) {
  return db.shiftAssignment.findMany({
    where: { employeeId: { in: employeeIds }, effectiveFrom: { lte: to } },
    orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'asc' }],
    select: assignmentSelect,
  })
}

export function listEmployeeAssignments(employeeId: number, db: DbClient = prisma) {
  return db.shiftAssignment.findMany({ where: { employeeId }, orderBy: { effectiveFrom: 'desc' }, select: { ...assignmentSelect, policy: { select: { name: true } }, pattern: { select: { name: true } } } })
}

// Sets an employee's schedule from a date (replacing one that starts that same day)
export function upsertAssignment(
  data: { employeeId: number; patternId: number; patternDay: number; policyId: number | null; effectiveFrom: Date },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.shiftAssignment.upsert({
    where: { employeeId_effectiveFrom: { employeeId: data.employeeId, effectiveFrom: data.effectiveFrom } },
    create: { ...data, ...createdBy(actorId) },
    update: { patternId: data.patternId, patternDay: data.patternDay, policyId: data.policyId, ...updatedBy(actorId) },
    select: { id: true },
  })
}

// --- schedule patterns ---

// a pattern's days (dated - 2026-11-23)
const cycleSelect = { days: true, halfDays: true } satisfies Prisma.RosterPatternVersionSelect
export type Cycle = Prisma.RosterPatternVersionGetPayload<{ select: typeof cycleSelect }>

const patternSelect = {
  id: true,
  name: true,
  isActive: true,
  versions: { orderBy: { effectiveFrom: 'asc' }, select: { id: true, effectiveFrom: true, ...cycleSelect, updatedAt: true, updatedById: true } },
} satisfies Prisma.RosterPatternSelect
export type PatternRow = Prisma.RosterPatternGetPayload<{ select: typeof patternSelect }>

export function listPatterns(includeInactive: boolean, db: DbClient = prisma) {
  return db.rosterPattern.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { name: 'asc' }, select: patternSelect })
}

export function findPattern(id: number, db: DbClient = prisma) {
  return db.rosterPattern.findUnique({ where: { id }, select: patternSelect })
}

// a new pattern and its first days
export async function createPattern(name: string, cycle: Cycle, effectiveFrom: Date, actorId: ActorId, db: DbClient = prisma) {
  const pattern = await db.rosterPattern.create({ data: { name, ...createdBy(actorId) }, select: { id: true } })
  await db.rosterPatternVersion.create({ data: { patternId: pattern.id, effectiveFrom, ...cycle, ...createdBy(actorId) } })
  return pattern.id
}

export function updatePattern(id: number, data: { name?: string; isActive?: boolean }, actorId: ActorId, db: DbClient = prisma) {
  return db.rosterPattern.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// the days from a date (one from the same date is replaced)
export function upsertPatternVersion(patternId: number, effectiveFrom: Date, cycle: Cycle, actorId: ActorId, db: DbClient = prisma) {
  return db.rosterPatternVersion.upsert({
    where: { patternId_effectiveFrom: { patternId, effectiveFrom } },
    create: { patternId, effectiveFrom, ...cycle, ...createdBy(actorId) },
    update: { ...cycle, ...updatedBy(actorId) },
    select: { id: true },
  })
}

// data access: a pattern's days changed from a date - everyone given it on a schedule, in every company (the change is
// group-wide; only the days are worked out again, nothing is returned)
export async function listEmployeeIdsOnPattern(patternId: number, db: DbClient = prisma) {
  const rows = await db.shiftAssignment.findMany({ where: { patternId }, distinct: ['employeeId'], select: { employeeId: true } })
  return rows.map((r) => r.employeeId)
}

// Which pattern is the default from which day (2026-11-23 - dated, so moving it never changes the days before)
export function listDefaultChanges(db: DbClient = prisma) {
  return db.defaultPatternChange.findMany({ orderBy: { effectiveFrom: 'asc' }, select: { id: true, effectiveFrom: true, patternId: true } })
}

// The default from a date (one on the same date is replaced)
export function setDefaultFrom(patternId: number, effectiveFrom: Date, actorId: ActorId, db: DbClient = prisma) {
  return db.defaultPatternChange.upsert({
    where: { effectiveFrom },
    create: { effectiveFrom, patternId, ...createdBy(actorId) },
    update: { patternId, ...updatedBy(actorId) },
    select: { id: true },
  })
}
