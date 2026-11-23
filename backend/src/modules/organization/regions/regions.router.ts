import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createRegionInput, updateRegionInput } from './regions.schema.js'
import * as regionsService from './regions.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const regionsRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => regionsService.listRegionsFor(context.user, input?.includeInactive)),
  create: changeProcedure.input(createRegionInput).handler(({ input, context }) => regionsService.createRegionFor(context.user, input)),
  update: changeProcedure.input(updateRegionInput).handler(({ input, context }) => regionsService.updateRegionFor(context.user, input)),
}
