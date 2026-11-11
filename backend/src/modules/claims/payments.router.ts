/** CLM-04: independent reimbursement population and operational grants. */
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import {
  eligibleClaims,
  createReimbursementBatch,
  listReimbursementBatches,
  reimbursementBankFile,
  markReimbursementPaid,
} from './payments.service.js';
export const reimbursementPaymentsRouter = {
  eligible: withPermission('claims.payout.view', 'read')
    .route({
      method: 'GET',
      path: '/claims/payments/eligible',
      summary: 'Approved claims in my reimbursement scope',
    })
    .input(z.object({}).optional())
    .output(
      z.array(
        z.object({
          claimId: z.number(),
          employeeId: z.number(),
          ecode: z.string(),
          name: z.string(),
          companyId: z.number(),
          companyName: z.string(),
          amountRupees: z.number(),
        }),
      ),
    )
    .handler(({ context }) =>
      eligibleClaims(context.db, {
        ...context.permissionAccess,
        actorEmployeeId: context.user.employee_id,
      }),
    ),
  list: withPermission('claims.payout.view', 'read')
    .route({
      method: 'GET',
      path: '/claims/payments',
      summary: 'Separate reimbursement payment batches',
    })
    .input(z.object({}).optional())
    .output(
      z.array(
        z.object({
          id: z.number(),
          companyId: z.number(),
          companyName: z.string(),
          status: z.string(),
          totalRupees: z.number(),
          paymentReference: z.string().nullable(),
        }),
      ),
    )
    .handler(({ context }) =>
      listReimbursementBatches(context.db, {
        ...context.permissionAccess,
        actorEmployeeId: context.user.employee_id,
      }),
    ),
  create: withPermission('claims.payout.manage')
    .route({
      method: 'POST',
      path: '/claims/payments',
      summary: 'Reserve approved claims for an independent reimbursement payment',
    })
    .input(z.object({ claimIds: z.array(z.number().int().positive()).min(1).max(500) }))
    .output(z.object({ id: z.number() }))
    .handler(({ context, input }) =>
      createReimbursementBatch(context.db, input.claimIds, context.user.id, {
        ...context.permissionAccess,
        actorEmployeeId: context.user.employee_id,
      }),
    ),
  bank: withPermission('claims.payout.manage')
    .route({
      method: 'POST',
      path: '/claims/payments/{id}/bank-file',
      summary: 'Prepare/download the independent reimbursement bank file',
    })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(z.object({ filename: z.string(), mime: z.string(), base64: z.string() }))
    .handler(({ context, input }) =>
      reimbursementBankFile(context.db, input.id, context.user.id, {
        ...context.permissionAccess,
        actorEmployeeId: context.user.employee_id,
      }),
    ),
  paid: withPermission('claims.payout.confirm')
    .route({
      method: 'POST',
      path: '/claims/payments/{id}/paid',
      summary: 'Confirm a separate reimbursement transfer with its bank reference',
    })
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
        paymentReference: z.string().trim().min(3).max(120),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .handler(({ context, input }) =>
      markReimbursementPaid(context.db, input.id, input.paymentReference, context.user.id, {
        ...context.permissionAccess,
        actorEmployeeId: context.user.employee_id,
      }),
    ),
};
