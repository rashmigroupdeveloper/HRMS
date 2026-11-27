import { accessProcedure } from '#core/rpc/procedures'
import * as registerService from './register.service.js'
import { registerInput } from './register.schema.js'

// A run's salary register (payroll stage 6): the run is found with whole-company Payroll scope; the amounts need Salary
// View over the whole company as well (checked in the service)
export const registerRouter = {
  export: accessProcedure('PAYROLL', 'READ').input(registerInput).handler(({ context, input }) => registerService.exportRegister(context.user, input)),
}
