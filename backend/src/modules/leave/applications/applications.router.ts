import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { applyInput, cancelInput, forApprovalInput, listInput, previewInput, recountInput, recountsInput } from './applications.schema.js'
import * as applicationsService from './applications.service.js'

// leave.applications.* - any employee applies for / withdraws / cancels / lists their own leave; a manager sees their
// reporting tree's, an HOD their department's, Leave View everyone's in its data access. Deciding is on the Approvals
// page (the approval service, kinds LEAVE / LEAVE_CANCEL).
export const applicationsRouter = {
  exportRecounts: accessProcedure('LEAVE','READ').input(recountsInput).handler(({input,context})=>applicationsService.exportRecounts(context.user,input)),
  export: authedProcedure.input(listInput).handler(({input,context})=>applicationsService.exportApplications(context.user,input)),
  exportMine: authedProcedure.handler(({context})=>applicationsService.exportMine(context.user)),
  preview: authedProcedure.input(previewInput).handler(({ input, context }) => applicationsService.preview(context.user, input)),
  apply: authedProcedure.input(applyInput).handler(({ input, context }) => applicationsService.apply(context.user, input)),
  cancel: authedProcedure.input(cancelInput).handler(({ input, context }) => applicationsService.cancel(context.user, input)),
  mine: authedProcedure.handler(({ context }) => applicationsService.listMine(context.user)),
  list: authedProcedure.input(listInput).handler(({ input, context }) => applicationsService.list(context.user, input)),
  forApproval: authedProcedure.input(forApprovalInput).handler(({ input, context }) => applicationsService.getForApproval(context.user, input.approvalRequestId)),
  // approved leave the calendar now counts otherwise (Leave View, in its data access), and putting one right (Leave Edit)
  recounts: accessProcedure('LEAVE', 'READ').input(recountsInput).handler(({ input, context }) => applicationsService.listRecounts(context.user, input)),
  recount: accessProcedure('LEAVE', 'WRITE').input(recountInput).handler(({ input, context }) => applicationsService.recount(context.user, input)),
}
