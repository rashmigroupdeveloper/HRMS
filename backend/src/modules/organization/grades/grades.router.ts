import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createGradeInput, updateGradeInput } from './grades.schema.js'
import * as gradesService from './grades.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const gradesRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => gradesService.listGradesFor(context.user, input?.includeInactive)),
  create: changeProcedure.input(createGradeInput).handler(({ input, context }) => gradesService.createGradeFor(context.user, input)),
  update: changeProcedure.input(updateGradeInput).handler(({ input, context }) => gradesService.updateGradeFor(context.user, input)),
}
