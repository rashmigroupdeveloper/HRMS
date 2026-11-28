import { prisma, type DbClient } from '#core/db/prisma'
import type { RunsInput } from './master-controls.schema.js'

// Operational records only. The service authorizes the pinned developer account before any of these reads.
export async function ping(db: DbClient = prisma) {
  await db.$queryRaw`SELECT 1`
}

export function jobCounts(since: Date, db: DbClient = prisma) {
  return db.jobRun.groupBy({ by: ['status'], where: { startedAt: { gte: since } }, _count: { _all: true } })
}

// Exact hourly bins; no limit that could make chart totals disagree with the headline.
export function jobTimeline(since: Date, db: DbClient = prisma) {
  return db.$queryRaw<{ hour: Date; status: string; count: number }[]>`
    SELECT date_trunc('hour', started_at) AS hour, status::text AS status, count(*)::int AS count
    FROM job_runs WHERE started_at >= ${since}
    GROUP BY 1, 2 ORDER BY 1`
}

export function workerActivity(db: DbClient = prisma) {
  return db.jobRun.findFirst({ where: { job: 'mail.retryFailedMails' }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: { startedAt: true, finishedAt: true, status: true } })
}

export function mailCounts(db: DbClient = prisma) {
  return db.mailRetry.groupBy({ by: ['status'], _count: { _all: true }, _min: { createdAt: true } })
}

// No recipients, subjects, bodies, attachments, reset codes or tokens are selected.
export function waitingMail(db: DbClient = prisma) {
  return db.mailRetry.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 12,
    select: { id: true, status: true, attempts: true, createdAt: true, nextAttemptAt: true } })
}

// Migration metadata only; never executes a migration from a web request.
export async function migrations(db: DbClient = prisma) {
  const rows = await db.$queryRaw<{ applied: number; unresolved: number; latest: Date | null }[]>`
    SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied,
      count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unresolved,
      max(finished_at) FILTER (WHERE rolled_back_at IS NULL) AS latest FROM _prisma_migrations`
  return rows[0] ?? { applied: 0, unresolved: 0, latest: null }
}

export async function listRuns(input: RunsInput, since: Date, db: DbClient = prisma) {
  const where = { startedAt: { gte: since }, ...(input.status !== 'ALL' && { status: input.status }),
    ...(input.search && { job: { contains: input.search, mode: 'insensitive' as const } }) }
  const [items, total] = await Promise.all([
    db.jobRun.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * 20, take: 20,
      select: { id: true, job: true, status: true, startedAt: true, finishedAt: true, error: true } }),
    db.jobRun.count({ where }),
  ])
  return { items, total }
}
