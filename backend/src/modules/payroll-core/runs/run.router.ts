/**
 * Payroll Run Router (PAY-03, PAY-04, CORE-10).
 *
 * oRPC router declaring procedures with Zod input and output schemas,
 * gated strictly by RBAC permissions.
 */

import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { PayrollRunService } from './run.service.js';
import { ReconciliationService } from '../reconciliation/reconciliation.service.js';
import { companiesInScope, requireCompanyInScope, requireRunInScope } from '../../../core/rbac/company-scope.js';

const RunSummarySchema = z.object({
  id: z.number(),
  companyId: z.number(),
  month: z.string(),
  runType: z.string(),
  status: z.string(),
  attendanceLockId: z.number().nullable(),
  computedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  approvedBy: z.number().nullable(),
  finalizedAt: z.string().nullable(),
  finalizedBy: z.number().nullable(),
  employeeCount: z.number(),
  grossRupees: z.number(),
  totalDeductionsRupees: z.number(),
  netPayRupees: z.number(),
});

const ReconciliationReportSchema = z.object({
  runId: z.number(),
  isReconciled: z.boolean(),
  employeeCount: z.number(),
  totalGrossRupees: z.number(),
  totalDeductionsRupees: z.number(),
  totalNetRupees: z.number(),
  discrepancyPaise: z.number(),
  lineMismatchCount: z.number(),
  negativeNetCount: z.number(),
  anomalies: z.array(z.string()),
});

export const payrollRunsRouter = {
  list: withPermission('payroll.run.view', 'read')
    .input(
      z.object({
        company_id: z.number().optional(),
      })
    )
    .output(z.array(RunSummarySchema))
    .handler(async ({ context, input }) => {
      const service = new PayrollRunService(context.db);
      const allowed = await companiesInScope(context);
      if (input.company_id !== undefined) {
        // Group scope: an unknown company simply has no runs (no existence leak).
        if (allowed !== null) await requireCompanyInScope(context, input.company_id);
        return await service.listRuns(input.company_id);
      }
      const runs = await service.listRuns(undefined);
      return allowed === null ? runs : runs.filter((r) => allowed.includes(r.companyId));
    }),

  get: withPermission('payroll.run.view', 'read')
    .input(z.object({ id: z.number() }))
    .output(RunSummarySchema.nullable())
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new PayrollRunService(context.db);
      return await service.getRun(input.id);
    }),

  create: withPermission('payroll.run.manage')
    .input(
      z.object({
        company_id: z.number(),
        month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        run_type: z.enum(['regular', 'off_cycle', 'fnf', 'bonus', 'arrears']).optional(),
        attendance_lock_id: z.number().nullable().optional(),
        notes: z.string().optional(),
      })
    )
    .output(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      await requireCompanyInScope(context, input.company_id);
      const service = new PayrollRunService(context.db);
      const id = await service.createRun({
        companyId: input.company_id,
        month: input.month,
        runType: input.run_type,
        attendanceLockId: input.attendance_lock_id,
        notes: input.notes,
        actorUserId: context.user.id,
      });
      return { id };
    }),

  lockInputs: withPermission('payroll.run.manage')
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new PayrollRunService(context.db);
      await service.lockInputs(input.id, context.user.id);
      return { success: true };
    }),

  compute: withPermission('payroll.run.manage')
    .input(z.object({ id: z.number() }))
    .output(
      z.object({
        employeeCount: z.number(),
        grossPaise: z.number(),
        netPaise: z.number(),
        negativeNetCount: z.number(),
        employerCostPaise: z.number(),
        exceptions: z.array(z.object({ employeeId: z.number(), ecode: z.string(), reason: z.string() })),
      })
    )
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new PayrollRunService(context.db);
      return await service.computeRun(input.id, context.user.id);
    }),

  review: withPermission('payroll.run.manage')
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new PayrollRunService(context.db);
      await service.reviewRun(input.id, context.user.id);
      return { success: true };
    }),

  approve: withPermission('payroll.run.cosign')
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new PayrollRunService(context.db);
      await service.approveRun(input.id, context.user.id);
      return { success: true };
    }),

  finalize: withPermission('payroll.run.finalize')
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new PayrollRunService(context.db);
      await service.finalizeRun(input.id, context.user.id);
      return { success: true };
    }),

  markPaid: withPermission('payroll.run.finalize')
    .input(z.object({ id: z.number(), paymentReference: z.string().trim().min(3).max(120) }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      await new PayrollRunService(context.db).markPaid(input.id, context.user.id, input.paymentReference);
      return { success: true };
    }),

  returnToDraft: withPermission('payroll.run.manage')
    .input(z.object({ id: z.number(), reason: z.string().trim().min(5).max(500) }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      await new PayrollRunService(context.db).returnToDraft(input.id, context.user.id, input.reason);
      return { success: true };
    }),

  reopen: withPermission('payroll.run.reopen')
    .input(
      z.object({
        id: z.number(),
        reason: z.string().min(5),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new PayrollRunService(context.db);
      await service.reopenRun(input.id, input.reason, context.user.id);
      return { success: true };
    }),

  reconcile: withPermission('payroll.run.view', 'read')
    .input(z.object({ id: z.number() }))
    .output(ReconciliationReportSchema)
    .handler(async ({ context, input }) => {
      await requireRunInScope(context, input.id);
      const service = new ReconciliationService(context.db);
      return await service.reconcileRun(input.id);
    }),
};
