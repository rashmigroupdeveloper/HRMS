import { authedProcedure } from '#core/rpc/procedures'
import { claimCompOffInput, compOffIdInput } from './comp-off.schema.js'
import * as compOffService from './comp-off.service.js'

// leave.compOff.* (2026-11-22) - any employee claims / withdraws / lists comp-off for their own work on a weekly off or a
// holiday. Deciding is on the Approvals page (the approval service, kind COMP_OFF).
export const compOffRouter = {
  claim: authedProcedure.input(claimCompOffInput).handler(({ input, context }) => compOffService.claim(context.user, input)),
  cancel: authedProcedure.input(compOffIdInput).handler(({ input, context }) => compOffService.cancel(context.user, input.id)),
  mine: authedProcedure.handler(({ context }) => compOffService.listMine(context.user)),
}
