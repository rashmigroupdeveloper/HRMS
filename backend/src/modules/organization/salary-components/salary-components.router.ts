import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createSalaryComponentInput, updateSalaryComponentInput } from './salary-components.schema.js'
import * as salaryComponentsService from './salary-components.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const salaryComponentsRouter = {
  list: authedProcedure
    .input(listInput)
    .handler(({ input, context }) => salaryComponentsService.listSalaryComponentsFor(context.user, input?.includeInactive)),
  create: changeProcedure
    .input(createSalaryComponentInput)
    .handler(({ input, context }) => salaryComponentsService.createSalaryComponentFor(context.user, input)),
  update: changeProcedure
    .input(updateSalaryComponentInput)
    .handler(({ input, context }) => salaryComponentsService.updateSalaryComponentFor(context.user, input)),
}
