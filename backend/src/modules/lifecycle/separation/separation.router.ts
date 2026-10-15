/**
 * Separation, Clearances & F&F oRPC Router (LC-06, LC-07, PAY-15).
 *
 * Implements:
 * - listSeparations, getSeparationById
 * - applyResignation, initiateAbscondingTermination, approveResignation, withdrawResignation
 * - getClearances, updateClearance (with C18 unreturned asset recovery rules)
 * - computeFnf, finalizeAndPayFnf (with Golden G8 gratuity, 3-day TAT countdown, and Exit Day Cascade)
 */

import { z } from 'zod';
import { authed, withPermission } from '../../../api/orpc.js';
import { SeparationService } from './separation.service.js';
import { ClearanceService } from './clearance.service.js';

const separationItemSchema = z.object({
  id: z.number(),
  employeeId: z.number(),
  ecode: z.string().optional(),
  employeeName: z.string().optional(),
  departmentName: z.string().optional(),
  designationName: z.string().optional(),
  companyId: z.number().optional(),
  initiatedAt: z.union([z.date(), z.string()]),
  initiatedBy: z.enum(['employee', 'hr']),
  reason: z.string(),
  resignationDate: z.string(),
  noticePeriodDays: z.number(),
  requestedLwd: z.string(),
  approvedLwd: z.string().nullable(),
  shortfallDays: z.number(),
  workflowRequestId: z.number().nullable(),
  status: z.enum(['pending', 'approved', 'withdrawn', 'rejected', 'completed']),
  fnfId: z.number().nullable(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

const clearanceItemSchema = z.object({
  id: z.number(),
  separationId: z.number(),
  department: z.enum(['IT', 'Admin', 'Finance', 'HR']),
  status: z.enum(['pending', 'cleared', 'flagged']),
  remarks: z.string().nullable(),
  unreturnedAssets: z.array(z.object({
    assetId: z.number(),
    assetTag: z.string(),
    modelName: z.string(),
    condition: z.enum(['unreturned', 'damaged']),
    recoveryAmountRupees: z.number(),
  })).nullish(),
  recoveryAmount: z.string(),
  clearedBy: z.number().nullable(),
  clearedAt: z.union([z.date(), z.string()]).nullable(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

export const separationRouter = {
  list: withPermission('lifecycle.separation.approve')
    .input(z.object({ status: z.string().optional(), employeeId: z.number().optional() }))
    .output(z.object({ separations: z.array(separationItemSchema) }))
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      const separations = await service.getSeparations(input);
      return { separations };
    }),

  getById: withPermission('lifecycle.separation.approve')
    .input(z.object({ id: z.number() }))
    .output(
      z.object({
        separation: separationItemSchema,
        clearances: z.array(clearanceItemSchema),
        fnfSettlement: z.unknown().nullable(),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      return await service.getSeparationById(input.id);
    }),

  apply: authed
    .input(
      z.object({
        employeeId: z.number(),
        reason: z.string().min(5),
        requestedLwd: z.string(),
      })
    )
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      const separation = await service.applyResignation({
        employeeId: input.employeeId,
        reason: input.reason,
        requestedLwd: input.requestedLwd,
        userId: context.user.id,
      });
      return { separation };
    }),

  initiateAbsconding: withPermission('lifecycle.separation.approve')
    .input(
      z.object({
        employeeId: z.number(),
        reason: z.string().min(5),
        lastWorkingDay: z.string(),
        absenceCaseId: z.number().optional(),
      })
    )
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      const separation = await service.initiateAbscondingTermination({
        employeeId: input.employeeId,
        reason: input.reason,
        lastWorkingDay: input.lastWorkingDay,
        absenceCaseId: input.absenceCaseId,
        hrUserId: context.user.id,
      });
      return { separation };
    }),

  approve: withPermission('lifecycle.separation.approve')
    .input(
      z.object({
        separationId: z.number(),
        approvedLwd: z.string().optional(),
      })
    )
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      const separation = await service.approveResignation({
        separationId: input.separationId,
        approvedLwd: input.approvedLwd,
        approverUserId: context.user.id,
      });
      return { separation };
    }),

  withdraw: withPermission('lifecycle.separation.approve')
    .input(
      z.object({
        separationId: z.number(),
        reason: z.string().min(3),
      })
    )
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      const separation = await service.withdrawResignation(input.separationId, input.reason);
      return { separation };
    }),

  getClearances: withPermission('lifecycle.separation.approve')
    .input(z.object({ separationId: z.number() }))
    .output(z.object({ clearances: z.array(clearanceItemSchema) }))
    .handler(async ({ input, context }) => {
      const service = new ClearanceService(context.db);
      const clearances = await service.getClearancesBySeparation(input.separationId);
      return { clearances };
    }),

  updateClearance: withPermission('lifecycle.separation.approve')
    .input(
      z.object({
        separationId: z.number(),
        department: z.enum(['IT', 'Admin', 'Finance', 'HR']),
        status: z.enum(['pending', 'cleared', 'flagged']),
        remarks: z.string().optional(),
        recoveryAmountRupees: z.number().optional(),
        isFinanceSignoff: z.boolean().optional(),
        unreturnedAssets: z.array(
          z.object({
            assetId: z.number(),
            assetTag: z.string(),
            modelName: z.string(),
            condition: z.enum(['unreturned', 'damaged']),
            recoveryAmountRupees: z.number(),
          })
        ).optional(),
      })
    )
    .output(z.object({ clearance: clearanceItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new ClearanceService(context.db);
      const clearance = await service.updateClearance({
        ...input,
        userId: context.user.id,
      });
      return { clearance };
    }),

  computeFnf: withPermission('payroll.run.manage')
    .input(
      z.object({
        separationId: z.number(),
        daysPayable: z.number().optional(),
        elBalanceDays: z.number().optional(),
        tdsRupees: z.number().optional(),
      })
    )
    .output(z.object({ calculation: z.unknown() }))
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      const calculation = await service.computeFnf(input);
      return { calculation };
    }),

  finalizeAndPayFnf: withPermission('payroll.run.manage')
    .input(z.object({ fnfId: z.number() }))
    .output(
      z.object({
        settlementId: z.number(),
        employeeId: z.number(),
        status: z.literal('paid'),
        relievingLetterId: z.number(),
        serviceCertificateId: z.number(),
        exitDayCommitted: z.boolean(),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      return await service.finalizeAndPayFnf({
        fnfId: input.fnfId,
        paidByUserId: context.user.id,
      });
    }),
};
