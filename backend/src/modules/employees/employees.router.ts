import { movementsRouter } from './movements/movements.router.js'
import { accessAllProcedure, accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { employeeDocumentsRouter } from './documents/documents.router.js'
import {
  addEmployeeInput,
  directoryInput,
  exportDirectoryInput,
  orgChartInput,
  exportEmployeesInput,
  getEmployeeByCodeInput,
  listEmployeesInput,
  salaryHistoryInput,
  searchEmployeesInput,
  updateEmployeeInput,
  updateOnboardingChecklistInput,
  updateStatutoryNumbersInput,
} from './employees.schema.js'
import { employeeFormRouter } from './form/form.router.js'
import { hodsRouter } from './hods/hods.router.js'
import { jobHistoryRouter } from './job-history/job-history.router.js'
import { layoffsRouter } from './layoffs/layoffs.router.js'
import { employeeImportsRouter } from './imports/imports.router.js'
import * as employeesService from './employees.service.js'

// Routes + controller layer: auth, input validation -> service -> result. No business logic here.
export const employeesRouter = {
  exportDirectory: authedProcedure.input(exportDirectoryInput).handler(({input,context})=>employeesService.exportDirectory(context.user,input)),
  // The employee directory: search + filters, one page at a time.
  list: accessProcedure('EMPLOYEES', 'READ')
    .input(listEmployeesInput)
    .handler(({ input, context }) => employeesService.listEmployees(input, context.user)),
  // People pickers: employees who have not left, by code or name, across the whole group (code, name, designation,
  // company only).
  search: accessProcedure('EMPLOYEES', 'READ')
    .input(searchEmployeesInput)
    .handler(({ input }) => employeesService.searchPeople(input)),
  // The company directory (2026-11-21): any logged-in employee - everyone working now in every company, basic fields only.
  directory: authedProcedure.input(directoryInput).handler(({ input, context }) => employeesService.listDirectory(context.user, input)),
  // The org chart around one employee (default: oneself): managers up, the employee, direct reports - basic fields only.
  orgChart: authedProcedure.input(orgChartInput).handler(({ input, context }) => employeesService.orgChart(context.user, input)),
  // The directory (same filters) as an Excel file.
  export: accessProcedure('EMPLOYEES', 'READ')
    .input(exportEmployeesInput)
    .handler(({ input, context }) => employeesService.exportEmployees(input, context.user)),
  // "Add employee": HR adds an employee directly, without onboarding; the code is the next of the company's series.
  create: accessProcedure('EMPLOYEES', 'WRITE')
    .input(addEmployeeInput)
    .handler(({ input, context }) => employeesService.addEmployee(input, context.user)),
  // "Edit details": the core details of an employee (job, placement, reporting manager, contact).
  update: accessProcedure('EMPLOYEES', 'WRITE')
    .input(updateEmployeeInput)
    .handler(({ input, context }) => employeesService.updateEmployee(input, context.user)),
  // One employee's profile by employee code, e.g. "RML035384" (case-insensitive).
  // Own record: any logged-in employee; anyone else's: EMPLOYEES READ covering where they are (checked in the service).
  getByCode: authedProcedure
    .input(getEmployeeByCodeInput)
    .handler(({ input, context }) => employeesService.getByCodeFor(context.user, input.employeeCode)),
  // HR records the PF / ESIC numbers given after joining (UAN, PF member number, ESIC IP number).
  updateStatutoryNumbers: accessAllProcedure(['EMPLOYEES', 'READ'], ['EMPLOYEE_IDS_BANK', 'WRITE'])
    .input(updateStatutoryNumbersInput)
    .handler(({ input, context }) => employeesService.updateStatutoryNumbers(input, context.user)),
  // HR's "For HR / Office Use Only" checklist after joining: payroll updated, ID card / access, induction date.
  updateOnboardingChecklist: accessProcedure('EMPLOYEES', 'WRITE')
    .input(updateOnboardingChecklistInput)
    .handler(({ input, context }) => employeesService.updateOnboardingChecklist(input, context.user)),
  // the employee's salaries from each day (own record, or Employee · Salary View covering them - 2026-11-20)
  salaryHistory: authedProcedure.input(salaryHistoryInput).handler(({ input, context }) => employeesService.salaryHistory(context.user, input.employeeCode)),
  documents: employeeDocumentsRouter,
  layoffs: layoffsRouter,
  jobHistory: jobHistoryRouter,
  imports: employeeImportsRouter,
  movements: movementsRouter,
  // HR edits the employee's records (the joining form's sections) after joining
  form: employeeFormRouter,
  // HOD posts and appointments, the employees' HOD, the gap list and an HOD's "My department" (BACKLOG 3e)
  hods: hodsRouter,
}
