import { authedProcedure } from '#core/rpc/procedures'
import { createShiftChangeInput, shiftChangeIdInput } from './shift-changes.schema.js'
import * as shiftChangesService from './shift-changes.service.js'

// attendance.shiftChanges.* - any employee asks / cancels / lists their own. Deciding is on the Approvals page (the
// approval service, kind SHIFT_CHANGE - 2026-11-22).
export const shiftChangesRouter = {
  create: authedProcedure.input(createShiftChangeInput).handler(({ input, context }) => shiftChangesService.createRequest(context.user, input)),
  cancel: authedProcedure.input(shiftChangeIdInput).handler(({ input, context }) => shiftChangesService.cancelRequest(context.user, input.id)),
  mine: authedProcedure.handler(({ context }) => shiftChangesService.listMine(context.user)),
}
