// Public API of the candidates module. Other modules import only from here ('#modules/candidates').
// The repository is private to this module - never export it.
export { candidatesRouter } from './candidates.router.js'
export * as candidatesService from './candidates.service.js'
// its scheduled jobs (src/worker.ts)
export { candidatesJobs } from './candidates.jobs.js'
// The candidate's documents and offer letters (used by scripts/rename-stored-files.ts)
export * as candidateDocumentsService from './documents/documents.service.js'
export * as offerLettersService from './offer-letters/offer-letters.service.js'
// The candidate's own joining-form page: app.ts finds the signed-in candidate with it
export * as candidatePortalService from './portal/portal.service.js'
