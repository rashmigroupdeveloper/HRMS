import { authedProcedure } from '#core/rpc/procedures'
import { reportInput } from './reports.schema.js'
import * as reportsService from './reports.service.js'

export const reportsRouter = {
  list: authedProcedure.input(reportInput).handler(({ input, context }) => reportsService.getReport(context.user, input)),
}
