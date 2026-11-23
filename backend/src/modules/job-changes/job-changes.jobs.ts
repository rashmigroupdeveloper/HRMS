import type { Job } from '#core/jobs/scheduler'
import * as jobChangesService from './job-changes.service.js'

// The job-changes module's scheduled jobs (registered in src/worker.ts; server time)
export const jobChangesJobs: Job[] = [
  {
    // approved job changes whose day has come become the employee's details (one that could not be applied is tried again)
    name: 'jobChanges.applyDue',
    schedule: { dailyAt: '00:05' },
    run: () => jobChangesService.applyDue(),
  },
]
