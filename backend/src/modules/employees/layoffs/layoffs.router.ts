import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { createLayoffInput, layoffIdInput, listLayoffsInput, updateLayoffInput } from './layoffs.schema.js'
import * as layoffsService from './layoffs.service.js'

// employees.layoffs.* - routes + controller layer. Own lay offs: any logged-in employee; anyone else's: "Employee
// directory & job" View covering them (checked in the service). Entering them: "Employee · Directory & job" Edit.
const change = accessProcedure('EMPLOYEES', 'WRITE')
export const layoffsRouter = {
  list: authedProcedure.input(listLayoffsInput).handler(({ input, context }) => layoffsService.listLayoffs(context.user, input.employeeCode)),
  create: change.input(createLayoffInput).handler(({ input, context }) => layoffsService.createLayoff(input, context.user)),
  update: change.input(updateLayoffInput).handler(({ input, context }) => layoffsService.updateLayoff(input, context.user)),
  delete: change.input(layoffIdInput).handler(({ input, context }) => layoffsService.deleteLayoff(input.id, context.user)),
}
