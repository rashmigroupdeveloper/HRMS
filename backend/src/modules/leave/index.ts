// Public API of the leave module (2026-11-22). Other modules import only from here ('#modules/leave').
// The repositories are private to this module - never export them.
// (Loading it registers the leave approvals with the approval service and the leave on the attendance days.)
export { leaveRouter } from './leave.router.js'
// its scheduled jobs (src/worker.ts)
export { leaveJobs } from './leave.jobs.js'
// the leave of a pay period for payslips (payroll stage 6) - only periodLeaveOf is meant for other modules
export * as leaveBalancesService from './balances/balances.service.js'
