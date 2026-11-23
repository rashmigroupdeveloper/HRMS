import type { Job } from '#core/jobs/scheduler'
import * as accountsService from './accounts.service.js'

// The accounts module's scheduled jobs (registered in src/worker.ts)
export const accountsJobs: Job[] = [
  {
    // sessions past their 7 days (phase 3 left this to the worker)
    name: 'accounts.removeExpiredSessions',
    schedule: { everyMinutes: 60 },
    run: async () => `${await accountsService.removeExpiredSessions()} expired session(s) removed`,
  },
]
