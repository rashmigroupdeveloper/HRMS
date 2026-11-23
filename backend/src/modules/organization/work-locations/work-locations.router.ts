import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { createWorkLocationInput, listWorkLocationsInput, updateWorkLocationInput } from './work-locations.schema.js'
import * as workLocationsService from './work-locations.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const workLocationsRouter = {
  list: authedProcedure.input(listWorkLocationsInput).handler(({ input, context }) => workLocationsService.listWorkLocationsFor(context.user, input)),
  create: changeProcedure.input(createWorkLocationInput).handler(({ input, context }) => workLocationsService.createWorkLocationFor(context.user, input)),
  update: changeProcedure.input(updateWorkLocationInput).handler(({ input, context }) => workLocationsService.updateWorkLocationFor(context.user, input)),
}
