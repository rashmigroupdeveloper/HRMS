import { authedProcedure } from '#core/rpc/procedures'
import { saveSetting } from './daily-movement-reports.schema.js'
import * as settingsService from './daily-movement-reports.service.js'

export const dailyMovementReportsRouter = { settings: {
  get: authedProcedure.handler(({ context }) => settingsService.getSetting(context.user)),
  save: authedProcedure.input(saveSetting).handler(({ input, context }) => settingsService.saveSetting(context.user, input)),
} }
