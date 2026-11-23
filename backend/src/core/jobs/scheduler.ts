import { runWithAuditRequest } from '../audit/request.js'
import { outsideTransaction } from '../audit/capture.js'
import { createdBy, prisma, SYSTEM_ACTOR, updatedBy } from '../db/prisma.js'
import { IST_OFFSET_MS } from '#shared/utils/dates'

// The background worker's scheduler (src/worker.ts, phase 5 - 2026-11-16). Knows nothing about HR: each module gives
// its jobs (<module>.jobs.ts) - a name, when it runs, and what it does.
// - Every minute it checks which jobs are due: every N minutes, daily at a time, or weekly on a day at a time (server
//   time). A run missed while the worker was stopped is done once when it starts again.
// - One run at a time per job, even with two workers: a run holds a database lock (pg_try_advisory_xact_lock) in a
//   transaction of its own; the job's work runs outside it, so its changes save (and go into the change history) as
//   usual. If the worker dies, the lock goes with its connection.
// - Each run is recorded in job_runs (started, finished, OK / FAILED, what it did or why it failed); runs older than
//   KEEP_DAYS are removed.
// - The job's changes are recorded in the change history as by System, source "job:<name>".

export type JobSchedule = { everyMinutes: number } | { dailyAt: string } | { weeklyOn: number; at: string }
export type Job = {
  // e.g. "accounts.removeExpiredSessions"
  name: string
  schedule: JobSchedule
  // does the work and says what it did ("3 expired sessions removed")
  run: () => Promise<string>
}

const TICK_MS = 60_000
const KEEP_DAYS = 90
// a run may take this long (it holds its lock until then)
const MAX_RUN_MS = 30 * 60_000
// a run still "RUNNING" after this long was left by a worker that stopped
const STALE_MS = 6 * 60 * 60_000

// The latest moment the job was due, at or before `now`
function lastDueAt(schedule: JobSchedule, now: Date): Date {
  if ('everyMinutes' in schedule) return new Date(now.getTime() - schedule.everyMinutes * 60_000)
  const [hours = 0, minutes = 0] = ('dailyAt' in schedule ? schedule.dailyAt : schedule.at).split(':').map(Number)
  // the times are India's (07:30 = 07:30 IST whatever the server's time zone - 2026-11-23, the review): worked out on the
  // Indian wall clock, held in the UTC fields
  const wallNow = new Date(now.getTime() + IST_OFFSET_MS)
  const slot = new Date(wallNow)
  slot.setUTCHours(hours, minutes, 0, 0)
  if ('weeklyOn' in schedule) {
    slot.setUTCDate(slot.getUTCDate() - ((slot.getUTCDay() - schedule.weeklyOn + 7) % 7))
    if (slot > wallNow) slot.setUTCDate(slot.getUTCDate() - 7)
  } else if (slot > wallNow) {
    slot.setUTCDate(slot.getUTCDate() - 1)
  }
  return new Date(slot.getTime() - IST_OFFSET_MS)
}

// Due when it never ran, or its last start was before the latest due moment
function isDue(schedule: JobSchedule, lastStart: Date | undefined, now: Date) {
  if (!lastStart) return true
  return 'everyMinutes' in schedule ? lastStart <= lastDueAt(schedule, now) : lastStart < lastDueAt(schedule, now)
}

async function lastStartOf(job: string) {
  return (await prisma.jobRun.findFirst({ where: { job }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }))?.startedAt
}

// Runs the job once if it is due and no other worker is running it
async function runIfDue(job: Job) {
  const now = new Date()
  if (!isDue(job.schedule, await lastStartOf(job.name), now)) return
  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${`job:${job.name}`})) AS locked`
        const locked = rows[0]?.locked === true
        // another worker has it - or ran it a moment ago
        if (!locked || !isDue(job.schedule, await lastStartOf(job.name), new Date())) return
        await outsideTransaction(() => runOnce(job))
      },
      { timeout: MAX_RUN_MS, maxWait: 10_000 },
    )
  } catch (error) {
    console.error(`[worker] ${job.name} could not run:`, error)
  }
}

async function runOnce(job: Job) {
  const run = await prisma.jobRun.create({ data: { job: job.name, status: 'RUNNING', startedAt: new Date(), ...createdBy(SYSTEM_ACTOR) }, select: { id: true } })
  try {
    const summary = await runWithAuditRequest({ source: `job:${job.name}`, ip: null, userAgent: null, actorId: SYSTEM_ACTOR }, job.run)
    await prisma.jobRun.update({ where: { id: run.id }, data: { status: 'OK', finishedAt: new Date(), summary, ...updatedBy(SYSTEM_ACTOR) } })
    console.log(`[worker] ${job.name}: ${summary}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.jobRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), error: message.slice(0, 2000), ...updatedBy(SYSTEM_ACTOR) } })
    console.error(`[worker] ${job.name} failed:`, error)
  }
}

// Starts checking the jobs every minute (and once now). Returns a function that stops it.
export async function startScheduler(jobs: Job[]) {
  // runs a stopped worker left "RUNNING"
  await prisma.jobRun.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: 'FAILED', finishedAt: new Date(), error: 'The worker stopped while this ran', ...updatedBy(SYSTEM_ACTOR) },
  })
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      for (const job of jobs) await runIfDue(job)
      await prisma.jobRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } })
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void tick(), TICK_MS)
  await tick()
  return () => clearInterval(timer)
}
