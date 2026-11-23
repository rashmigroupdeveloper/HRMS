import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { exportChangeHistoryInput, listChangeHistoryInput } from './change-history.schema.js'
import * as historyService from './change-history.service.js'

// Routes + controller layer: auth, input validation -> service -> result. No business logic here.
export const changeHistoryRouter = {
  // Who changed what and when, newest first. Change history: View - or, for one employee (the profile), Employees: View
  // (checked in the service).
  list: authedProcedure.input(listChangeHistoryInput).handler(({ input, context }) => historyService.listChangeHistory(context.user, input)),
  // The same, as an Excel file (one row per changed field) - the same access as list
  export: authedProcedure.input(exportChangeHistoryInput).handler(({ input, context }) => historyService.exportChangeHistory(context.user, input)),
  // Checks that no row of the history was changed or removed (the hash chain).
  verify: accessProcedure('CHANGE_HISTORY', 'READ').handler(({ context }) => historyService.verifyChain(context.user)),
}
