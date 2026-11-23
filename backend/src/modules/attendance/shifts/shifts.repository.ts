import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for shifts, schedule patterns and who follows which (shift assignments).

export const shiftSelect = {
  id: true,
  code: true,
  name: true,
  startMinute: true,
  endMinute: true,
  breakMinutes: true,
  halfSplitMinute: true,
  isActive: true,
} satisfies Prisma.ShiftSelect
export type ShiftRow = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>

export function listShifts(includeInactive: boolean, db: DbClient = prisma) {
  return db.shift.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ startMinute: 'asc' }, { code: 'asc' }], select: shiftSelect })
}

export function findShift(id: number, db: DbClient = prisma) {
  return db.shift.findUnique({ where: { id }, select: shiftSelect })
}

export function createShift(data: NewRow<Prisma.ShiftUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.shift.create({ data: { ...data, ...createdBy(actorId) }, select: shiftSelect })
}

export function updateShift(id: number, data: Prisma.ShiftUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.shift.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: shiftSelect })
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

const patternSelect = { id: true, name: true, days: true, halfDays: true, isDefault: true, isActive: true } satisfies Prisma.RosterPatternSelect

export function listPatterns(includeInactive: boolean, db: DbClient = prisma) {
  return db.rosterPattern.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: patternSelect })
}

export function findPattern(id: number, db: DbClient = prisma) {
  return db.rosterPattern.findUnique({ where: { id }, select: patternSelect })
}

export function createPattern(data: { name: string; days: number[]; halfDays: number[] }, actorId: ActorId, db: DbClient = prisma) {
  return db.rosterPattern.create({ data: { ...data, ...createdBy(actorId) }, select: patternSelect })
}

export function updatePattern(id: number, data: Prisma.RosterPatternUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.rosterPattern.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: patternSelect })
}

// Only one default pattern: the others lose the flag
export function clearDefaultPattern(exceptId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.rosterPattern.updateMany({ where: { isDefault: true, id: { not: exceptId } }, data: { isDefault: false, ...updatedBy(actorId) } })
}
