import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createCompanyInput, updateCompanyInput } from './companies.schema.js'
import * as companiesService from './companies.service.js'

// Routes + controller layer. Lists: any logged-in employee (inactive entries: ORGANIZATION READ);
// create / update: ORGANIZATION WRITE.
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const companiesRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => companiesService.listCompaniesFor(context.user, input?.includeInactive)),
  create: changeProcedure.input(createCompanyInput).handler(({ input, context }) => companiesService.createCompanyFor(context.user, input)),
  update: changeProcedure.input(updateCompanyInput).handler(({ input, context }) => companiesService.updateCompanyFor(context.user, input)),
}
