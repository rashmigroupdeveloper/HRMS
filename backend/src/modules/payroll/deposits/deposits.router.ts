import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import * as depositsService from './deposits.service.js'
import { depositInput, leaveOutInput, listInput, markPaidInput, monthInput, peopleInput, recordInput, removeGapsInput, takeInInput, updateInput } from './deposits.schema.js'

// Statutory deposits (payroll stage 6 slice 3): the "Statutory deposits" area over the whole company; each month, deposit
// and person is reached through its company (checked in the service), never marking oneself. Each person's amounts also
// need Salary View over the whole company. One's own months need no access area - only the logged-in employee's own.
export const depositsRouter = {
  list: accessProcedure('STATUTORY_DEPOSITS', 'READ').input(listInput).handler(({ context, input }) => depositsService.listDeposits(context.user, input)),
  month: accessProcedure('STATUTORY_DEPOSITS', 'READ').input(monthInput).handler(({ context, input }) => depositsService.getMonth(context.user, input)),
  people: accessProcedure('STATUTORY_DEPOSITS', 'READ').input(peopleInput).handler(({ context, input }) => depositsService.listPeople(context.user, input)),
  figures: accessProcedure('STATUTORY_DEPOSITS', 'READ').input(monthInput).handler(({ context, input }) => depositsService.figures(context.user, input)),
  record: accessProcedure('STATUTORY_DEPOSITS', 'WRITE').input(recordInput).handler(({ context, input }) => depositsService.record(context.user, input)),
  update: accessProcedure('STATUTORY_DEPOSITS', 'WRITE').input(updateInput).handler(({ context, input }) => depositsService.update(context.user, input)),
  markPaid: accessProcedure('STATUTORY_DEPOSITS', 'WRITE').input(markPaidInput).handler(({ context, input }) => depositsService.markPaid(context.user, input)),
  remove: accessProcedure('STATUTORY_DEPOSITS', 'WRITE').input(depositInput).handler(({ context, input }) => depositsService.remove(context.user, input)),
  leaveOut: accessProcedure('STATUTORY_DEPOSITS', 'WRITE').input(leaveOutInput).handler(({ context, input }) => depositsService.leaveOut(context.user, input)),
  takeIn: accessProcedure('STATUTORY_DEPOSITS', 'WRITE').input(takeInInput).handler(({ context, input }) => depositsService.takeIn(context.user, input)),
  removeGaps: accessProcedure('STATUTORY_DEPOSITS', 'WRITE').input(removeGapsInput).handler(({ context, input }) => depositsService.removeGaps(context.user, input)),
  mine: authedProcedure.handler(({ context }) => depositsService.listMine(context.user)),
}
