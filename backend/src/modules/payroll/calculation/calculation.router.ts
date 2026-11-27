import { accessProcedure } from '#core/rpc/procedures'
import * as calculationService from './calculation.service.js'
import { computeInput } from './calculation.schema.js'

// "Work out pay" (payroll stage 3): a run's days from the locked attendance and the earnings worked out from them. The
// run is found with whole-company Payroll scope first; working it out needs Payroll Edit over the whole company (checked
// in the service). The results are read with the people (payroll.people.list / get).
export const calculationRouter = {
  compute: accessProcedure('PAYROLL', 'WRITE').input(computeInput).handler(({ context, input }) => calculationService.compute(context.user, input)),
}
