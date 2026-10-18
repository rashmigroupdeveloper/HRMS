import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { ClaimsService } from './claims.service.js';
import { EntitlementService } from './entitlement.service.js';

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
  }
  return user.employee_id;
}

const claimStatusSchema = z.enum(['pending', 'verified', 'approved', 'rejected', 'paid']);

const billSchema = z.object({
  id: z.number(),
  documentId: z.number(),
  billNo: z.string().nullable(),
  billDate: z.string().nullable(),
  amountRupees: z.number(),
  verified: z.boolean(),
  verifiedBy: z.number().nullable(),
});

const claimWithBillsSchema = z.object({
  id: z.number(),
  employeeId: z.number(),
  ecode: z.string(),
  employeeName: z.string(),
  claimTypeCode: z.string(),
  claimTypeName: z.string(),
  payoutComponentCode: z.string(),
  periodFrom: z.string(),
  periodTo: z.string(),
  claimedAmountRupees: z.number(),
  approvedAmountRupees: z.number().nullable(),
  status: claimStatusSchema,
  rejectionReason: z.string().nullable(),
  advanceLoanId: z.number().nullable(),
  paidInRunId: z.number().nullable(),
  paidInBatchId: z.number().nullable(),
  createdAt: z.string(),
  bills: z.array(billSchema),
});

export const claimsRouter = {
  /**
   * ESS: Lists live entitlement limits, approved and available balances for calling user.
   */
  myEntitlements: authed
    .route({
      method: 'GET',
      path: '/claims/my-entitlements',
      summary: 'Get employee live reimbursement entitlements and available balances',
    })
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          claimTypeCode: z.string(),
          claimTypeName: z.string(),
          basis: z.enum(['annual', 'monthly', 'per_event']),
          totalEntitlementRupees: z.number(),
          approvedClaimsRupees: z.number(),
          pendingClaimsRupees: z.number(),
          availableBalanceRupees: z.number(),
          billRequired: z.boolean(),
          taxableIfUnsubstantiated: z.boolean(),
          payoutComponentCode: z.string(),
        })
      )
    )
    .handler(async ({ context }) => {
      const employeeId = requireEmployeeId(context.user);
      const entitlementService = new EntitlementService(context.db);
      return await entitlementService.getEmployeeEntitlements(employeeId);
    }),

  /**
   * ESS: Lists the calling user's claim history and status.
   */
  myClaims: authed
    .route({
      method: 'GET',
      path: '/claims/my',
      summary: 'Get employee claim history with attached bills',
    })
    .input(z.object({}))
    .output(z.array(claimWithBillsSchema))
    .handler(async ({ context }) => {
      const employeeId = requireEmployeeId(context.user);
      const service = new ClaimsService(context.db);
      const claims = await service.getEmployeeClaims(employeeId);
      return claims.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }));
    }),

  /**
   * ESS: Submits a claim with multiple bills and checks live entitlement.
   */
  submit: authed
    .route({
      method: 'POST',
      path: '/claims/submit',
      summary: 'Submit a new reimbursement claim with bills',
    })
    .input(
      z.object({
        claimTypeCode: z.string(),
        periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        advanceLoanId: z.number().optional().nullable(),
        bills: z.array(
          z.object({
            documentId: z.number(),
            billNo: z.string().optional(),
            billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            amountRupees: z.number().positive(),
          })
        ).min(1),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        claimId: z.number(),
        totalClaimedRupees: z.number(),
      })
    )
    .handler(async ({ input, context }) => {
      const employeeId = requireEmployeeId(context.user);
      const service = new ClaimsService(context.db);
      const res = await service.submitClaim({
        employeeId,
        claimTypeCode: input.claimTypeCode,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        advanceLoanId: input.advanceLoanId,
        bills: input.bills.map((b) => ({
          documentId: b.documentId,
          amountRupees: b.amountRupees,
          billNo: b.billNo,
          billDate: b.billDate,
        })),
      });

      return {
        success: true,
        claimId: res.claimId,
        totalClaimedRupees: res.totalClaimedRupees,
      };
    }),

  /**
   * Manager / HR: Lists claims pending verification and decision.
   */
  pendingVerification: withPermission('claims.approve')
    .route({
      method: 'GET',
      path: '/claims/pending',
      summary: 'List claims in verification queue',
    })
    .input(
      z.object({
        status: claimStatusSchema.optional(),
      })
    )
    .output(z.array(claimWithBillsSchema))
    .handler(async ({ input, context }) => {
      const service = new ClaimsService(context.db);
      const claims = await service.listPendingVerification(input.status);
      return claims.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }));
    }),

  /**
   * Manager / HR: Decides a claim (approve, reject, partially approve) and line-item bill checks.
   */
  decide: withPermission('claims.approve')
    .route({
      method: 'POST',
      path: '/claims/decide',
      summary: 'Approve, reject, or partially approve a claim',
    })
    .input(
      z.object({
        claimId: z.number(),
        action: z.enum(['approve', 'reject', 'partially_approve']),
        approvedAmountRupees: z.number().optional(),
        rejectionReason: z.string().optional(),
        billVerifications: z
          .array(
            z.object({
              billId: z.number(),
              verified: z.boolean(),
            })
          )
          .optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        status: claimStatusSchema,
        approvedAmountRupees: z.number(),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new ClaimsService(context.db);
      const res = await service.decideClaim({
        claimId: input.claimId,
        decidedByUserId: context.user.id,
        action: input.action,
        approvedAmountRupees: input.approvedAmountRupees,
        rejectionReason: input.rejectionReason,
        billVerifications: input.billVerifications,
      });

      return {
        success: true,
        status: res.status,
        approvedAmountRupees: res.approvedAmountRupees,
      };
    }),

  /**
   * Payroll Admin: Routes approved claim payout to regular run or off-cycle batch (XOR).
   */
  routePayout: withPermission('payroll.run.manage')
    .route({
      method: 'POST',
      path: '/claims/route-payout',
      summary: 'Route claim payout to regular payroll run or off-cycle bank batch',
    })
    .input(
      z.object({
        claimId: z.number(),
        payoutMethod: z.enum(['payroll_run', 'off_cycle_batch']),
        runId: z.number().optional(),
        batchId: z.number().optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        payoutMethod: z.enum(['payroll_run', 'off_cycle_batch']),
        paidAmountRupees: z.number(),
        advanceAdjustedRupees: z.number(),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new ClaimsService(context.db);
      const res = await service.routePayout({
        claimId: input.claimId,
        payoutMethod: input.payoutMethod,
        runId: input.runId,
        batchId: input.batchId,
        userId: context.user.id,
      });

      return {
        success: true,
        payoutMethod: res.payoutMethod,
        paidAmountRupees: res.paidAmountRupees,
        advanceAdjustedRupees: res.advanceAdjustedRupees,
      };
    }),

  /**
   * Payroll Admin: Computes March final-run unsubstantiated proof tax recovery.
   */
  yearEndRecovery: withPermission('payroll.run.manage')
    .route({
      method: 'GET',
      path: '/claims/year-end-recovery',
      summary: 'Calculate year-end unsubstantiated proof tax recovery',
    })
    .input(
      z.object({
        employeeId: z.number(),
        fyYear: z.number().int(),
      })
    )
    .output(
      z.object({
        taxableAdditionRupees: z.number(),
        breakdown: z.array(
          z.object({
            claimTypeCode: z.string(),
            unsubstantiatedRupees: z.number(),
          })
        ),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new ClaimsService(context.db);
      return await service.calculateYearEndUnsubstantiatedRecovery(input.employeeId, input.fyYear);
    }),
};
