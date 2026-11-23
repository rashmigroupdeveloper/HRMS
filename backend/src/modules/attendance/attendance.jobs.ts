import type { Job } from '#core/jobs/scheduler'
import * as attendanceService from './attendance.service.js'

// The attendance module's scheduled jobs (registered in src/worker.ts; server time)
export const attendanceJobs: Job[] = [
  {
    // yesterday becomes final for everyone: a working day with no punch is absent (punches uploaded later still rework it)
    name: 'attendance.closeYesterday',
    schedule: { dailyAt: '02:00' },
    run: () => attendanceService.closeYesterday(),
  },
]
