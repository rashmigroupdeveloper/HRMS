import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createPositionInput, updatePositionInput } from './positions.schema.js'
import * as positionsService from './positions.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const positionsRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => positionsService.listPositionsFor(context.user, input?.includeInactive)),
  create: changeProcedure.input(createPositionInput).handler(({ input, context }) => positionsService.createPositionFor(context.user, input)),
  update: changeProcedure.input(updatePositionInput).handler(({ input, context }) => positionsService.updatePositionFor(context.user, input)),
}
