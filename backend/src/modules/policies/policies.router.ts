import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { formatDbDate } from '../../core/dates.js';
import {
  acknowledgePolicy,
  listActivePolicies,
  myPendingPolicies,
  policyAckStats,
  publishPolicy,
  runPolicyAckNag,
} from './policies.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
  }
  return user.employee_id;
}

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

const list = withPermission('attendance.own')
  .route({ method: 'GET', path: '/policies', summary: 'Active policies (CORE-13)' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        bodySummary: z.string().nullable(),
        effectiveDate: z.string(),
        requiresAcknowledgment: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await listActivePolicies(context.db);
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      bodySummary: p.body_summary,
      effectiveDate: formatDbDate(p.effective_date),
      requiresAcknowledgment: p.requires_acknowledgment,
    }));
  });

const pending = withPermission('attendance.own')
  .route({ method: 'GET', path: '/policies/pending', summary: 'Policies I still need to acknowledge' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        bodySummary: z.string().nullable(),
        effectiveDate: z.string(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const employeeId = requireEmployeeId(context.user);
    const rows = await myPendingPolicies(context.db, employeeId);
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      bodySummary: p.body_summary,
      effectiveDate: formatDbDate(p.effective_date),
    }));
  });

const acknowledge = withPermission('attendance.own')
  .route({ method: 'POST', path: '/policies/acknowledge', summary: 'Acknowledge a policy (CORE-13)' })
  .input(z.object({ policyId: z.number().int().positive() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      await acknowledgePolicy(context.db, {
        policyId: input.policyId,
        employeeId: requireEmployeeId(context.user),
      });
      return { ok: true as const };
    } catch (err) {
      asBadRequest(err);
    }
  });

const publish = withPermission('engagement.publish')
  .route({ method: 'POST', path: '/policies/publish', summary: 'Publish a policy (HR)' })
  .input(
    z.object({
      title: z.string().min(3),
      bodySummary: z.string().optional(),
      effectiveDate: isoDate,
      requiresAcknowledgment: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    const id = await publishPolicy(context.db, {
      title: input.title,
      bodySummary: input.bodySummary,
      effectiveDate: input.effectiveDate,
      requiresAcknowledgment: input.requiresAcknowledgment,
      actorUserId: context.user.id,
    });
    return { id };
  });

const stats = withPermission('reports.hr')
  .route({ method: 'GET', path: '/policies/ack-stats', summary: 'Policy acknowledgment % for HR tile' })
  .output(
    z.object({
      policyCount: z.number(),
      activeEmployees: z.number(),
      expectedAcks: z.number(),
      actualAcks: z.number(),
      percent: z.number(),
    }),
  )
  .handler(async ({ context }) => policyAckStats(context.db));

const nag = withPermission('engagement.publish')
  .route({ method: 'POST', path: '/policies/nag', summary: 'Run weekly policy-ack nag now' })
  .output(z.object({ usersNotified: z.number() }))
  .handler(async ({ context }) => ({ usersNotified: await runPolicyAckNag(context.db) }));

export const policiesRouter = { list, pending, acknowledge, publish, stats, nag };
