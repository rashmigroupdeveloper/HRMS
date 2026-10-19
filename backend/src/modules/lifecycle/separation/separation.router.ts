/**
 * Separation, Clearances & F&F oRPC Router (LC-06, LC-07, PAY-15).
 *
 * Implements:
 * - listSeparations, getSeparationById
 * - applyResignation, initiateAbscondingTermination, approveResignation, withdrawResignation
 * - getClearances, updateClearance (with C18 unreturned asset recovery rules)
 * - computeFnf, finalizeAndPayFnf (with Golden G8 gratuity, 3-day TAT countdown, and Exit Day Cascade)
 * - ceoReview: Executive review for high-value separations, shortfall waivers, or dispute settlements (LC-06, SOW-221)
 */

import { z } from 'zod';
import { authed, withAnyPermission, withPermission } from '../../../api/orpc.js';
import { getUserPermissionAccess, getUserPermissions } from '../../../core/rbac/permissions.service.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../../core/rbac/employee-scope.js';
import { DomainError, ForbiddenError, NotFoundError } from '../../../core/errors/index.js';
import { SeparationService, myNoticePolicy } from './separation.service.js';
import { ClearanceService, type ClearanceDepartment } from './clearance.service.js';
import type { PermissionCode } from '../../../core/rbac/seed-data.js';

/** Who may sign off each department's clearance (P-22). */
const CLEARANCE_PERMISSION: Record<ClearanceDepartment, PermissionCode> = {
  HR: 'lifecycle.separation.approve',
  Finance: 'payroll.run.manage',
  IT: 'assets.manage',
  Admin: 'assets.manage',
};
const SEPARATION_VIEWERS: PermissionCode[] = ['lifecycle.separation.approve', 'payroll.run.manage', 'assets.manage'];

interface SeparationScopeContext {
  db: Parameters<typeof assertEmployeesInScope>[0];
  user: { id: number; employee_id: number | null };
  permissionAccess: Omit<EmployeeScope, 'actorEmployeeId'>;
}

/**
 * B-16 / C-16: clearances and F&F act on one employee's exit — the caller's
 * scope (for `permission`, else the route's own) must cover that employee.
 */
async function requireSeparationInScope(context: SeparationScopeContext, separationId: number, permission?: PermissionCode): Promise<number> {
  const row = await context.db.selectFrom('core.separations').select('employee_id').where('id', '=', separationId).executeTakeFirst();
  if (!row) throw new NotFoundError('Separation not found');
  const access = permission === undefined
    ? context.permissionAccess
    : await getUserPermissionAccess(context.db, context.user.id, permission, 'write');
  if (!access) throw new ForbiddenError('Separation outside your permitted data scope');
  await assertEmployeesInScope(context.db, { ...access, actorEmployeeId: context.user.employee_id }, [row.employee_id]);
  return row.employee_id;
}


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
  list: withAnyPermission(...SEPARATION_VIEWERS)
    .route({ method: 'GET', path: '/lifecycle/separations', summary: 'List separations (scoped)' })
    .input(z.object({ status: z.string().optional(), employeeId: z.coerce.number().int().positive().optional() }))
    .output(z.object({ separations: z.array(separationItemSchema), items: z.array(separationItemSchema) }))
    .handler(async ({ input, context }) => {
      const scope: EmployeeScope = { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
      const separations = await new SeparationService(context.db).getSeparations({ ...input, scope });
      return { separations, items: separations };
    }),

  mine: authed
    .route({ method: 'GET', path: '/lifecycle/separations/mine', summary: 'My resignation cases' })
    .output(z.object({ separations: z.array(separationItemSchema), items: z.array(separationItemSchema) }))
    .handler(async ({ context }) => {
      if (context.user.employee_id === null) return { separations: [], items: [] };
      const separations = await new SeparationService(context.db).getSeparations({ employeeId: context.user.employee_id });
      return { separations, items: separations };
    }),

  alumniMe: authed
    .route({ method: 'GET', path: '/lifecycle/alumni/me', summary: 'My exit record: profile, F&F settlement, relieving documents (UI-01)' })
    .output(z.object({
      profile: z.object({ ecode: z.string(), name: z.string(), designation: z.string().nullable(), department: z.string().nullable(), companyName: z.string(), doj: z.string().nullable(), dol: z.string().nullable() }),
      settlement: z.object({ status: z.string(), netPayableRupees: z.number(), gratuityRupees: z.number(), leaveEncashRupees: z.number(), noticeRecoveryRupees: z.number(), paidAt: z.string().nullable(), relievingLetterId: z.number().nullable(), serviceCertificateId: z.number().nullable() }).nullable(),
    }))
    .handler(async ({ context }) => {
      const id = context.user.employee_id;
      if (id === null) throw new NotFoundError('Your account is not linked to an employee record');
      const e = await context.db.selectFrom('core.employees as e').innerJoin('core.companies as c', 'c.id', 'e.company_id')
        .leftJoin('core.designations as g', 'g.id', 'e.designation_id').leftJoin('core.departments as d', 'd.id', 'e.department_id')
        .select(['e.ecode', 'e.first_name', 'e.last_name', 'e.doj', 'e.dol', 'c.name as companyName', 'g.name as designation', 'd.name as department'])
        .where('e.id', '=', id).executeTakeFirstOrThrow();
      const f = await context.db.selectFrom('pay.fnf_settlements').selectAll().where('employee_id', '=', id).orderBy('id', 'desc').executeTakeFirst();
      const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
      return {
        profile: { ecode: e.ecode, name: `${e.first_name} ${e.last_name ?? ''}`.trim(), designation: e.designation, department: e.department, companyName: e.companyName, doj: day(e.doj), dol: day(e.dol) },
        settlement: f ? { status: f.status, netPayableRupees: Number(f.net_payable), gratuityRupees: Number(f.gratuity_amount), leaveEncashRupees: Number(f.leave_encash_amount), noticeRecoveryRupees: Number(f.notice_recovery_amount), paidAt: f.paid_at ? f.paid_at.toISOString() : null, relievingLetterId: f.relieving_letter_id, serviceCertificateId: f.service_certificate_id } : null,
      };
    }),

  myNotice: authed
    .route({ method: 'GET', path: '/lifecycle/separations/my-notice', summary: 'My notice-period policy (for the resignation form)' })
    .output(z.object({ noticePeriodDays: z.number(), category: z.string().nullable(), ecode: z.string(), name: z.string() }))
    .handler(async ({ context }) => {
      if (context.user.employee_id === null) throw new NotFoundError('Your account is not linked to an employee record');
      return myNoticePolicy(context.db, context.user.employee_id);
    }),

  getById: authed
    .route({ method: 'GET', path: '/lifecycle/separations/{id}', summary: 'Get separation by ID' })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(
      z.object({
        separation: separationItemSchema,
        clearances: z.array(clearanceItemSchema),
        fnfSettlement: z.unknown().nullable(),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new SeparationService(context.db);
      const result = await service.getSeparationById(input.id);
      if (result.separation.employeeId === context.user.employee_id) return result;
      const held = await getUserPermissions(context.db, context.user.id, 'read');
      const perm = SEPARATION_VIEWERS.find((p) => held.has(p));
      if (!perm) throw new ForbiddenError('You can only view your own separation');
      const access = await getUserPermissionAccess(context.db, context.user.id, perm, 'read');
      if (!access) throw new ForbiddenError('You can only view your own separation');
      await assertEmployeesInScope(context.db, { ...access, actorEmployeeId: context.user.employee_id }, [result.separation.employeeId]);
      return result;
    }),

  apply: authed
    .route({ method: 'POST', path: '/lifecycle/separations/apply', summary: 'Submit my resignation' })
    .input(
      z.object({
        employeeId: z.number().int().positive().optional(),
        reason: z.string().trim().min(5).max(2000),
        requestedLwd: z.string(),
      })
    )
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      const self = context.user.employee_id;
      if (self === null) throw new DomainError('Your account is not linked to an employee record');
      // C-01 / B-04: a resignation is always the caller's own.
      if (input.employeeId !== undefined && input.employeeId !== self) {
        throw new ForbiddenError('You can only resign on your own behalf; HR uses the HR-initiated separation');
      }
      const separation = await new SeparationService(context.db).applyResignation({
        employeeId: self,
        reason: input.reason,
        requestedLwd: input.requestedLwd,
        userId: context.user.id,
      });
      return { separation };
    }),

  initiateAbsconding: withPermission('lifecycle.separation.approve')
    .route({ method: 'POST', path: '/lifecycle/separations/absconding', summary: 'Initiate HR absconding termination' })
    .input(
      z.object({
        employeeId: z.number().int().positive().optional(),
        // HR knows people by e-code; either identifier is accepted.
        ecode: z.string().trim().min(3).max(32).optional(),
        reason: z.string().trim().min(5),
        lastWorkingDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Last working day must be a date'),
        absenceCaseId: z.number().optional(),
      }).refine((v) => v.employeeId !== undefined || v.ecode !== undefined, { message: 'Employee e-code is required' })
    )
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      let employeeId = input.employeeId;
      if (employeeId === undefined) {
        const row = await context.db.selectFrom('core.employees').select('id').where('ecode', '=', (input.ecode ?? '').toUpperCase()).executeTakeFirst();
        if (!row) throw new NotFoundError(`No employee with e-code ${input.ecode ?? ''}`);
        employeeId = row.id;
      }
      await assertEmployeesInScope(context.db, { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, [employeeId]);
      if (employeeId === context.user.employee_id) throw new ForbiddenError('You cannot initiate your own separation');
      const separation = await new SeparationService(context.db).initiateAbscondingTermination({
        employeeId,
        reason: input.reason,
        lastWorkingDay: input.lastWorkingDay,
        absenceCaseId: input.absenceCaseId,
        hrUserId: context.user.id,
      });
      return { separation };
    }),

  approve: authed
    .route({ method: 'POST', path: '/lifecycle/separations/{separationId}/approve', summary: 'Approve my step of the resignation chain' })
    .input(z.object({ separationId: z.coerce.number().int().positive(), approvedLwd: z.string().optional(), comment: z.string().max(2000).optional() }))
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      const separation = await new SeparationService(context.db).decideResignation({
        separationId: input.separationId, action: 'approve', approvedLwd: input.approvedLwd, comment: input.comment, approverUserId: context.user.id,
      });
      return { separation };
    }),

  reject: authed
    .route({ method: 'POST', path: '/lifecycle/separations/{separationId}/reject', summary: 'Reject the resignation at my step' })
    .input(z.object({ separationId: z.coerce.number().int().positive(), comment: z.string().trim().min(3).max(2000) }))
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      const separation = await new SeparationService(context.db).decideResignation({
        separationId: input.separationId, action: 'reject', comment: input.comment, approverUserId: context.user.id,
      });
      return { separation };
    }),

  withdraw: authed
    .route({ method: 'POST', path: '/lifecycle/separations/{separationId}/withdraw', summary: 'Withdraw a resignation (own, or HR)' })
    .input(z.object({ separationId: z.coerce.number().int().positive(), reason: z.string().trim().min(3) }))
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      // HR authority = an all/org-unit separation grant covering the employee;
      // a reporting manager's subtree grant does not let them withdraw it.
      const access = await getUserPermissionAccess(context.db, context.user.id, 'lifecycle.separation.approve', 'write');
      let isHr = false;
      if (access && (access.all || access.orgUnitIds.length > 0)) {
        const row = await context.db.selectFrom('core.separations').select('employee_id').where('id', '=', input.separationId).executeTakeFirst();
        if (row) {
          try {
            await assertEmployeesInScope(context.db, { ...access, own: false, subtree: false, actorEmployeeId: context.user.employee_id }, [row.employee_id]);
            isHr = true;
          } catch {
            isHr = false;
          }
        }
      }
      const separation = await new SeparationService(context.db).withdrawResignation({
        separationId: input.separationId,
        reason: input.reason,
        actorUserId: context.user.id,
        actorEmployeeId: context.user.employee_id,
        isHr,
      });
      return { separation };
    }),

  getClearances: withAnyPermission(...SEPARATION_VIEWERS)
    .route({ method: 'GET', path: '/lifecycle/clearances', summary: 'Get clearances by separation ID' })
    .input(z.object({ separationId: z.coerce.number().int().positive() }))
    .output(z.object({ clearances: z.array(clearanceItemSchema), items: z.array(clearanceItemSchema) }))
    .handler(async ({ input, context }) => {
      await requireSeparationInScope(context, input.separationId);
      const clearances = await new ClearanceService(context.db).getClearancesBySeparation(input.separationId);
      return { clearances, items: clearances };
    }),

  updateClearance: withAnyPermission(...SEPARATION_VIEWERS)
    .route({ method: 'POST', path: '/lifecycle/clearances/update', summary: 'Sign off a departmental clearance (C18 check)' })
    .input(
      z.object({
        separationId: z.number().int().positive(),
        department: z.enum(['IT', 'Admin', 'Finance', 'HR']),
        status: z.enum(['pending', 'cleared', 'flagged']),
        remarks: z.string().optional(),
        recoveryAmountRupees: z.number().nonnegative().optional(),
        isFinanceSignoff: z.boolean().optional(),
        unreturnedAssets: z.array(
          z.object({
            assetId: z.number(),
            assetTag: z.string(),
            modelName: z.string(),
            condition: z.enum(['unreturned', 'damaged']),
            recoveryAmountRupees: z.number().nonnegative(),
          })
        ).optional(),
      })
    )
    .output(z.object({ clearance: clearanceItemSchema }))
    .handler(async ({ input, context }) => {
      const held = context.permissions;
      if (!held.has(CLEARANCE_PERMISSION[input.department])) {
        throw new ForbiddenError(`Only the ${input.department} clearance owner can sign off this clearance`);
      }
      if (input.isFinanceSignoff && !held.has('payroll.run.manage')) {
        throw new ForbiddenError('Finance sign-off requires payroll authority');
      }
      const subject = await requireSeparationInScope(context, input.separationId, CLEARANCE_PERMISSION[input.department]);
      if (subject === context.user.employee_id) throw new ForbiddenError('You cannot sign off your own clearance');
      const clearance = await new ClearanceService(context.db).updateClearance({ ...input, userId: context.user.id });
      return { clearance };
    }),

  computeFnf: withPermission('payroll.run.manage')
    .route({ method: 'POST', path: '/lifecycle/separations/{separationId}/compute-fnf', summary: 'Compute F&F breakdown with Golden G8 gratuity' })
    .input(
      z.object({
        separationId: z.coerce.number().int().positive(),
        daysPayable: z.number().min(0).max(31).optional(),
        elBalanceDays: z.number().min(0).max(400).optional(),
        tdsRupees: z.number().min(0).optional(),
      })
    )
    .output(z.object({ calculation: z.unknown() }))
    .handler(async ({ input, context }) => {
      await requireSeparationInScope(context, input.separationId);
      const calculation = await new SeparationService(context.db).computeFnf({ ...input, userId: context.user.id });
      return { calculation };
    }),

  finalizeAndPayFnf: withPermission('payroll.run.finalize')
    .route({ method: 'POST', path: '/lifecycle/separations/{separationId}/pay', summary: 'Pay F&F settlement and execute the exit-day cascade' })
    .input(
      z.object({
        separationId: z.coerce.number().int().positive(),
        fnfId: z.number().optional(),
        paymentReference: z.string().optional(),
      })
    )
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
      await requireSeparationInScope(context, input.separationId);
      return await new SeparationService(context.db).finalizeAndPayFnf({
        fnfId: input.fnfId,
        separationId: input.separationId,
        paymentReference: input.paymentReference,
        paidByUserId: context.user.id,
      });
    }),

  ceoReview: withPermission('reports.ceo')
    .route({ method: 'POST', path: '/lifecycle/separations/{separationId}/ceo-review', summary: 'CEO Executive Review of exit settlement' })
    .input(
      z.object({
        separationId: z.coerce.number().int().positive(),
        decision: z.enum(['approved', 'rejected', 'waiver_granted']),
        remarks: z.string().optional(),
        waivedRecoveryPaise: z.number().int().nonnegative().optional(),
      })
    )
    .output(z.object({ separation: separationItemSchema }))
    .handler(async ({ input, context }) => {
      await requireSeparationInScope(context, input.separationId);
      const separation = await new SeparationService(context.db).ceoReview({
        separationId: input.separationId,
        decision: input.decision,
        remarks: input.remarks,
        waivedRecoveryPaise: input.waivedRecoveryPaise,
        ceoUserId: context.user.id,
      });
      return { separation };
    }),
};
