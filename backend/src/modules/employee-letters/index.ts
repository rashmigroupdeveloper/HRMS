// Public API of the employee-letters module. Other modules import only from here ('#modules/employee-letters').
// The repository is private to this module - never export it.
export { employeeLettersRouter } from './employee-letters.router.js'
// the joining day issues the appointment letter with it
export * as employeeLettersService from './employee-letters.service.js'
