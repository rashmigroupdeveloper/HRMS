import { accessProcedure } from '#core/rpc/procedures'
import * as paymentsService from './payments.service.js'
import { batchesInput, batchInput, createBatchInput, holdInput, markPaidInput, markReturnedInput, owedInput, paymentInput, releaseHoldInput } from './payments.schema.js'

// Salary payments (payroll stage 6 slice 2): the "Payroll payments" area over the whole company; each batch, payment and
// person is reached through its company (checked in the service), never one's own payment
export const paymentsRouter = {
  owed: accessProcedure('PAYROLL_PAYMENTS', 'READ').input(owedInput).handler(({ context, input }) => paymentsService.listOwed(context.user, input)),
  batches: accessProcedure('PAYROLL_PAYMENTS', 'READ').input(batchesInput).handler(({ context, input }) => paymentsService.listBatches(context.user, input)),
  batch: accessProcedure('PAYROLL_PAYMENTS', 'READ').input(batchInput).handler(({ context, input }) => paymentsService.getBatch(context.user, input)),
  createBatch: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(createBatchInput).handler(({ context, input }) => paymentsService.createBatch(context.user, input)),
  removePayment: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(paymentInput).handler(({ context, input }) => paymentsService.removePayment(context.user, input)),
  sendBatch: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(batchInput).handler(({ context, input }) => paymentsService.sendBatch(context.user, input)),
  markPaid: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(markPaidInput).handler(({ context, input }) => paymentsService.markPaid(context.user, input)),
  markReturned: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(markReturnedInput).handler(({ context, input }) => paymentsService.markReturned(context.user, input)),
  cancelBatch: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(batchInput).handler(({ context, input }) => paymentsService.cancelBatch(context.user, input)),
  paymentList: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(batchInput).handler(({ context, input }) => paymentsService.paymentList(context.user, input)),
  hold: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(holdInput).handler(({ context, input }) => paymentsService.hold(context.user, input)),
  releaseHold: accessProcedure('PAYROLL_PAYMENTS', 'WRITE').input(releaseHoldInput).handler(({ context, input }) => paymentsService.releaseHold(context.user, input)),
}
