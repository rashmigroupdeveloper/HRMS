/**
 * Stage 5.3 — privacy / DPDP oRPC surface (PRV-01..10).
 * Paths match the frontend PrivacyNoticeGate / PrivacyOpsPage / PrivacyEssSections.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withAnyPermission, withPermission, withStepUp } from '../../api/orpc.js';
import { getUserPermissions } from '../../core/rbac/permissions.service.js';
import { acknowledgeNotice, currentNotice, listNotices, noticeStatus } from './notices.service.js';
import { listAllConsents, listMyConsents, setConsent } from './consents.service.js';
import {
  createRightsRequest,
  fulfillRights,
  listRightsRequests,
  refuseRights,
} from './rights.service.js';
import { confirmPurge, listRetention, proposePurge } from './retention.service.js';
import { listBreaches, listProcessors, recordBreach, upsertProcessor } from './processors.service.js';
import { buildAccessPack, dpoContact, listProcessingRegister } from './export.service.js';

const PURPOSE = z.enum(['photograph', 'wellness', 'bgv', 'family', 'alumni']);
const RIGHTS_KIND = z.enum(['access', 'correction', 'erasure']);

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
  }
  return user.employee_id;
}

function clientIp(req: { ip?: string | undefined; headers: Record<string, unknown> }): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return typeof req.ip === 'string' ? req.ip : null;
}

const noticeStatusProc = authed
  .route({
    method: 'GET',
    path: '/privacy/notice-status',
    summary: 'Whether the current notice needs acknowledgement (PRV-01)',
  })
  .output(
    z.object({
      required: z.boolean(),
      notice: z
        .object({
          id: z.number().int(),
          version: z.number().int(),
          title: z.string(),
          body: z.string(),
          principalClass: z.string().optional(),
          effectiveFrom: z.string().optional(),
        })
        .nullable()
        .optional(),
    }),
  )
  .handler(async ({ context }) => noticeStatus(context.db, context.user.id));

const noticeAck = authed
  .route({ method: 'POST', path: '/privacy/notice/ack', summary: 'Acknowledge the current privacy notice' })
  .input(z.object({ noticeId: z.number().int() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const result = await acknowledgeNotice(
      context.db,
      context.user.id,
      input.noticeId,
      clientIp(context.req),
    );
    if (result === 'not_found') throw new ORPCError('NOT_FOUND', { message: 'Notice not found' });
    return { ok: true as const };
  });

const noticeGet = authed
  .route({ method: 'GET', path: '/privacy/notice', summary: 'Current employee privacy notice' })
  .output(
    z
      .object({
        id: z.number().int(),
        version: z.number().int(),
        title: z.string(),
        body: z.string(),
        principalClass: z.string(),
        effectiveFrom: z.string(),
        isCurrent: z.boolean(),
      })
      .nullable(),
  )
  .handler(async ({ context }) => currentNotice(context.db));

const noticesList = withPermission('prv.notice.manage')
  .route({ method: 'GET', path: '/privacy/notices', summary: 'All notice versions' })
  .output(
    z.object({
      notices: z.array(
        z.object({
          id: z.number().int(),
          version: z.number().int(),
          principalClass: z.string(),
          title: z.string(),
          effectiveFrom: z.string(),
          isCurrent: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({ notices: await listNotices(context.db) }));

const registerGet = authed
  .route({ method: 'GET', path: '/privacy/register', summary: 'Processing register (PRV-02)' })
  .output(
    z.object({
      entries: z.array(
        z.object({
          dataClass: z.string(),
          purpose: z.string(),
          lawfulBasis: z.string(),
          retentionDays: z.number().int(),
          recipients: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({ entries: await listProcessingRegister(context.db) }));

const consentsGet = authed
  .route({
    method: 'GET',
    path: '/privacy/consents',
    summary: 'Consents — mine, or all when scope=all (PRV-03)',
  })
  .input(z.object({ scope: z.enum(['mine', 'all']).default('mine') }).default({ scope: 'mine' }))
  .output(
    z.object({
      consents: z.array(
        z.object({
          employeeId: z.number().int().optional(),
          employeeName: z.string().nullable().optional(),
          purpose: z.string(),
          granted: z.boolean(),
          updatedAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.scope === 'all') {
      const perms = await getUserPermissions(context.db, context.user.id);
      if (!perms.has('prv.consent.read') && !perms.has('prv.rights.handle')) {
        throw new ORPCError('FORBIDDEN', { message: 'Missing permission: prv.consent.read' });
      }
      return { consents: await listAllConsents(context.db) };
    }
    return { consents: await listMyConsents(context.db, requireEmployeeId(context.user)) };
  });

const consentsPut = authed
  .route({ method: 'PUT', path: '/privacy/consents', summary: 'Grant or withdraw a consent' })
  .input(z.object({ purpose: PURPOSE, granted: z.boolean() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await setConsent(context.db, {
      employeeId: requireEmployeeId(context.user),
      userId: context.user.id,
      purpose: input.purpose,
      granted: input.granted,
      ip: clientIp(context.req),
    });
    return { ok: true as const };
  });

const rightsCreate = authed
  .route({ method: 'POST', path: '/privacy/rights', summary: 'File a DPDP rights request' })
  .input(z.object({ kind: RIGHTS_KIND, reason: z.string().max(2000).nullable().optional() }))
  .output(z.object({ id: z.number().int() }))
  .handler(async ({ input, context }) =>
    createRightsRequest(context.db, {
      employeeId: requireEmployeeId(context.user),
      userId: context.user.id,
      kind: input.kind,
      reason: input.reason ?? null,
      ip: clientIp(context.req),
    }),
  );

const rightsList = withPermission('prv.rights.handle')
  .route({ method: 'GET', path: '/privacy/rights', summary: 'DPO inbox of rights requests' })
  .output(
    z.object({
      requests: z.array(
        z.object({
          id: z.number().int(),
          employeeId: z.number().int(),
          employeeName: z.string().nullable().optional(),
          employeeEmail: z.string().nullable().optional(),
          kind: z.string(),
          status: z.string(),
          reason: z.string().nullable(),
          refusalReason: z.string().nullable(),
          dueAt: z.string(),
          closedAt: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({ requests: await listRightsRequests(context.db) }));

const rightsFulfill = withPermission('prv.rights.handle')
  .route({ method: 'POST', path: '/privacy/rights/fulfill', summary: 'Mark a rights request fulfilled' })
  .input(z.object({ id: z.number().int() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const result = await fulfillRights(context.db, input.id, context.user.id);
    if (result === 'not_found') throw new ORPCError('NOT_FOUND', { message: 'Request not found' });
    if (result === 'closed') throw new ORPCError('CONFLICT', { message: 'Request already closed' });
    return { ok: true as const };
  });

const rightsRefuse = withPermission('prv.rights.handle')
  .route({ method: 'POST', path: '/privacy/rights/refuse', summary: 'Refuse a rights request with reason' })
  .input(z.object({ id: z.number().int(), reason: z.string().min(3).max(2000) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const result = await refuseRights(context.db, input.id, context.user.id, input.reason);
    if (result === 'not_found') throw new ORPCError('NOT_FOUND', { message: 'Request not found' });
    if (result === 'closed') throw new ORPCError('CONFLICT', { message: 'Request already closed' });
    if (result === 'no_reason') {
      throw new ORPCError('BAD_REQUEST', { message: 'Refusal requires a reason' });
    }
    return { ok: true as const };
  });

const retentionGet = withPermission('prv.retention.manage')
  .route({ method: 'GET', path: '/privacy/retention', summary: 'Retention rules and purge proposals' })
  .output(
    z.object({
      rules: z.array(
        z.object({
          dataClass: z.string(),
          retentionDays: z.number().int(),
          openHolds: z.number().int().optional(),
        }),
      ),
      proposals: z.array(
        z.object({
          id: z.number().int(),
          dataClass: z.string(),
          rowCount: z.number().int(),
          excludedHolds: z.number().int(),
          proposedBy: z.string().nullable().optional(),
          proposedAt: z.string(),
          confirmedAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => listRetention(context.db));

const purgePropose = withPermission('prv.retention.manage')
  .route({ method: 'POST', path: '/privacy/purge/propose', summary: 'Propose a purge (DPO)' })
  .input(z.object({ dataClass: z.string().min(1).max(80) }))
  .output(
    z.object({
      id: z.number().int(),
      dataClass: z.string(),
      rowCount: z.number().int(),
      excludedHolds: z.number().int(),
      proposedBy: z.string().nullable().optional(),
      proposedAt: z.string(),
      confirmedAt: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await proposePurge(context.db, input.dataClass, context.user.id);
    if (result === 'unknown_class') {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Unknown data class — add it to the processing register first',
      });
    }
    return result;
  });

const purgeConfirm = withStepUp('prv.retention.manage')
  .route({
    method: 'POST',
    path: '/privacy/purge/confirm',
    summary: 'Confirm a purge (second person + step-up)',
  })
  .input(z.object({ proposalId: z.number().int() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const result = await confirmPurge(context.db, input.proposalId, context.user.id);
    if (result === 'not_found') throw new ORPCError('NOT_FOUND', { message: 'Proposal not found' });
    if (result === 'already') throw new ORPCError('CONFLICT', { message: 'Already confirmed' });
    if (result === 'same_user') {
      throw new ORPCError('FORBIDDEN', {
        message: 'Two-person rule: the proposer cannot confirm (PRV-06)',
      });
    }
    return { ok: true as const };
  });

const processorsGet = withAnyPermission('prv.breach.manage', 'prv.retention.manage', 'prv.rights.handle')
  .route({ method: 'GET', path: '/privacy/processors', summary: 'Processor / DPA register' })
  .output(
    z.object({
      processors: z.array(
        z.object({
          id: z.number().int(),
          name: z.string(),
          purpose: z.string(),
          dpaStatus: z.string(),
          dpaExpiresOn: z.string().nullable(),
          ownerEmail: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({ processors: await listProcessors(context.db) }));

const processorsUpsert = withPermission('prv.breach.manage')
  .route({ method: 'POST', path: '/privacy/processors', summary: 'Upsert a processor (PRV-08)' })
  .input(
    z.object({
      id: z.number().int().optional(),
      name: z.string().min(1),
      purpose: z.string().min(1),
      dpaStatus: z.enum(['active', 'expired', 'missing']),
      dpaExpiresOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      ownerEmail: z.string().email().nullable(),
    }),
  )
  .output(
    z.object({
      id: z.number().int(),
      name: z.string(),
      dpaStatus: z.string(),
      dpaExpiresOn: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const row = await upsertProcessor(context.db, {
      ...(input.id === undefined ? {} : { id: input.id }),
      name: input.name,
      purpose: input.purpose,
      dpaStatus: input.dpaStatus,
      dpaExpiresOn: input.dpaExpiresOn,
      ownerEmail: input.ownerEmail,
      actorUserId: context.user.id,
    });
    return {
      id: row.id,
      name: row.name,
      dpaStatus: row.dpaStatus,
      dpaExpiresOn: row.dpaExpiresOn,
    };
  });

const breachesGet = withPermission('prv.breach.manage')
  .route({ method: 'GET', path: '/privacy/breaches', summary: 'Breach register' })
  .output(
    z.object({
      breaches: z.array(
        z.object({
          id: z.number().int(),
          discoveredAt: z.string(),
          summary: z.string(),
          notifiedBoardAt: z.string().nullable(),
          notifiedPrincipalsAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({ breaches: await listBreaches(context.db) }));

const breachRecord = withPermission('prv.breach.manage')
  .route({ method: 'POST', path: '/privacy/breaches', summary: 'Append a breach register row' })
  .input(z.object({ summary: z.string().min(5).max(4000) }))
  .output(z.object({ id: z.number().int() }))
  .handler(async ({ input, context }) => recordBreach(context.db, input.summary, context.user.id));

const dpoGet = authed
  .route({ method: 'GET', path: '/privacy/dpo', summary: 'DPO contact card (PRV-10)' })
  .output(
    z.object({
      name: z.string(),
      email: z.string(),
      phone: z.string().nullable().optional(),
      responseSlaDays: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ context }) => dpoContact(context.db));

const exportPack = withPermission('prv.rights.handle')
  .route({ method: 'GET', path: '/privacy/export', summary: 'Masked access pack (PRV-05)' })
  .input(z.object({ employeeId: z.number().int() }))
  .output(z.record(z.unknown()))
  .handler(async ({ input, context }) =>
    buildAccessPack(context.db, input.employeeId, context.user.id),
  );

export const privacyRouter = {
  noticeStatus: noticeStatusProc,
  noticeAck,
  noticeGet,
  noticesList,
  registerGet,
  consentsGet,
  consentsPut,
  rightsCreate,
  rightsList,
  rightsFulfill,
  rightsRefuse,
  retentionGet,
  purgePropose,
  purgeConfirm,
  processorsGet,
  processorsUpsert,
  breachesGet,
  breachRecord,
  dpoGet,
  exportPack,
};
