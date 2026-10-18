/** WF-01/04: held routing administration, with one central permission per API. */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withAnyPermission } from '../../api/orpc.js';
import { listRoutingHolds, retryRouting } from './workflow-holds.service.js';

export const routingHolds = withAnyPermission('admin.settings', 'workflow.routing_holds')
  .route({ method: 'GET', path: '/workflows/routing-holds', summary: 'Requests held for HR routing repair (scoped, paginated)' })
  .input(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0) }))
  .output(z.array(z.object({ requestId: z.number(), type: z.string(), subjectEmployeeId: z.number(), createdAt: z.string() })))
  .handler(async ({ input, context }) => (await listRoutingHolds(context.db, context.user.id, input.limit, input.offset))
    .map(row => ({ requestId: row.id, type: row.definition_code, subjectEmployeeId: row.subject_employee_id,
      createdAt: row.created_at.toISOString() })));

export const retryHeldRouting = withAnyPermission('admin.settings', 'workflow.routing_holds')
  .route({ method: 'POST', path: '/workflows/requests/{requestId}/retry-routing', summary: 'Retry a held chain after repairing its routing; does not approve' })
  .input(z.object({ requestId: z.coerce.number().int().positive(), reason: z.string().trim().min(1).max(1000) }))
  .output(z.object({ routingState: z.enum(['held_for_hr', 'awaiting_approver', 'lapsed']) }))
  .handler(async ({ input, context }) => {
    try { return await retryRouting(context.db, input.requestId, context.user.id, input.reason); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Cannot repair routing';
      if (message.includes('permitted scope')) throw new ORPCError('FORBIDDEN', { message });
      throw new ORPCError('BAD_REQUEST', { message });
    }
  });
