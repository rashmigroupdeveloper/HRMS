import { authedProcedure } from '#core/rpc/procedures'
import * as controlsService from './master-controls.service.js'
import { organisationInput, runsInput } from './master-controls.schema.js'

// This technical capability is exclusive to the pinned developer account, never inherited from a role.
export const masterControlsRouter = {
  overview: authedProcedure.handler(({ context }) => controlsService.getOverview(context.user)),
  runs: authedProcedure.input(runsInput).handler(({ context, input }) => controlsService.listRuns(context.user, input)),
  organisation: authedProcedure.input(organisationInput).handler(({ context, input }) => controlsService.getOrganisation(context.user, input)),
  exportOrganisation: authedProcedure.input(organisationInput).handler(({ context, input }) => controlsService.exportOrganisation(context.user, input)),
}
