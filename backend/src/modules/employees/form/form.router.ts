import { accessProcedure } from '#core/rpc/procedures'
import { getEmployeeFormInput, saveEmployeeFormInput } from './form.schema.js'
import * as formService from './form.service.js'

// Routes + controller layer: auth, input validation -> service -> result. No business logic here.
export const employeeFormRouter = {
  // The employee's records in the joining form's sections, to edit (numbers as their last 4 digits)
  get: accessProcedure('EMPLOYEES', 'READ').input(getEmployeeFormInput).handler(({ input, context }) => formService.getForm(context.user, input.employeeCode)),
  // Saves the sections sent - each needs Edit on its area (checked in the service)
  save: accessProcedure('EMPLOYEES', 'READ').input(saveEmployeeFormInput).handler(({ input, context }) => formService.saveForm(context.user, input)),
}
