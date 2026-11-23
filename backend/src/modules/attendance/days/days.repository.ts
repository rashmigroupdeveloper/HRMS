import { createdBy, prisma, SYSTEM_ACTOR, updatedBy, type ActorId, type DayStatus, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for the days' results and HR's corrections, and the reads the day calculation needs (shifts,
// assignments, published roster days, holidays, punches) - one place that reads everything a day depends on.

const shiftSelect = { id: true, code: true, name: true, startMinute: true, endMinute: true, breakMinutes: true, halfSplitMinute: true, isActive: true } satisfies Prisma.ShiftSelect
export type PlanShift = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>

export function listAllShifts(db: DbClient = prisma) {
  return db.shift.findMany({ select: shiftSelect })
}

export function listAssignments(employeeIds: number[], to: Date, db: DbClient = prisma) {
  return db.shiftAssignment.findMany({
    where: { employeeId: { in: employeeIds }, effectiveFrom: { lte: to } },
    orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'asc' }],
    select: { employeeId: true, policyId: true, patternDay: true, pattern: { select: { name: true, days: true, halfDays: true } }, effectiveFrom: true },
  })
}

// Every attendance policy, retired ones too (a day may still use one), with its dated rules (2026-11-23)
export function listPolicies(db: DbClient = prisma) {
  return db.attendancePolicy.findMany({
    select: {
      id: true,
      name: true,
      isDefault: true,
      isActive: true,
      versions: { orderBy: { effectiveFrom: 'asc' }, select: { effectiveFrom: true, graceMinutes: true, fullDayMinutes: true, halfDayMinutes: true, latesPerHalfDayCut: true, veryLateMinutes: true, veryEarlyMinutes: true } },
    },
  })
}

// The default schedule pattern in use (exactly one - for employees with no schedule given)
export function findDefaultPattern(db: DbClient = prisma) {
  return db.rosterPattern.findFirst({ where: { isDefault: true, isActive: true }, select: { name: true, days: true, halfDays: true } })
}

// Published roster days (drafts do not count)
export function listPublishedRoster(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.rosterEntry.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to }, publishedAt: { not: null } },
    select: { employeeId: true, date: true, shiftId: true },
  })
}

export function listHolidays(from: Date, to: Date, db: DbClient = prisma) {
  return db.holiday.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, name: true, companyId: true, workLocationId: true } })
}

export function listPunches(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.punch.findMany({
    where: { employeeId: { in: employeeIds }, punchedAt: { gte: from, lte: to } },
    orderBy: { punchedAt: 'asc' },
    select: { employeeId: true, punchedAt: true, device: true },
  })
}

const correctionSelect = { employeeId: true, date: true, firstHalf: true, secondHalf: true, reason: true, updatedAt: true, updatedById: true } satisfies Prisma.AttendanceCorrectionSelect

export function listCorrections(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.attendanceCorrection.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to } }, select: correctionSelect })
}

// a half left null keeps following the punches
export function upsertCorrection(data: { employeeId: number; date: Date; firstHalf: DayStatus | null; secondHalf: DayStatus | null; reason: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.attendanceCorrection.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date: data.date } },
    create: { ...data, ...createdBy(actorId) },
    update: { firstHalf: data.firstHalf, secondHalf: data.secondHalf, reason: data.reason, ...updatedBy(actorId) },
    select: correctionSelect,
  })
}

export function deleteCorrection(employeeId: number, date: Date, db: DbClient = prisma) {
  return db.attendanceCorrection.deleteMany({ where: { employeeId, date } })
}

// --- the days' results (always by System) ---

export type DayRow = {
  employeeId: number
  date: Date
  shiftId: number | null
  status: DayStatus
  firstHalf: DayStatus
  secondHalf: DayStatus
  autoStatus: DayStatus
  firstIn: Date | null
  lastOut: Date | null
  punchCount: number
  workedMinutes: number
  lateMinutes: number
  earlyMinutes: number
  // why a policy rule made a half absent
  note: string | null
}

// --- the attendance month and its locks (2026-11-22) ---

// The day an attendance month starts (1 = the calendar month; RML: 26) - the one settings row
export async function findCycleStartDay(db: DbClient = prisma) {
  return (await db.attendanceSetting.findUnique({ where: { id: 1 }, select: { cycleStartDay: true } }))?.cycleStartDay ?? 1
}

// The attendance months locked now (an open lock)
export function listOpenLocks(db: DbClient = prisma) {
  return db.attendanceMonthLock.findMany({ where: { unlockedAt: null }, select: { year: true, month: true } })
}

// The results of one employee's days from..to replace the ones kept
// Holds these employees' attendance days until the transaction ends (in id order, so two batches never wait on each other
// in a circle) - a recompute reads and writes them only while it holds them (2026-11-23)
export async function lockEmployees(employeeIds: number[], db: DbClient) {
  if (!employeeIds.length) return
  const ids = [...new Set(employeeIds)].sort((a, b) => a - b)
  await db.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('attendance-days'), id))::int AS locked FROM unnest(${ids}::int[]) AS id`
}

export async function replaceDays(employeeId: number, from: Date, to: Date, rows: DayRow[], db: DbClient = prisma) {
  await db.attendanceDay.deleteMany({ where: { employeeId, date: { gte: from, lte: to } } })
  if (rows.length) await db.attendanceDay.createMany({ data: rows.map((row) => ({ ...row, ...createdBy(SYSTEM_ACTOR) })) })
}

const daySelect = {
  employeeId: true,
  date: true,
  status: true,
  firstHalf: true,
  secondHalf: true,
  autoStatus: true,
  firstIn: true,
  lastOut: true,
  punchCount: true,
  workedMinutes: true,
  lateMinutes: true,
  earlyMinutes: true,
  note: true,
  shift: { select: { id: true, code: true, name: true } },
} satisfies Prisma.AttendanceDaySelect

export function listDays(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.attendanceDay.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to } }, orderBy: { date: 'asc' }, select: daySelect })
}

// Approved regularization / on-duty requests over from..to (`pending`: also those waiting) - what covers the days besides
// the punches (2026-11-22)
export function listRegularizations(employeeIds: number[], from: Date, to: Date, pending: boolean, db: DbClient = prisma) {
  return db.regularizationRequest.findMany({
    where: { employeeId: { in: employeeIds }, fromDate: { lte: to }, toDate: { gte: from }, status: { in: pending ? ['APPROVED', 'PENDING'] : ['APPROVED'] } },
    select: { employeeId: true, kind: true, fromDate: true, toDate: true, portion: true },
  })
}
