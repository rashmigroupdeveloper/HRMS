import { accessProcedure } from '#core/rpc/procedures'
import * as inputsService from './inputs.service.js'
import { createInputInput, deleteInputInput, inputsListInput, updateInputInput } from './inputs.schema.js'

// A pay run's monthly inputs (payroll stage 2): reading needs Payroll View over the whole company; changing needs Payroll
// Edit over the whole company and a draft run (checked in the service).
export const inputsRouter = {
  list: accessProcedure('PAYROLL', 'READ').input(inputsListInput).handler(({ context, input }) => inputsService.listInputs(context.user, input)),
  create: accessProcedure('PAYROLL', 'WRITE').input(createInputInput).handler(({ context, input }) => inputsService.createInput(context.user, input)),
  update: accessProcedure('PAYROLL', 'WRITE').input(updateInputInput).handler(({ context, input }) => inputsService.updateInput(context.user, input)),
  delete: accessProcedure('PAYROLL', 'WRITE').input(deleteInputInput).handler(({ context, input }) => inputsService.deleteInput(context.user, input)),
}
