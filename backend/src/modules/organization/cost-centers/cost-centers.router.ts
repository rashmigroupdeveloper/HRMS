import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { createCostCenterInput, listCostCentersInput, updateCostCenterInput } from './cost-centers.schema.js'
import * as costCentersService from './cost-centers.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const costCentersRouter = {
  list: authedProcedure.input(listCostCentersInput).handler(({ input, context }) => costCentersService.listCostCentersFor(context.user, input)),
  create: changeProcedure
    .input(createCostCenterInput)
    .handler(({ input, context }) => costCentersService.createCostCenterFor(context.user, input)),
  update: changeProcedure
    .input(updateCostCenterInput)
    .handler(({ input, context }) => costCentersService.updateCostCenterFor(context.user, input)),
}
