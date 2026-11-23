import { createdBy, prisma, type ActorId, type DbClient, type LeaveEntryKind, type Prisma } from '#core/db/prisma'

// Database access for the leave balance ledger (2026-11-22). Rows are only ever added - never changed or removed.

export type NewEntry = {
  employeeId: number
  leaveTypeId: number
  kind: LeaveEntryKind
  days: number
  effectiveDate: Date
  period?: string | null
  applicationId?: number | null
  note?: string | null
  // a comp-off credit: when it expires, and the claim it was earned by
  expiresOn?: Date | null
  compOffClaimId?: number | null
}

// Adds rows; a credit / lapse already there for its period is skipped (the job may run twice) - returns how many were added
export async function addEntries(rows: NewEntry[], actorId: ActorId, db: DbClient = prisma) {
  if (!rows.length) return 0
  const { count } = await db.leaveLedgerEntry.createMany({ data: rows.map((r) => ({ ...r, ...createdBy(actorId) })), skipDuplicates: true })
  return count
}

// The balance of each of these employees per type: the sum of their rows (up to a day, if given)
export async function sumBalances(employeeIds: number[], until?: Date, db: DbClient = prisma) {
  if (!employeeIds.length) return []
  const rows = await db.leaveLedgerEntry.groupBy({
    by: ['employeeId', 'leaveTypeId'],
    where: { employeeId: { in: employeeIds }, ...(until && { effectiveDate: { lte: until } }) },
    _sum: { days: true },
  })
  return rows.map((r) => ({ employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, days: r._sum.days?.toNumber() ?? 0 }))
}

// What each of these employees got / used in a span (the year): the sum per type and kind
export async function sumByKind(employeeIds: number[], from: Date, to: Date, db: DbClient = prisma) {
  if (!employeeIds.length) return []
  const rows = await db.leaveLedgerEntry.groupBy({
    by: ['employeeId', 'leaveTypeId', 'kind'],
    where: { employeeId: { in: employeeIds }, effectiveDate: { gte: from, lte: to } },
    _sum: { days: true },
  })
  return rows.map((r) => ({ employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, kind: r.kind, days: r._sum.days?.toNumber() ?? 0 }))
}

// The days still waiting for approval per employee and type (they are kept back from the balance)
export async function sumPending(employeeIds: number[], db: DbClient = prisma) {
  if (!employeeIds.length) return []
  const rows = await db.leaveApplication.groupBy({ by: ['employeeId', 'leaveTypeId'], where: { employeeId: { in: employeeIds }, status: 'PENDING' }, _sum: { days: true } })
  return rows.map((r) => ({ employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, days: r._sum.days?.toNumber() ?? 0 }))
}

const entrySelect = {
  id: true,
  leaveTypeId: true,
  kind: true,
  days: true,
  effectiveDate: true,
  period: true,
  note: true,
  expiresOn: true,
  createdAt: true,
  createdById: true,
  leaveType: { select: { code: true, name: true } },
  application: { select: { fromDate: true, toDate: true } },
} satisfies Prisma.LeaveLedgerEntrySelect

// One employee's rows over a span (the year), newest first
export function listEntries(employeeId: number, from: Date, to: Date, db: DbClient = prisma) {
  return db.leaveLedgerEntry.findMany({ where: { employeeId, effectiveDate: { gte: from, lte: to } }, orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }], select: entrySelect })
}

// data access: the year-end job - every employee who has rows of the type (no one's data is returned to a user)
// The balance of everyone with rows of a type, up to a day (what lapses at the year end)
export async function sumTypeForEveryone(leaveTypeId: number, until: Date, db: DbClient = prisma) {
  const rows = await db.leaveLedgerEntry.groupBy({ by: ['employeeId'], where: { leaveTypeId, effectiveDate: { lte: until } }, _sum: { days: true } })
  return rows.map((r) => ({ employeeId: r.employeeId, days: r._sum.days?.toNumber() ?? 0 }))
}

// data access: the daily comp-off expiry job - every employee who has comp-off rows (no one's data is returned to a user)
// Per employee, of the comp-off type: the balance, the comp-off credits not expired on `day`, and HR's positive adjustments
// (which never expire)
export async function compOffStanding(leaveTypeId: number, day: Date, db: DbClient = prisma) {
  const [totals, live, given] = await Promise.all([
    db.leaveLedgerEntry.groupBy({ by: ['employeeId'], where: { leaveTypeId }, _sum: { days: true } }),
    db.leaveLedgerEntry.groupBy({ by: ['employeeId'], where: { leaveTypeId, kind: 'COMP_OFF', expiresOn: { gte: day } }, _sum: { days: true } }),
    db.leaveLedgerEntry.groupBy({ by: ['employeeId'], where: { leaveTypeId, kind: 'ADJUSTMENT', days: { gt: 0 } }, _sum: { days: true } }),
  ])
  const liveOf = new Map(live.map((r) => [r.employeeId, r._sum.days?.toNumber() ?? 0]))
  const givenOf = new Map(given.map((r) => [r.employeeId, r._sum.days?.toNumber() ?? 0]))
  return totals.map((r) => ({ employeeId: r.employeeId, balance: r._sum.days?.toNumber() ?? 0, live: liveOf.get(r.employeeId) ?? 0, given: givenOf.get(r.employeeId) ?? 0 }))
}
