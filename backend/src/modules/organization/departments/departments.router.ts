import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { createDepartmentInput, listDepartmentsInput, updateDepartmentInput } from './departments.schema.js'
import * as departmentsService from './departments.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const departmentsRouter = {
  list: authedProcedure.input(listDepartmentsInput).handler(({ input, context }) => departmentsService.listDepartmentsFor(context.user, input)),
  create: changeProcedure.input(createDepartmentInput).handler(({ input, context }) => departmentsService.createDepartmentFor(context.user, input)),
  update: changeProcedure.input(updateDepartmentInput).handler(({ input, context }) => departmentsService.updateDepartmentFor(context.user, input)),
}
