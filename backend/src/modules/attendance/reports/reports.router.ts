import { authedProcedure } from '#core/rpc/procedures'
import { dayPunchesInput } from '../days/days.schema.js'
import { reportFilter, reportInput } from './reports.schema.js'
import * as reportsService from './reports.service.js'

// Services enforce Attendance View + data scope, or an explicit reporting-tree/HOD relationship.
export const reportsRouter = {
  list: authedProcedure.input(reportInput).handler(({ input, context }) => reportsService.getReport(context.user, input)),
  export: authedProcedure.input(reportFilter).handler(({ input, context }) => reportsService.exportReport(context.user, input)),
  exportPunches: authedProcedure.input(dayPunchesInput).handler(({ input, context }) => reportsService.exportPunches(context.user, input)),
}
