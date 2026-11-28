import { accessProcedure } from '#core/rpc/procedures'
import * as payrollService from './payroll.service.js'
import { setupInput, listInput, getInput, createInput, sendInput } from './payroll.schema.js'
import { peopleRouter } from './people/people.router.js'
import { calculationRouter } from './calculation/calculation.router.js'
import { checksRouter } from './checks/checks.router.js'
import { inputsRouter } from './inputs/inputs.router.js'
import { statutoryRouter } from './statutory/statutory.router.js'
import { taxOpeningsRouter } from './tax-openings/tax-openings.router.js'
import { payslipsRouter } from './payslips/payslips.router.js'
import { registerRouter } from './register/register.router.js'
import { paymentsRouter } from './payments/payments.router.js'

export const payrollRouter = {
  setup: accessProcedure('PAYROLL', 'READ').input(setupInput).handler(({ context, input }) => payrollService.getSetup(context.user, input)),
  list: accessProcedure('PAYROLL', 'READ').input(listInput).handler(({ context, input }) => payrollService.listRuns(context.user, input)),
  get: accessProcedure('PAYROLL', 'READ').input(getInput).handler(({ context, input }) => payrollService.getRun(context.user, input)),
  create: accessProcedure('PAYROLL', 'WRITE').input(createInput).handler(({ context, input }) => payrollService.createRun(context.user, input)),
  // stage 5: send a draft for approval (deciding and withdrawing go through approvals.decide / approvals.cancel)
  send: accessProcedure('PAYROLL', 'WRITE').input(sendInput).handler(({ context, input }) => payrollService.sendRun(context.user, input)),
  // stage 2: who is in a run and their salary copy; the month's inputs
  people: peopleRouter,
  inputs: inputsRouter,
  // stage 3: "Work out pay" - the days from the locked attendance and the earnings worked out from them
  calculation: calculationRouter,
  // stage 4: the statutory rates and slabs, and opening tax figures
  statutory: statutoryRouter,
  taxOpenings: taxOpeningsRouter,
  // stage 5: the warnings to acknowledge before sending
  checks: checksRouter,
  // stage 6: payslips (released on a final run; one's own in self-service) and the salary register
  payslips: payslipsRouter,
  register: registerRouter,
  // stage 6 slice 2: paying the approved runs - batches, holds and what is owed ("Payroll payments" area)
  payments: paymentsRouter,
}
