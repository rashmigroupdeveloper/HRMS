import { authedProcedure } from '#core/rpc/procedures'
import { jobAsOfInput, listJobHistoryInput } from './job-history.schema.js'
import * as jobHistoryService from './job-history.service.js'

// employees.jobHistory.* - routes + controller layer. Own timeline: any logged-in employee; anyone else's: "Employee
// directory & job" View covering them (checked in the service). A change of job details is asked through approval -
// jobChanges.* (2026-11-20).
export const jobHistoryRouter = {
  list: authedProcedure.input(listJobHistoryInput).handler(({ input, context }) => jobHistoryService.listJobHistory(context.user, input.employeeCode)),
  asOf: authedProcedure.input(jobAsOfInput).handler(({ input, context }) => jobHistoryService.jobAsOf(context.user, input)),
}
