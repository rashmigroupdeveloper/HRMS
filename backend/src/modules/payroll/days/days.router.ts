import { accessProcedure } from '#core/rpc/procedures'
import * as daysService from './days.service.js'
import { computeInput } from './days.schema.js'

// A pay run's days (payroll stage 3): taken from the locked attendance. The run is found with whole-company Payroll
// scope first; working the days out needs Payroll Edit over the whole company (checked in the service). The days are
// read with the people (payroll.people.list / get).
export const daysRouter = {
  compute: accessProcedure('PAYROLL', 'WRITE').input(computeInput).handler(({ context, input }) => daysService.compute(context.user, input)),
}
