import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { leaveTypeInput, listLeaveTypesInput, updateLeaveTypeInput } from './types.schema.js'
import * as typesService from './types.service.js'

// leave.types.* - every employee sees the active leave types (to apply); Leave Edit for all companies changes them.
export const typesRouter = {
  list: authedProcedure.input(listLeaveTypesInput).handler(({ input, context }) => typesService.listTypes(context.user, input?.includeInactive)),
  create: accessProcedure('LEAVE', 'WRITE').input(leaveTypeInput).handler(({ input, context }) => typesService.createType(context.user, input)),
  update: accessProcedure('LEAVE', 'WRITE').input(updateLeaveTypeInput).handler(({ input, context }) => typesService.updateType(context.user, input)),
}
