import { authedProcedure } from '#core/rpc/procedures'
import { createRegularizationInput, regularizationIdInput } from './regularizations.schema.js'
import * as regularizationsService from './regularizations.service.js'

// attendance.regularizations.* (2026-11-22) - any employee asks / withdraws / lists their own missed-punch regularizations
// and on-duty requests. Deciding is on the Approvals page (the approval service, kinds REGULARIZATION and ON_DUTY).
export const regularizationsRouter = {
  create: authedProcedure.input(createRegularizationInput).handler(({ input, context }) => regularizationsService.createRequest(context.user, input)),
  cancel: authedProcedure.input(regularizationIdInput).handler(({ input, context }) => regularizationsService.cancelRequest(context.user, input.id)),
  mine: authedProcedure.handler(({ context }) => regularizationsService.listMine(context.user)),
}
