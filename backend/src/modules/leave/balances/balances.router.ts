import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { adjustInput, balancesInput, giveManyInput, importBalancesInput, registerInput } from './balances.schema.js'
import * as balancesService from './balances.service.js'

// leave.balances.* - one's own balances (anyone), a team member's / department's, or anyone's with Leave View; the
// register of everyone's (a team / department, or Leave View); HR's adjustments and the credit run (Leave Edit).
export const balancesRouter = {
  get: authedProcedure.input(balancesInput).handler(({ input, context }) => balancesService.getBalances(context.user, input)),
  register: authedProcedure.input(registerInput).handler(({ input, context }) => balancesService.getRegister(context.user, input)),
  export: authedProcedure.input(registerInput).handler(({ input, context }) => balancesService.exportRegister(context.user, input)),
  adjust: accessProcedure('LEAVE', 'WRITE').input(adjustInput).handler(({ input, context }) => balancesService.adjust(context.user, input)),
  // days of a type to many at once - chosen, or everyone matching (2026-11-24)
  giveMany: accessProcedure('LEAVE', 'WRITE').input(giveManyInput).handler(({ input, context }) => balancesService.giveMany(context.user, input)),
  runCredits: accessProcedure('LEAVE', 'WRITE').handler(({ context }) => balancesService.runCredits(context.user)),
  // the opening balances import (2026-11-22): the template, and checking / saving a filled-in file
  importTemplate: accessProcedure('LEAVE', 'WRITE').handler(() => balancesService.importTemplate()),
  importBalances: accessProcedure('LEAVE', 'WRITE').input(importBalancesInput).handler(({ input, context }) => balancesService.importBalances(context.user, input)),
}
