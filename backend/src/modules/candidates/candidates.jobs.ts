import type { Job } from '#core/jobs/scheduler'
import * as backgroundChecksService from './background-checks/background-checks.service.js'
import * as candidatesService from './candidates.service.js'

// The candidates module's scheduled jobs (registered in src/worker.ts; server time) - backlog item 6, 2026-11-16
export const candidatesJobs: Job[] = [
  {
    // an offer past its "valid until" date without an answer becomes Expired
    name: 'candidates.expireUnansweredOffers',
    schedule: { dailyAt: '01:00' },
    run: async () => `${await candidatesService.expireUnansweredOffers()} offer(s) expired`,
  },
  {
    // HR is told about candidates joining in the next 3 days whose joining is not confirmed
    name: 'candidates.remindUnconfirmedJoining',
    schedule: { dailyAt: '08:30' },
    run: () => candidatesService.remindUnconfirmedJoining(3),
  },
  {
    // HR is told every Monday about background checks still open after joining
    name: 'candidates.remindOpenBackgroundChecks',
    schedule: { weeklyOn: 1, at: '09:00' },
    run: () => backgroundChecksService.remindOpenChecks(),
  },
]
