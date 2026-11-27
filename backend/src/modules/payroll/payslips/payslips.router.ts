import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import * as payslipsService from './payslips.service.js'
import { myPayslipInput, payslipInput, previewInput, releaseInput } from './payslips.schema.js'

// Payslips (payroll stage 6): a run is found with whole-company Payroll scope first; seeing a payslip also needs Salary
// View over the whole company, releasing Payroll Edit over it (checked in the service). One's own payslips need no
// access area - only the logged-in employee's own, from released runs.
export const payslipsRouter = {
  preview: accessProcedure('PAYROLL', 'READ').input(previewInput).handler(({ context, input }) => payslipsService.preview(context.user, input)),
  release: accessProcedure('PAYROLL', 'WRITE').input(releaseInput).handler(({ context, input }) => payslipsService.release(context.user, input)),
  download: accessProcedure('PAYROLL', 'READ').input(payslipInput).handler(({ context, input }) => payslipsService.download(context.user, input)),
  mine: authedProcedure.handler(({ context }) => payslipsService.listMine(context.user)),
  downloadMine: authedProcedure.input(myPayslipInput).handler(({ context, input }) => payslipsService.downloadMine(context.user, input)),
}
