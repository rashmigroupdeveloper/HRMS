// Public API of the accounts module. Other modules import only from here ('#modules/accounts').
// The repositories are private to this module - never export them.
// Other modules do not need this module for access checks: they use accessProcedure(area, level) from core.
export { accountsRouter } from './accounts.router.js'
export * as accountsService from './accounts.service.js'
// its scheduled jobs (src/worker.ts)
export { accountsJobs } from './accounts.jobs.js'
