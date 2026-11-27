import type { Job } from '#core/jobs/scheduler'
import * as payslipsService from './payslips/payslips.service.js'

// The payroll module's scheduled jobs (registered in src/worker.ts)
export const payrollJobs: Job[] = [
  {
    // stage 6: the payslips of released runs - made, stored and e-mailed (a link) within minutes of the release
    name: 'payroll.makePayslips',
    schedule: { everyMinutes: 1 },
    run: () => payslipsService.makeDue(),
  },
]
