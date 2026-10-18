/**
 * Transfers & Employee Mobility Router (LC-05, SOW crosswalk, SOW crosswalk).
 *
 * Exposes procedures for:
 * - Initiating transfer / promotion requests across the 4 types:
 *   (department, location, inter_entity, promotion).
 * - Approving and committing transfers to core.employees and core.employee_history.
 * - Rejecting transfer requests with audit notes.
 * - Listing transfer requests with filters.
 * - Inspecting an employee's career progression timeline.
 * - Reconstructing organization state as-of any past historical date.
 */

import { z } from 'zod';
import type { Kysely } from 'kysely';
import { withPermission } from '../../../api/orpc.js';
import type { Database } from '../../../core/db/types.js';
import { ConflictError, NotFoundError } from '../../../core/errors/index.js';
import type { PermissionAccess } from '../../../core/rbac/permissions.service.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../../core/rbac/employee-scope.js';
import { requireCompanyInScope } from '../../../core/rbac/company-scope.js';
import {
  submitTransferForApproval,
  approveTransferRequest,
  rejectTransferRequest,
  getEmployeeHistoryTimeline,
  getEmployeeAsOfDate,
  listTransfers,
} from './transfer.service.js';

const guard = () => withPermission('lifecycle.transfers.manage');

interface ScopeContext {
  db: Kysely<Database>;
  permissionAccess: PermissionAccess;
  user: { employee_id: number | null };
}

/** B-16 / C-16: every transfer action is bounded by the caller's employee scope. */
function scopeOf(context: ScopeContext): EmployeeScope {
  return { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
}

async function requireTransferInScope(context: ScopeContext, transferId: number): Promise<void> {
  const row = await context.db.selectFrom('core.transfers').select('employee_id').where('id', '=', transferId).executeTakeFirst();
  if (!row) throw new NotFoundError('Transfer request not found');
  await assertEmployeesInScope(context.db, scopeOf(context), [row.employee_id]);
}

const transferShape = z.object({
  id: z.number(),
  employeeId: z.number(),
  ecode: z.string(),
  employeeName: z.string(),
  transferType: z.enum(['department', 'location', 'inter_entity', 'promotion']),
  effectiveDate: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'completed', 'cancelled']),
  currentCompanyId: z.number(),
  currentCompanyName: z.string(),
  targetCompanyId: z.number().nullable(),
  targetCompanyName: z.string().nullable(),
  currentDepartmentId: z.number().nullable(),
  currentDepartmentName: z.string().nullable(),
  targetDepartmentId: z.number().nullable(),
  targetDepartmentName: z.string().nullable(),
  currentLocationId: z.number().nullable(),
  currentLocationName: z.string().nullable(),
  targetLocationId: z.number().nullable(),
  targetLocationName: z.string().nullable(),
  currentDesignationId: z.number().nullable(),
  currentDesignationName: z.string().nullable(),
  targetDesignationId: z.number().nullable(),
  targetDesignationName: z.string().nullable(),
  currentGradeId: z.number().nullable(),
  currentGradeName: z.string().nullable(),
  targetGradeId: z.number().nullable(),
  targetGradeName: z.string().nullable(),
  currentReportingManagerId: z.number().nullable(),
  currentReportingManagerName: z.string().nullable(),
  targetReportingManagerId: z.number().nullable(),
  targetReportingManagerName: z.string().nullable(),
  currentEcode: z.string(),
  targetEcode: z.string().nullable(),
  salaryRevisionAmount: z.number().nullable(),
  leaveTreatment: z.enum(['transfer', 'encash']),
  reason: z.string(),
  remarks: z.string().nullable(),
  workflowRequestId: z.number().nullable(),
  approvedBy: z.number().nullable(),
  approvedAt: z.string().nullable(),
  notifiedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const transferRouter = {
  // 1. List transfer requests
  list: guard()
    .route({ method: 'GET', path: '/lifecycle/transfers', summary: 'List transfer requests' })
    .input(
      z
        .object({
          employeeId: z.coerce.number().optional(),
          companyId: z.coerce.number().optional(),
          transferType: z.enum(['department', 'location', 'inter_entity', 'promotion']).optional(),
          status: z.enum(['pending', 'approved', 'rejected', 'completed', 'cancelled']).optional(),
          limit: z.coerce.number().min(1).max(200).default(50),
          offset: z.coerce.number().min(0).default(0),
        })
        .optional(),
    )
    .output(
      z.object({
        rows: z.array(transferShape),
        total: z.number(),
      }),
    )
    .handler(async ({ context, input }) => {
      return await listTransfers(context.db, { ...(input ?? {}), scope: scopeOf(context) });
    }),

  // 2. Create transfer / promotion request
  create: guard()
    .route({ method: 'POST', path: '/lifecycle/transfers', summary: 'Initiate transfer or promotion request' })
    .input(
      z.object({
        employeeId: z.number(),
        transferType: z.enum(['department', 'location', 'inter_entity', 'promotion']),
        effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
        targetCompanyId: z.number().nullable().optional(),
        targetDepartmentId: z.number().nullable().optional(),
        targetLocationId: z.number().nullable().optional(),
        targetDesignationId: z.number().nullable().optional(),
        targetGradeId: z.number().nullable().optional(),
        targetReportingManagerId: z.number().nullable().optional(),
        salaryRevisionAmount: z.number().nullable().optional(),
        leaveTreatment: z.enum(['transfer', 'encash']).optional(),
        reason: z.string().min(1, 'Reason is required'),
        remarks: z.string().nullable().optional(),
      }),
    )
    .output(
      z.object({
        id: z.number(),
        targetEcode: z.string().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertEmployeesInScope(context.db, scopeOf(context), [input.employeeId]);
      // Moving someone INTO another entity needs authority over that entity too.
      if (input.targetCompanyId !== undefined && input.targetCompanyId !== null) {
        await requireCompanyInScope(context, input.targetCompanyId);
      }
      return await submitTransferForApproval(
        context.db,
        input,
        context.user.id,
        context.req.ip ?? null,
      );
    }),

  // 3. Approve and commit transfer
  approve: guard()
    .route({ method: 'POST', path: '/lifecycle/transfers/{id}/approve', summary: 'Approve and commit transfer' })
    .input(
      z.object({
        id: z.coerce.number(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        newEcode: z.string().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireTransferInScope(context, input.id);
      const chained = await context.db.selectFrom('core.transfers').select('workflow_request_id').where('id', '=', input.id).executeTakeFirst();
      if ((chained?.workflow_request_id ?? null) !== null) {
        // C-17: RM then HR approve in the inbox; HR cannot shortcut the chain here.
        throw new ConflictError('This transfer is decided through its approval chain (Approvals inbox), not directly');
      }
      return await approveTransferRequest(
        context.db,
        input.id,
        context.user.id,
        context.req.ip ?? null,
      );
    }),

  // 4. Reject transfer request
  reject: guard()
    .route({ method: 'POST', path: '/lifecycle/transfers/{id}/reject', summary: 'Reject transfer request' })
    .input(
      z.object({
        id: z.coerce.number(),
        remarks: z.string().min(1, 'Rejection reason is required'),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireTransferInScope(context, input.id);
      const chained = await context.db.selectFrom('core.transfers').select(['workflow_request_id', 'status']).where('id', '=', input.id).executeTakeFirst();
      if (chained !== undefined && chained.workflow_request_id !== null && chained.status === 'pending') {
        throw new ConflictError('This transfer is decided through its approval chain (Approvals inbox), not directly');
      }
      return await rejectTransferRequest(
        context.db,
        input.id,
        input.remarks,
        context.user.id,
        context.req.ip ?? null,
      );
    }),

  // 5. Historical Career Timeline
  history: guard()
    .route({
      method: 'GET',
      path: '/lifecycle/transfers/history/{employeeId}',
      summary: 'Get employee history timeline from core.employee_history',
    })
    .input(
      z.object({
        employeeId: z.coerce.number(),
      }),
    )
    .output(
      z.object({
        history: z.array(
          z.object({
            id: z.number(),
            employeeId: z.number(),
            effectiveDate: z.string(),
            changeType: z.string(),
            field: z.string(),
            oldValue: z.string().nullable(),
            newValue: z.string().nullable(),
            referenceId: z.number().nullable(),
            createdAt: z.string(),
          }),
        ),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertEmployeesInScope(context.db, scopeOf(context), [input.employeeId]);
      const history = await getEmployeeHistoryTimeline(context.db, input.employeeId);
      return { history };
    }),

  // 6. Organization state as-of date (LC-05, SOW crosswalk)
  asOf: guard()
    .route({
      method: 'GET',
      path: '/lifecycle/transfers/as-of',
      summary: 'Reconstruct employee organization state as of historical date',
    })
    .input(
      z.object({
        employeeId: z.coerce.number(),
        asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
      }),
    )
    .output(
      z.object({
        employeeId: z.number(),
        asOfDate: z.string(),
        ecode: z.string(),
        companyId: z.number(),
        departmentId: z.number().nullable(),
        locationId: z.number().nullable(),
        designationId: z.number().nullable(),
        gradeId: z.number().nullable(),
        reportingManagerId: z.number().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertEmployeesInScope(context.db, scopeOf(context), [input.employeeId]);
      return await getEmployeeAsOfDate(context.db, input.employeeId, input.asOfDate);
    }),
};
