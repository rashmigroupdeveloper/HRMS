import { authedProcedure } from '#core/rpc/procedures'
import { applicationsRouter } from './applications/applications.router.js'
import { balancesRouter } from './balances/balances.router.js'
import { compOffRouter } from './comp-off/comp-off.router.js'
import * as leaveService from './leave.service.js'
import { typesRouter } from './types/types.router.js'

// leave.* (2026-11-22): one's own leave for everyone; a manager's reporting tree and an HOD's department (view only); the
// "Leave" area for everyone's (View) and the balances' adjustments and the leave types (Edit).
export const leaveRouter = {
  // whether the viewer has a team / department to see, and what they may do
  overview: authedProcedure.handler(({ context }) => leaveService.getOverview(context.user)),
  types: typesRouter,
  balances: balancesRouter,
  applications: applicationsRouter,
  // comp-off claims for work on a weekly off / holiday (2026-11-22)
  compOff: compOffRouter,
}
