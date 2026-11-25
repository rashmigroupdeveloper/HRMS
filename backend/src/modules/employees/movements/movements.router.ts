import { accessProcedure } from '#core/rpc/procedures'
import { movementFilter, movementInput } from './movements.schema.js'
import * as movementsService from './movements.service.js'

export const movementsRouter = {
  list: accessProcedure('EMPLOYEES', 'READ').input(movementInput).handler(({ input, context }) => movementsService.listMovements(context.user, input)),
  export: accessProcedure('EMPLOYEES', 'READ').input(movementFilter).handler(({ input, context }) => movementsService.exportMovements(context.user, input)),
}
