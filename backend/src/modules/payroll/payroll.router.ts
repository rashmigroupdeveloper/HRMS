import { accessProcedure } from '#core/rpc/procedures'
import * as payrollService from './payroll.service.js'
import { setupInput, listInput, getInput, createInput } from './payroll.schema.js'

export const payrollRouter = {
  setup: accessProcedure('PAYROLL', 'READ').input(setupInput).handler(({ context, input }) => payrollService.getSetup(context.user, input)),
  list: accessProcedure('PAYROLL', 'READ').input(listInput).handler(({ context, input }) => payrollService.listRuns(context.user, input)),
  get: accessProcedure('PAYROLL', 'READ').input(getInput).handler(({ context, input }) => payrollService.getRun(context.user, input)),
  create: accessProcedure('PAYROLL', 'WRITE').input(createInput).handler(({ context, input }) => payrollService.createRun(context.user, input)),
}
