import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { cancelJobChangeInput, createJobChangeInput, exportJobChangesInput, getJobChangeInput, listJobChangesInput } from './job-changes.schema.js'
import * as jobChangesService from './job-changes.service.js'

// jobChanges.* - routes + controller layer. Asking: "Request job changes" / "Request salary changes" (covering the
// employee - and where a move goes - in the service). Lists: one's own (about me / asked by me), or Employees View limited
// to the data access (in the service); the export: Employees View. One change: Employees View covering the employee, the
// employee themselves, or the people of its approval (in the service). Cancelling: the requester, or Employees Edit
// covering the employee.
export const jobChangesRouter = {
  // "Request job changes" for the job part, "Request salary changes" (+ Employee · Salary View) for the salary part - checked
  // in the service (2026-11-21)
  create: authedProcedure.input(createJobChangeInput).handler(({ input, context }) => jobChangesService.createJobChange(input, context.user)),
  get: authedProcedure.input(getJobChangeInput).handler(({ input, context }) => jobChangesService.getJobChangeBy(context.user, input)),
  list: authedProcedure.input(listJobChangesInput).handler(({ input, context }) => jobChangesService.listJobChanges(context.user, input)),
  export: accessProcedure('EMPLOYEES', 'READ').input(exportJobChangesInput).handler(({ input, context }) => jobChangesService.exportJobChanges(context.user, input)),
  cancel: authedProcedure.input(cancelJobChangeInput).handler(({ input, context }) => jobChangesService.cancelJobChange(context.user, input)),
}
