/**
 * Policy repository API (CORE-13). Central gates:
 *   publish            → engagement.publish (HR)
 *   my policies + ack  → employee.read (ESS basics; self-scoped)
 *   HR ack tile        → reports.hr
 *   weekly nag trigger → admin.integrations
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { readDocument } from '../../core/storage/index.js';
import { acknowledgePolicy, listActivePolicies, listPoliciesFor, myPendingPolicies, policyAckStatus, publishPolicy, runPolicyAckNag } from './policies.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
  }
  return user.employee_id;
}

/** A policy carries a document OR a short body summary (or both). */
const policyListItem = z.object({
  id: z.number(),
  title: z.string(),
  documentId: z.number().nullable(),
  bodySummary: z.string().nullable(),
  effectiveDate: z.string(),
  requiresAcknowledgment: z.boolean(),
  acknowledgedAt: z.string().nullable(),
});

const publish = withPermission('engagement.publish')
  .route({ method: 'POST', path: '/policies', summary: 'Publish a policy — document and/or short summary (CORE-13, audited)' })
  .input(
    z.object({
      title: z.string().min(3),
      effectiveDate: isoDate,
      requiresAcknowledgment: z.boolean().default(true),
      audience: z
        .object({
          categories: z.array(z.enum(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract'])).optional(),
          departmentIds: z.array(z.number().int()).optional(),
          locationIds: z.array(z.number().int()).optional(),
        })
        .optional(),
      // Either a document (fileName+mime+content) or a bodySummary — or both.
      bodySummary: z.string().min(1).optional(),
      fileName: z.string().min(1).optional(),
      mime: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      return {
        id: await publishPolicy(context.db, {
          title: input.title,
          effectiveDate: input.effectiveDate,
          requiresAcknowledgment: input.requiresAcknowledgment,
          audience: input.audience,
          bodySummary: input.bodySummary,
          fileName: input.fileName,
          mime: input.mime,
          content: input.content,
          actorUserId: context.user.id,
        }),
      };
    } catch (err) {
      throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
    }
  });

const myPolicies = withPermission('employee.read')
  .route({ method: 'GET', path: '/policies', summary: 'Policies targeting me, with my acknowledgment state (ESS)' })
  .output(z.array(policyListItem))
  .handler(({ context }) => listPoliciesFor(context.db, requireEmployeeId(context.user)));

const pendingPolicies = withPermission('employee.read')
  .route({ method: 'GET', path: '/policies/pending', summary: 'Policies I still need to acknowledge (ESS)' })
  .output(z.array(policyListItem))
  .handler(({ context }) => myPendingPolicies(context.db, requireEmployeeId(context.user)));

const policyCatalog = withPermission('reports.hr')
  .route({ method: 'GET', path: '/policies/catalog', summary: 'Full active-policy catalog (HR, not audience-filtered)' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        documentId: z.number().nullable(),
        bodySummary: z.string().nullable(),
        effectiveDate: z.string(),
        requiresAcknowledgment: z.boolean(),
      }),
    ),
  )
  .handler(({ context }) => listActivePolicies(context.db));

const policyContent = withPermission('employee.read')
  .route({ method: 'GET', path: '/policies/{id}/content', summary: 'Policy body — the document, or the summary text if there is no file' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ mime: z.string(), fileName: z.string(), content: z.string() }))
  .handler(async ({ input, context }) => {
    const policy = await context.db
      .selectFrom('core.policies')
      .select(['document_id', 'body_summary', 'title'])
      .where('id', '=', input.id)
      .where('is_active', '=', true)
      .executeTakeFirst();
    if (!policy) throw new ORPCError('NOT_FOUND', { message: 'No such policy' });
    if (policy.document_id === null) {
      return { mime: 'text/plain', fileName: `${policy.title}.txt`, content: policy.body_summary ?? '' };
    }
    const doc = await readDocument(context.db, policy.document_id);
    return { mime: doc.mime, fileName: doc.originalName, content: doc.content.toString('utf8') };
  });

const ack = withPermission('employee.read')
  .route({ method: 'POST', path: '/policies/{id}/ack', summary: 'Acknowledge a policy (idempotent)' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await acknowledgePolicy(context.db, input.id, requireEmployeeId(context.user));
    return { ok: true as const };
  });

const ackStatus = withPermission('reports.hr')
  .route({ method: 'GET', path: '/policies/ack-status', summary: 'The live HR tile: per-policy acknowledgment % (CORE-13)' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        effectiveDate: z.string(),
        targeted: z.number(),
        acknowledged: z.number(),
        pct: z.number(),
      }),
    ),
  )
  .handler(({ context }) => policyAckStatus(context.db));

const nag = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/policies/nag', summary: 'Remind non-acknowledgers now (also runs weekly)' })
  .output(z.object({ queued: z.number() }))
  .handler(async ({ context }) => ({ queued: await runPolicyAckNag(context.db) }));

export const policiesRouter = { publish, myPolicies, pendingPolicies, policyCatalog, policyContent, ack, ackStatus, nag };
