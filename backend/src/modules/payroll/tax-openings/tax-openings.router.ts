import { accessProcedure } from '#core/rpc/procedures'
import * as openingsService from './tax-openings.service.js'
import { deleteOpeningInput, openingsListInput, saveOpeningInput } from './tax-openings.schema.js'

// Opening tax figures (payroll stage 4): whole-company Payroll scope by the employee's company; changes need Payroll
// Edit covering it, never for one's own record (checked in the service)
export const taxOpeningsRouter = {
  list: accessProcedure('PAYROLL', 'READ').input(openingsListInput).handler(({ context, input }) => openingsService.listOpenings(context.user, input)),
  save: accessProcedure('PAYROLL', 'WRITE').input(saveOpeningInput).handler(({ context, input }) => openingsService.saveOpening(context.user, input)),
  delete: accessProcedure('PAYROLL', 'WRITE').input(deleteOpeningInput).handler(({ context, input }) => openingsService.deleteOpening(context.user, input)),
}
