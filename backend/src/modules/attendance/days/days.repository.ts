import { createdBy, prisma, SYSTEM_ACTOR, updatedBy, type ActorId, type DayStatus, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for the days' results and HR's corrections, and the reads the day calculation needs (shifts,
// assignments, published roster days, holidays, punches) - one place that reads everything a day depends on.

// a shift with its dated timing (2026-11-23) - a day uses the version in force on it
const shiftSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  versions: { orderBy: { effectiveFrom: 'asc' }, select: { effectiveFrom: true, startMinute: true, endMinute: true, breakMinutes: true, halfSplitMinute: true } },
} satisfies Prisma.ShiftSelect
export type DatedShift = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>
// a pattern with its dated days (2026-11-23)
const patternSelect = { name: true, versions: { orderBy: { effectiveFrom: 'asc' }, select: { effectiveFrom: true, days: true, halfDays: true } } } satisfies Prisma.RosterPatternSelect
export type DatedPattern = Prisma.RosterPatternGetPayload<{ select: typeof patternSelect }>

export function listAllShifts(db: DbClient = prisma) {
  return db.shift.findMany({ select: shiftSelect })
}

export function listAssignments(employeeIds: number[], to: Date, db: DbClient = prisma) {
  return db.shiftAssignment.findMany({
    where: { employeeId: { in: employeeIds }, effectiveFrom: { lte: to } },
    orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'asc' }],
    select: { employeeId: true, policyId: true, patternDay: true, pattern: { select: patternSelect }, effectiveFrom: true },
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

// Which pattern was the default (for employees with no schedule given) from which day - with its dated days (2026-11-23)
export function listDefaultPatterns(db: DbClient = prisma) {
  return db.defaultPatternChange.findMany({ orderBy: { effectiveFrom: 'asc' }, select: { effectiveFrom: true, pattern: { select: patternSelect } } })
}

// Published roster days (drafts do not count)
export function listPublishedRoster(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.rosterEntry.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to }, publishedAt: { not: null } },
    select: { employeeId: true, date: true, shiftId: true },
  })
}

// the automatic holidays from..to with the lists that have each (2026-11-24: a day's holiday comes from the person's list;
// an on-application holiday is a working day - the approved leave taking it covers the day)
export function listHolidays(from: Date, to: Date, db: DbClient = prisma) {
  return db.holiday.findMany({ where: { date: { gte: from, lte: to }, mode: 'AUTOMATIC' }, select: { date: true, name: true, portion: true, lists: { select: { holidayListId: true } } } })
}

// The holiday list each employee follows, from a date (2026-11-24)
// data access: a step of the day calculation - the ids come from people already chosen (and checked) by the caller
export function listEmployeeHolidayLists(employeeIds: number[], db: DbClient = prisma) {
  return db.employeeHolidayList.findMany({ where: { employeeId: { in: employeeIds } }, orderBy: { effectiveFrom: 'asc' }, select: { employeeId: true, holidayListId: true, effectiveFrom: true } })
}

// The employees whose days from..to are already worked out (any of them) - only those are worked out again when a holiday
// or someone's holiday list changes (2026-11-24: never days before attendance started)
// data access: a system step - the ids are only used to work days out again, nothing is returned to a viewer
export async function listEmployeeIdsWithDays(from: Date, to: Date, employeeIds: number[] | undefined, db: DbClient = prisma) {
  const rows = await db.attendanceDay.findMany({
    where: { date: { gte: from, lte: to }, ...(employeeIds && { employeeId: { in: employeeIds } }) },
    distinct: ['employeeId'],
    select: { employeeId: true },
  })
  return rows.map((r) => r.employeeId)
}

export function listPunches(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.punch.findMany({
    where: { employeeId: { in: employeeIds }, punchedAt: { gte: from, lte: to } },
    orderBy: { punchedAt: 'asc' },
    select: { id: true, employeeId: true, employeeCode: true, punchedAt: true, device: true, source: true, uploadId: true, createdAt: true, upload: { select: { fileName: true } } },
  })
}

const correctionSelect = { employeeId: true, date: true, firstHalf: true, secondHalf: true, reason: true, updatedAt: true, updatedById: true } satisfies Prisma.AttendanceCorrectionSelect

export function listCorrections(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.attendanceCorrection.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to } }, select: correctionSelect })
}

// a half left null keeps following the punches
// A half left out (undefined) keeps its correction - correcting one half never wipes the other's (2026-11-23, the review);
// null clears it (back to the punches)
export function upsertCorrection(data: { employeeId: number; date: Date; firstHalf?: DayStatus | null; secondHalf?: DayStatus | null; reason: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.attendanceCorrection.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date: data.date } },
    create: { employeeId: data.employeeId, date: data.date, firstHalf: data.firstHalf ?? null, secondHalf: data.secondHalf ?? null, reason: data.reason, ...createdBy(actorId) },
    update: { ...(data.firstHalf !== undefined && { firstHalf: data.firstHalf }), ...(data.secondHalf !== undefined && { secondHalf: data.secondHalf }), reason: data.reason, ...updatedBy(actorId) },
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

// The stretches these employees' attendance is not tracked by punches ("attendance not tracked", 2026-11-27) that
// touch from..to
// data access: the day calculation asks for the employees it works out - it chose them
export function listExemptions(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.attendanceExemption.findMany({
    where: { employeeId: { in: employeeIds }, fromDate: { lte: to }, OR: [{ toDate: null }, { toDate: { gte: from } }] },
    select: { employeeId: true, fromDate: true, toDate: true },
  })
}

// Only the two halves of these employees' days from..to - what a pay run copies (payroll stage 3, 2026-11-27)
// data access: the payroll service chose the employees - the people of one run it found with whole-company Payroll scope
export function listHalves(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  return db.attendanceDay.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to } },
    orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    select: { employeeId: true, date: true, firstHalf: true, secondHalf: true },
  })
}

// Approved regularization / on-duty requests over from..to (`pending`: also those waiting) - what covers the days besides
// the punches (2026-11-22)
export function listRegularizations(employeeIds: number[], from: Date, to: Date, pending: boolean, db: DbClient = prisma) {
  return db.regularizationRequest.findMany({
    where: { employeeId: { in: employeeIds }, fromDate: { lte: to }, toDate: { gte: from }, status: { in: pending ? ['APPROVED', 'PENDING'] : ['APPROVED'] } },
    select: { employeeId: true, kind: true, fromDate: true, toDate: true, portion: true },
  })
}
