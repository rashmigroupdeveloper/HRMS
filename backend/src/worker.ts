import { prisma } from '#core/db/prisma'
import { startScheduler } from '#core/jobs/scheduler'
import { mailJobs } from '#core/mail/mailer'
import { accountsJobs } from '#modules/accounts'
import { approvalsJobs } from '#modules/approvals'
import { attendanceJobs } from '#modules/attendance'
import { candidatesJobs } from '#modules/candidates'
import { jobChangesJobs } from '#modules/job-changes'
import { joiningTasksJobs } from '#modules/joining-tasks'
import { leaveJobs } from '#modules/leave'
// (no jobs of its own: loaded so its approval handler is registered - a pay run's approval time limits run here)
import '#modules/payroll'

// The background worker (phase 5, 2026-11-16): runs every module's scheduled jobs (<module>.jobs.ts). A process of its
// own next to the API (npm run worker); a second worker is harmless - each job runs once at a time.
const jobs = [...mailJobs, ...accountsJobs, ...candidatesJobs, ...joiningTasksJobs, ...attendanceJobs, ...leaveJobs, ...approvalsJobs, ...jobChangesJobs]
const stop = await startScheduler(jobs)
console.log(`Worker ready - ${jobs.length} jobs: ${jobs.map((j) => j.name).join(', ')}`)

async function shutdown(signal: string) {
  console.log(`${signal} received, stopping the worker...`)
  stop()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
