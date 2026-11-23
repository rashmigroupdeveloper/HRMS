import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { createPlantInput, listPlantsInput, setPlantDepartmentsInput, updatePlantInput } from './plants.schema.js'
import * as plantsService from './plants.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const plantsRouter = {
  list: authedProcedure.input(listPlantsInput).handler(({ input, context }) => plantsService.listPlantsFor(context.user, input)),
  create: changeProcedure.input(createPlantInput).handler(({ input, context }) => plantsService.createPlantFor(context.user, input)),
  update: changeProcedure.input(updatePlantInput).handler(({ input, context }) => plantsService.updatePlantFor(context.user, input)),
  setDepartments: changeProcedure.input(setPlantDepartmentsInput).handler(({ input, context }) => plantsService.setPlantDepartmentsFor(context.user, input)),
}
