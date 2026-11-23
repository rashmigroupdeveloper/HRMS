// Public API of the approvals module (the user, 2026-11-20): one approval service every feature uses. A feature raises a
// request (approvalsService.raiseRequest) and registers how to act on the decision (approvalsService.registerFeature).
// The repositories are private to this module - never export them.
export { approvalsRouter } from './approvals.router.js'
export * as approvalsService from './approvals.service.js'
// its scheduled jobs (src/worker.ts)
export { approvalsJobs } from './approvals.jobs.js'
