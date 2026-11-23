// Public API of the employees module. Other modules import only from here ('#modules/employees').
// The repository is private to this module - never export it.
// The schemas are exported so other modules (candidates' joining-form draft) validate with the very same rules.
export { employeesRouter } from './employees.router.js'
export * as employeesService from './employees.service.js'
// The employee's documents: the joining day moves the candidate's documents here; BGV checks the consent form here
export * as employeeDocumentsService from './documents/documents.service.js'
export * as employeesSchemas from './employees.schema.js'
// HOD posts and appointments: attendance's "My department" view and the "My department" menu item (accounts.me)
export * as hodsService from './hods/hods.service.js'
// the job timeline: checking and applying an approved job change (modules/job-changes)
export * as jobHistoryService from './job-history/job-history.service.js'
