import { accessProcedure } from '#core/rpc/procedures'
import * as checksService from './checks.service.js'
import { acknowledgeInput, checksListInput } from './checks.schema.js'

// A pay run's checks (payroll stage 5): the run is found with whole-company Payroll scope first; acknowledging needs
// Payroll Edit over the whole company and a draft run, never for one's own record (checked in the service)
export const checksRouter = {
  list: accessProcedure('PAYROLL', 'READ').input(checksListInput).handler(({ context, input }) => checksService.listChecks(context.user, input)),
  acknowledge: accessProcedure('PAYROLL', 'WRITE').input(acknowledgeInput).handler(({ context, input }) => checksService.acknowledge(context.user, input)),
}
