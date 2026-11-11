import {reimbursementPaymentsRouter} from './payments.router.js';
import {getUserPermissionAccess} from '../../core/rbac/permissions.service.js';
import { claimReceiptsRouter } from './receipts.router.js';
import { submitRoutedClaim, decideRoutedClaim } from './workflow-operations.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import { ConflictError } from '../../core/errors/index.js';
import { parseRupees } from '../../core/money/index.js';
import { z } from 'zod';
import { authed, withPermission, requireEmployeeId } from '../../api/orpc.js';
import { ClaimsService } from './claims.service.js';
import { EntitlementService } from './entitlement.service.js';

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
  reimbursementBatchId: z.number().nullable(),
  createdAt: z.string(),
  bills: z.array(billSchema),
});

export const claimsRouter = {
  payments: reimbursementPaymentsRouter,
  ...claimReceiptsRouter,
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
        periodFrom: z.string().date(),
        periodTo: z.string().date(),
        advanceLoanId: z.number().optional().nullable(),
        bills: z.array(
          z.object({
            documentId: z.number(),
            billNo: z.string().optional(),
            billDate: z.string().date().optional(),
            amountRupees: z.number().positive().refine(n=>{try{parseRupees(String(n));return true;}catch{return false;}},'Use an exact amount with at most two decimal places'),
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
      const res = await submitRoutedClaim(context.db,{
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
      },context.user.id);

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
      const claims = await service.listPendingVerification(input.status,{...context.permissionAccess,actorEmployeeId:context.user.employee_id});
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
      const verification=await getUserPermissionAccess(context.db,context.user.id,'claims.verify','write');
      const res = await decideRoutedClaim(context.db,{
        claimId: input.claimId,
        decidedByUserId: context.user.id,
        action: input.action,
        approvedAmountRupees: input.approvedAmountRupees,
        rejectionReason: input.rejectionReason,
        billVerifications: input.billVerifications,
      },{...context.permissionAccess,actorEmployeeId:context.user.employee_id},verification?{...verification,actorEmployeeId:context.user.employee_id}:undefined);

      return {
        success: true,
        status: res.status,
        approvedAmountRupees: res.approvedAmountRupees,
      };
    }),

  /**
   * Legacy combined payout is refused; reimbursements use an independent lifecycle.
   */
  routePayout: withPermission('claims.payout.manage')
    .route({
      method: 'POST',
      path: '/claims/route-payout',
      summary: 'Legacy combined payout endpoint (refused; use reimbursement payments)',
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
    .handler(()=>{throw new ConflictError('Salary and reimbursements are paid separately. Use the independent reimbursement payments console.');}),

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
      await assertEmployeesInScope(context.db,{...context.permissionAccess,actorEmployeeId:context.user.employee_id},[input.employeeId]);
      return await service.calculateYearEndUnsubstantiatedRecovery(input.employeeId, input.fyYear);
    }),
};
