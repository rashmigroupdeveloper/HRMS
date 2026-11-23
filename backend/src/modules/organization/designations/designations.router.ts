import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createDesignationInput, updateDesignationInput } from './designations.schema.js'
import * as designationsService from './designations.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const designationsRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => designationsService.listDesignationsFor(context.user, input?.includeInactive)),
  create: changeProcedure.input(createDesignationInput).handler(({ input, context }) => designationsService.createDesignationFor(context.user, input)),
  update: changeProcedure.input(updateDesignationInput).handler(({ input, context }) => designationsService.updateDesignationFor(context.user, input)),
}
