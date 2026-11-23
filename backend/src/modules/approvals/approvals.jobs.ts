import type { Job } from '#core/jobs/scheduler'
import * as approvalsService from './approvals.service.js'

// The approvals module's scheduled jobs (registered in src/worker.ts; server time)
export const approvalsJobs: Job[] = [
  {
    // requests still waiting: the employee left (cancelled), held ones sent through again, steps given to a new manager /
    // HOD (reminders: approvals.timeLimits)
    name: 'approvals.daily',
    schedule: { dailyAt: '07:30' },
    run: () => approvalsService.runDaily(),
  },
  {
    // steps past their SLA (2026-11-20): wait (the approver reminded every SLA hours), escalate, approve, expire or reject - as
    // their chain says
    name: 'approvals.timeLimits',
    schedule: { everyMinutes: 60 },
    run: () => approvalsService.runTimeLimits(),
  },
]
