// Public API of the attendance module. Other modules import only from here ('#modules/attendance').
// The repositories are private to this module - never export them.
export { attendanceRouter } from './attendance.router.js'
// what other modules use: the leave module counts leave days by the attendance plan and gives its leave to the days
export * as attendanceService from './attendance.service.js'
// its scheduled jobs (src/worker.ts)
export { attendanceJobs } from './attendance.jobs.js'
