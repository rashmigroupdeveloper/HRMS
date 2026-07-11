/**
 * Stage 1.4 API surface — AR/OD/Permission + Overtime (ATT-06/07/08).
 * Central permission gates (CORE-10):
 *   submit + own lists → attendance.own   (every employee)
 *   OT decide + queue  → ot.approve       (managers/HR — grid-driven, runtime-editable)
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { formatDbDate } from '../../core/dates.js';
import { createRegularization, listRegularizations } from './regularization.service.js';
import { decideOvertime, lapseExpiredOvertime, listMyOvertime, listPendingOvertime } from './overtime.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM');

/** Domain validation failures become 400s, not 500s. */
function asBadRequest(err: unknown): never {
  if (err instanceof Error && err.message === 'Not the current approver') {
    throw new ORPCError('FORBIDDEN', { message: err.message });
  }
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
  }
  return user.employee_id;
}

const regularizationShape = z.object({
  id: z.number(),
  kind: z.enum(['AR', 'OD', 'PERMISSION']),
  fromDate: z.string(),
  toDate: z.string(),
  fromTime: z.string().nullable(),
  toTime: z.string().nullable(),
  reason: z.string(),
  requestedStatus: z.string(),
  workflowRequestId: z.number(),
  workflowStatus: z.string(),
  applied: z.boolean(),
});

const submitRequest = withPermission('attendance.own')
  .route({ method: 'POST', path: '/attendance/requests', summary: 'Submit AR / OD / Permission for yourself (ATT-06/07)' })
  .input(
    z.object({
      kind: z.enum(['AR', 'OD', 'PERMISSION']),
      fromDate: isoDate,
      toDate: isoDate,
      fromTime: hhmm.optional(),
      toTime: hhmm.optional(),
      reason: z.string().min(5, 'A meaningful reason is mandatory'),
    }),
  )
  .output(z.object({ id: z.number(), workflowRequestId: z.number() }))
  .handler(async ({ input, context }) => {
    const employeeId = requireEmployeeId(context.user);
    try {
      return await createRegularization(context.db, {
        employeeId,
        requestedByUserId: context.user.id,
        kind: input.kind,
        fromDate: input.fromDate,
        toDate: input.toDate,
        fromTime: input.fromTime,
        toTime: input.toTime,
        reason: input.reason,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const myRequests = withPermission('attendance.own')
  .route({ method: 'GET', path: '/attendance/requests/mine', summary: 'My AR/OD/Permission requests with live workflow state' })
  .output(z.array(regularizationShape))
  .handler(async ({ context }) => {
    const employeeId = requireEmployeeId(context.user);
    const rows = await listRegularizations(context.db, employeeId);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      fromDate: formatDbDate(r.from_date),
      toDate: formatDbDate(r.to_date),
      fromTime: r.from_time?.slice(0, 5) ?? null,
      toTime: r.to_time?.slice(0, 5) ?? null,
      reason: r.reason,
      requestedStatus: r.requested_status,
      workflowRequestId: r.workflow_request_id,
      workflowStatus: r.workflow_status,
      applied: r.applied,
    }));
  });

const overtimeShape = z.object({
  id: z.number(),
  employeeId: z.number(),
  workDate: z.string(),
  detectedMinutes: z.number(),
  claimedMinutes: z.number(),
  approvedMinutes: z.number().nullable(),
  status: z.string(),
  deadlineAt: z.string(),
  decidedAt: z.string().nullable(),
  workflowRequestId: z.number().nullable(),
});

interface OvertimeRowLike {
  id: number;
  employee_id: number;
  work_date: Date;
  detected_minutes: number;
  claimed_minutes: number;
  approved_minutes: number | null;
  status: string;
  deadline_at: Date;
  decided_at: Date | null;
  workflow_request_id: number | null;
}

function toOvertimeDto(r: OvertimeRowLike): z.infer<typeof overtimeShape> {
  return {
    id: r.id,
    employeeId: r.employee_id,
    workDate: formatDbDate(r.work_date),
    detectedMinutes: r.detected_minutes,
    claimedMinutes: r.claimed_minutes,
    approvedMinutes: r.approved_minutes,
    status: r.status,
    deadlineAt: r.deadline_at.toISOString(),
    decidedAt: r.decided_at?.toISOString() ?? null,
    workflowRequestId: r.workflow_request_id,
  };
}

const myOvertime = withPermission('attendance.own')
  .route({ method: 'GET', path: '/attendance/ot/mine', summary: 'My overtime entries (ATT-08)' })
  .output(z.array(overtimeShape))
  .handler(async ({ context }) => {
    const employeeId = requireEmployeeId(context.user);
    return (await listMyOvertime(context.db, employeeId)).map(toOvertimeDto);
  });

const pendingOvertime = withPermission('ot.approve')
  .route({ method: 'GET', path: '/attendance/ot/pending', summary: 'OT awaiting MY decision, nearest deadline first' })
  .output(z.array(overtimeShape))
  .handler(async ({ context }) => {
    const employeeId = requireEmployeeId(context.user);
    return (await listPendingOvertime(context.db, employeeId)).map(toOvertimeDto);
  });

const decideOt = withPermission('ot.approve')
  .route({ method: 'POST', path: '/attendance/ot/decide', summary: 'Decide an OT entry within 48h: approve (full/partial), reject, or convert to comp-off' })
  .input(
    z.object({
      entryId: z.number().int().positive(),
      action: z.enum(['approve', 'reject', 'convert_comp_off']),
      approvedMinutes: z.number().int().positive().optional(),
      comment: z.string().optional(),
    }),
  )
  .output(overtimeShape)
  .handler(async ({ input, context }) => {
    try {
      const entry = await decideOvertime(context.db, {
        entryId: input.entryId,
        actorUserId: context.user.id,
        action: input.action,
        approvedMinutes: input.approvedMinutes,
        comment: input.comment,
      });
      return toOvertimeDto(entry);
    } catch (err) {
      asBadRequest(err);
    }
  });

const lapseSweep = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/attendance/ot/lapse-sweep', summary: 'Lapse pending OT past its 48h deadline (also runs hourly)' })
  .output(z.object({ lapsed: z.number() }))
  .handler(async ({ context }) => {
    return { lapsed: await lapseExpiredOvertime(context.db) };
  });

export const attendanceRequestsRouter = {
  submitRequest,
  myRequests,
  myOvertime,
  pendingOvertime,
  decideOt,
  lapseSweep,
};
