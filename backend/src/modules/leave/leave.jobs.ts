import type { Job } from '#core/jobs/scheduler'
import * as balancesService from './balances/balances.service.js'

// The leave module's scheduled jobs (registered in src/worker.ts; server time)
export const leaveJobs: Job[] = [
  {
    // the monthly credits due (on the 1st - any month missed is caught up) and the year-end lapse (1 January) - each once
    name: 'leave.creditDue',
    schedule: { dailyAt: '00:30' },
    run: async () => {
      const { credited, lapsed, expired } = await balancesService.creditDue()
      return `${credited} credits, ${lapsed} lapses, ${expired} comp-off expiries`
    },
  },
]
