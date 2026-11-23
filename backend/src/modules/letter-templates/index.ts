// Public API of the letter-templates module. Other modules import only from here ('#modules/letter-templates').
// The repository is private to this module - never export it.
export { letterTemplatesRouter } from './letter-templates.router.js'
export * as letterTemplatesService from './letter-templates.service.js'
