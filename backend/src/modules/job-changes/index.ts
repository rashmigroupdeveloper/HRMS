// Public API of the job-changes module (the user, 2026-11-20): promotions, transfers and other job changes - and salary
// revisions - asked by HR, approved through modules/approvals, applied on their day.
// Loading the service registers it with the approval service. The repository is private to this module.
export { jobChangesRouter } from './job-changes.router.js'
export * as jobChangesService from './job-changes.service.js'
// its scheduled jobs (src/worker.ts)
export { jobChangesJobs } from './job-changes.jobs.js'
