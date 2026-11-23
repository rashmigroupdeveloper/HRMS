import { prisma, type AuditAction, type DbClient, type Prisma } from '#core/db/prisma'

// Data access for the change history (audit_logs). Rows are written only by core/audit; here they are only read.

export type HistoryFilter = {
  from?: Date | undefined
  // before this moment (the day after the last day asked for)
  before?: Date | undefined
  actorId?: number | undefined
  employeeId?: number | undefined
  candidateId?: number | undefined
  model?: string | undefined
  action?: AuditAction | undefined
}

const historySelect = {
  id: true,
  action: true,
  model: true,
  recordId: true,
  employeeId: true,
  candidateId: true,
  source: true,
  changes: true,
  details: true,
  ip: true,
  createdAt: true,
  createdById: true,
} satisfies Prisma.AuditLogSelect

// One page, newest first, and how many rows match
export async function list(filter: HistoryFilter, page: { skip: number; take: number }, db: DbClient = prisma) {
  const where: Prisma.AuditLogWhereInput = {
    ...((filter.from || filter.before) && { createdAt: { ...(filter.from && { gte: filter.from }), ...(filter.before && { lt: filter.before }) } }),
    ...(filter.actorId !== undefined && { createdById: filter.actorId }),
    ...(filter.employeeId !== undefined && { employeeId: filter.employeeId }),
    ...(filter.candidateId !== undefined && { candidateId: filter.candidateId }),
    ...(filter.model && { model: filter.model }),
    ...(filter.action && { action: filter.action }),
  }
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { id: 'desc' }, skip: page.skip, take: page.take, select: historySelect }),
    db.auditLog.count({ where }),
  ])
  return { rows, total }
}

// The kinds of record that appear in the history
// data access: the names of the tables in the history - no one's data
export async function listModels(db: DbClient = prisma) {
  const rows = await db.auditLog.findMany({ where: { model: { not: null } }, distinct: ['model'], select: { model: true }, orderBy: { model: 'asc' } })
  return rows.map((row) => row.model!)
}

// Rows in chain order after `afterId`, with everything their fingerprint covers - for the integrity check
// data access: the integrity check reads every row - allowed only with Change history View for all companies (changeHistory.verify)
export function listChain(afterId: number, take: number, db: DbClient = prisma) {
  return db.auditLog.findMany({
    where: { id: { gt: afterId } },
    orderBy: { id: 'asc' },
    take,
    select: { ...historySelect, userAgent: true, previousHash: true, hash: true },
  })
}
