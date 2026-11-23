import type { Job } from '#core/jobs/scheduler'
import * as joiningTasksService from './joining-tasks.service.js'

// The joining tasks' scheduled jobs (registered in src/worker.ts; server time)
export const joiningTasksJobs: Job[] = [
  {
    // those who do the tasks are told each morning about the ones due today or overdue
    name: 'joiningTasks.remindDueTasks',
    schedule: { dailyAt: '09:00' },
    run: () => joiningTasksService.remindDueTasks(),
  },
]
