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

// Adds rows; a credit / lapse / comp-off expiry already there for its period is skipped (the job may run twice) - returns
// how many were added. Any number of rows: written in batches well under the database's limit of 65,535 values in one
// statement (a row is about a dozen values) - the nightly credit sends all its months at once (2026-11-27)
const BATCH = 2000
export async function addEntries(rows: NewEntry[], actorId: ActorId, db: DbClient = prisma) {
  let added = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { count } = await db.leaveLedgerEntry.createMany({ data: rows.slice(i, i + BATCH).map((r) => ({ ...r, ...createdBy(actorId) })), skipDuplicates: true })
    added += count
  }
  return added
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

// data access: the year-end job - every employee who has rows of these types, or only the employees named (HR's run and
// the tests); no one's data is returned to a user
// The balance per employee and type, up to a day (what lapses at the year end) - and the leave on later days already
// taken (less given back) by `recordedBefore`: `takenLater`, negative or 0. All the types at once (2026-11-27: one
// type at a time it was two sums of everyone's rows per type, and the asked employees were picked out afterwards)
export async function sumAtYearEnd(leaveTypeIds: number[], until: Date, recordedBefore: Date, employeeIds: number[] | undefined, db: DbClient = prisma) {
  if (!leaveTypeIds.length || employeeIds?.length === 0) return []
  const whose = { leaveTypeId: { in: leaveTypeIds }, ...(employeeIds && { employeeId: { in: employeeIds } }) }
  const [rows, later] = await Promise.all([
    db.leaveLedgerEntry.groupBy({ by: ['employeeId', 'leaveTypeId'], where: { ...whose, effectiveDate: { lte: until } }, _sum: { days: true } }),
    db.leaveLedgerEntry.groupBy({ by: ['employeeId', 'leaveTypeId'], where: { ...whose, effectiveDate: { gt: until }, kind: { in: ['TAKEN', 'RETURNED'] }, createdAt: { lt: recordedBefore } }, _sum: { days: true } }),
  ])
  const laterOf = new Map(later.map((r) => [`${r.employeeId}:${r.leaveTypeId}`, r._sum.days?.toNumber() ?? 0]))
  return rows.map((r) => ({ employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, days: r._sum.days?.toNumber() ?? 0, takenLater: Math.min(0, laterOf.get(`${r.employeeId}:${r.leaveTypeId}`) ?? 0) }))
}

// data access: the daily comp-off expiry job - every employee who has comp-off rows, or only the employees named (HR's
// run and the tests); no one's data is returned to a user
// Every row of the comp-off type, per employee in date order - the expiry follows which days each leave used
export function listCompOffRows(leaveTypeId: number, employeeIds: number[] | undefined, db: DbClient = prisma) {
  return db.leaveLedgerEntry.findMany({
    where: { leaveTypeId, ...(employeeIds && { employeeId: { in: employeeIds } }) },
    orderBy: [{ employeeId: 'asc' }, { effectiveDate: 'asc' }, { createdAt: 'asc' }],
    select: { employeeId: true, kind: true, days: true, effectiveDate: true, expiresOn: true, applicationId: true },
  })
}

