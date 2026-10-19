/**
 * Workflow procedures (WF-01..04). Chains are runtime data (admin.settings);
 * requests/inbox/act are for any authenticated user — the ENGINE enforces who
 * the current approver is, and every touch is audited + receipted.
 */
import { ORPCError } from '@orpc/server';
import { sql } from 'kysely';
import { z } from 'zod';
import { istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';
import { DOMAIN_RESERVED_DEFINITIONS } from './workflow-hooks.js';
import { authed, withPermission } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { employeeScopeSql } from '../../core/rbac/employee-scope.js';
import { getUserPermissionAccess } from '../../core/rbac/permissions.service.js';
import { canActOnStep } from './workflow-approvers.js';
import { routingHolds, retryHeldRouting } from './workflow-holds.router.js';
import { routingHeldSql } from './workflow-holds.service.js';
import {
  act,
  createRequest,
  inbox,
  previewChain,
  resubmit,
  runEscalations,
  stepsSchema,
  timeline,
} from './workflow.service.js';

const createProcedure = authed
  .route({ method: 'POST', path: '/workflows/requests', summary: 'Raise a request (subject defaults to yourself)' })
  .input(
    z.object({
      definitionCode: z.string().min(1),
      payload: z.record(z.unknown()),
      subjectEmployeeId: z.number().int().positive().optional(),
    }),
  )
  .output(z.object({ requestId: z.number() }))
  .handler(async ({ input, context }) => {
    const db = context.db;
    if (DOMAIN_RESERVED_DEFINITIONS.has(input.definitionCode)) {
      throw new ORPCError('BAD_REQUEST', {
        message: `Requests for '${input.definitionCode}' must be submitted via their dedicated domain API endpoint.`,
      });
    }

    const subjectEmployeeId = input.subjectEmployeeId ?? context.user.employee_id;
    if (subjectEmployeeId === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'No employee record linked to your account — pass subjectEmployeeId' });
    }

    if (subjectEmployeeId !== context.user.employee_id) {
      const { getUserPermissions } = await import('../../core/rbac/permissions.service.js');
      const perms = await getUserPermissions(db, context.user.id, 'write');
      if (!perms.has('admin.workflows') && !perms.has('admin.settings')) {
        throw new ORPCError('FORBIDDEN', {
          message: 'You can only raise workflow requests for yourself unless you hold workflow administration permissions',
        });
      }
    }

    const requestId = await createRequest(db, {
      definitionCode: input.definitionCode,
      subjectEmployeeId,
      requestedByUserId: context.user.id,
      payload: input.payload,
    });
    return { requestId };
  });

const inboxProcedure = authed
  .route({ method: 'GET', path: '/workflows/inbox', summary: 'Everything waiting on YOUR approval, SLA-sorted' })
  .output(
    z.array(
      z.object({
        requestId: z.number(),
        type: z.string(),
        typeName: z.string(),
        subject: z.object({ ecode: z.string(), name: z.string() }),
        payload: z.unknown(),
        stepNo: z.number(),
        notifiedAt: z.string(),
        slaDueAt: z.string(),
        delegated: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const db = context.db;
    const rows = await inbox(db, context.user.id);
    return rows.map((r) => ({
      requestId: r.request_id,
      type: r.definition_code,
      typeName: r.definition_name,
      subject: { ecode: r.subject_ecode, name: `${r.subject_first_name} ${r.subject_last_name ?? ''}`.trim() },
      payload: r.payload,
      stepNo: r.step_no,
      notifiedAt: r.notified_at.toISOString(),
      slaDueAt: r.sla_due_at.toISOString(),
      delegated: r.delegated_from !== null,
    }));
  });

const actProcedure = authed
  .route({ method: 'POST', path: '/workflows/requests/{requestId}/act', summary: 'Approve / reject / send back (current approver only)' })
  .input(
    z.object({
      requestId: z.coerce.number().int().positive(),
      action: z.enum(['approve', 'reject', 'send_back']),
      comment: z.string().max(1000).optional(),
    }),
  )
  .output(z.object({ outcome: z.enum(['advanced', 'approved', 'rejected', 'sent_back']) }))
  .handler(async ({ input, context }) => {
    const db = context.db;
    // Errors map centrally: 'Not the current approver' / SoD → 403, rules → 400.
    const outcome = await act(db, {
      requestId: input.requestId,
      actorUserId: context.user.id,
      action: input.action,
      comment: input.comment,
    });
    return { outcome };
  });

const resubmitProcedure = authed
  .route({ method: 'POST', path: '/workflows/requests/{requestId}/resubmit', summary: 'Fix and resubmit a sent-back request' })
  .input(z.object({ requestId: z.coerce.number().int().positive(), payload: z.record(z.unknown()) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const db = context.db;
    await resubmit(db, { requestId: input.requestId, requesterUserId: context.user.id, payload: input.payload });
    return { ok: true as const };
  });

const timelineProcedure = authed
  .route({ method: 'GET', path: '/workflows/requests/{requestId}', summary: 'Request timeline with notification receipts (WF-04)' })
  .input(z.object({ requestId: z.coerce.number().int().positive() }))
  .output(
    z.object({
      status: z.string(),
      type: z.string(),
      canResubmit: z.boolean(),
      routingState: z.enum(['held_for_hr', 'awaiting_approver']).nullable(),
      payload: z.unknown(),
      steps: z.array(
        z.object({
          stepNo: z.number(),
          approverUserId: z.number(),
          delegatedFrom: z.number().nullable(),
          action: z.string().nullable(),
          comment: z.string().nullable(),
          notifiedAt: z.string(),
          actedAt: z.string().nullable(),
          slaDueAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const db = context.db;
    const request = await db.selectFrom('wf.requests').selectAll().where('id', '=', input.requestId).executeTakeFirst();
    if (!request) throw new ORPCError('NOT_FOUND', { message: 'Request not found' });

    // Visible to the requester, the subject, anyone who held a step, and HR (audit.read).
    const steps = await timeline(db, input.requestId);
    let involved =
      request.requested_by === context.user.id ||
      context.user.employee_id === request.subject_employee_id;
    if (!involved) {
      for (const step of steps.filter(s => s.approver_user_id === context.user.id || s.delegated_from === context.user.id)) {
        if (await canActOnStep(db, step, context.user.id, request)) { involved = true; break; }
      }
    }
    if (!involved) {
      const auditAccess = await getUserPermissionAccess(db, context.user.id, 'audit.read');
      const allowed = auditAccess && await db.selectFrom('core.employees as e').select('e.id')
        .where('e.id', '=', request.subject_employee_id)
        .where(employeeScopeSql({ ...auditAccess, actorEmployeeId: context.user.employee_id }))
        .executeTakeFirst();
      if (!allowed) throw new ORPCError('FORBIDDEN', { message: 'Not involved in this request or outside your permitted scope' });
    }

    return {
      status: request.status,
      type: request.definition_code,
      canResubmit: request.status === 'sent_back' && request.requested_by === context.user.id,
      routingState: request.status === 'pending'
        ? (await db.selectFrom('wf.requests as r').select('r.id').where('r.id', '=', request.id)
          .where(routingHeldSql()).executeTakeFirst() ? 'held_for_hr' as const : 'awaiting_approver' as const)
        : null,
      payload: request.payload,
      steps: steps.map((s) => ({
        stepNo: s.step_no,
        approverUserId: s.approver_user_id,
        delegatedFrom: s.delegated_from,
        action: s.action,
        comment: s.comment,
        notifiedAt: s.notified_at.toISOString(),
        actedAt: s.acted_at?.toISOString() ?? null,
        slaDueAt: s.sla_due_at.toISOString(),
      })),
    };
  });

const setDelegation = authed
  .route({ method: 'PUT', path: '/workflows/delegations', summary: 'Delegate YOUR approvals for a date window' })
  .input(
    z.object({
      // E2E-013: the UI picks a colleague by work email or e-code; toUserId stays for API clients.
      toUserId: z.number().int().positive().optional(),
      to: z.string().trim().min(2).max(254).optional(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input: raw, context }) => {
    const db = context.db;
    let toUserId = raw.toUserId;
    if (toUserId === undefined) {
      const key = (raw.to ?? '').trim();
      if (!key) throw new ORPCError('BAD_REQUEST', { message: 'Choose who to delegate to' });
      const hit = await db.selectFrom('core.users as u').leftJoin('core.employees as e', 'e.id', 'u.employee_id').select('u.id')
        .where('u.is_active', '=', true)
        .where((eb) => eb.or([eb(sql`lower(u.email)`, '=', key.toLowerCase()), eb('e.ecode', '=', key.toUpperCase())])).executeTakeFirst();
      if (!hit) throw new ORPCError('NOT_FOUND', { message: `No active user with email or e-code ${key}` });
      toUserId = hit.id;
    }
    const input = { ...raw, toUserId };
    if (input.toUserId === context.user.id) throw new ORPCError('BAD_REQUEST', { message: 'Cannot delegate to yourself' });
    if (input.fromDate > input.toDate) throw new ORPCError('BAD_REQUEST', { message: 'fromDate must be on or before toDate' });
    if (input.toDate < istDateString()) throw new ORPCError('BAD_REQUEST', { message: 'The delegation window has already ended' });
    const maxDays = await getTypedSetting(db, 'wf.delegation_max_days', 'number', 90);
    const spanDays = (Date.parse(`${input.toDate}T00:00:00Z`) - Date.parse(`${input.fromDate}T00:00:00Z`)) / 86_400_000 + 1;
    if (spanDays > maxDays) throw new ORPCError('BAD_REQUEST', { message: `A delegation may cover at most ${String(maxDays)} days` });
    // C-07 / B-03 / A-16: the delegate must be an ACTIVE colleague with an
    // employee record, in the same company, and NOT someone whose requests
    // the delegator approves (a report) — otherwise the delegate could approve
    // their own leave.
    const delegate = await db.selectFrom('core.users as u')
      .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
      .select(['u.id', 'u.is_active', 'u.employee_id', 'e.company_id', 'e.status'])
      .where('u.id', '=', input.toUserId).executeTakeFirst();
    if (!delegate?.is_active || delegate.employee_id === null || delegate.status === 'exited') {
      throw new ORPCError('BAD_REQUEST', { message: 'Delegate must be an active employee login' });
    }
    if (context.user.employee_id !== null) {
      const me = await db.selectFrom('core.employees').select('company_id').where('id', '=', context.user.employee_id).executeTakeFirst();
      if (me && me.company_id !== delegate.company_id) {
        throw new ORPCError('FORBIDDEN', { message: 'Delegate must belong to your company' });
      }
      const report = await db.selectFrom('core.reporting_tree').select('employee_id')
        .where('manager_id', '=', context.user.employee_id).where('employee_id', '=', delegate.employee_id).executeTakeFirst();
      if (report) {
        throw new ORPCError('FORBIDDEN', { message: 'You cannot delegate approvals to someone who reports to you' });
      }
    }
    const overlap = await db.selectFrom('wf.delegations').select('id')
      .where('from_user_id', '=', context.user.id)
      .where('from_date', '<=', input.toDate as unknown as Date)
      .where('to_date', '>=', input.fromDate as unknown as Date)
      .executeTakeFirst();
    if (overlap) throw new ORPCError('CONFLICT', { message: 'You already have a delegation overlapping these dates — revoke it first' });
    await db
      .insertInto('wf.delegations')
      .values({
        from_user_id: context.user.id,
        to_user_id: input.toUserId,
        from_date: input.fromDate as unknown as Date,
        to_date: input.toDate as unknown as Date,
      })
      .execute();
    await writeAudit(db, {
      actorUserId: context.user.id,
      action: 'create',
      entity: 'wf.delegations',
      subjectEmployeeId: context.user.employee_id,
      newValue: `→ user ${String(input.toUserId)} (${input.fromDate}..${input.toDate})`,
    });
    return { ok: true as const };
  });

const listDelegations = authed
  .route({ method: 'GET', path: '/workflows/delegations', summary: 'My active and upcoming delegations' })
  .output(z.array(z.object({ id: z.number(), toUserId: z.number(), toEmail: z.string(), fromDate: z.string(), toDate: z.string() })))
  .handler(async ({ context }) => {
    const rows = await context.db.selectFrom('wf.delegations as d').innerJoin('core.users as u', 'u.id', 'd.to_user_id')
      .select(['d.id', 'd.to_user_id', 'u.email', sql<string>`d.from_date::text`.as('from_date'), sql<string>`d.to_date::text`.as('to_date')])
      .where('d.from_user_id', '=', context.user.id)
      .where('d.to_date', '>=', istDateString() as unknown as Date)
      .orderBy('d.from_date').execute();
    return rows.map((r) => ({ id: r.id, toUserId: r.to_user_id, toEmail: r.email, fromDate: r.from_date, toDate: r.to_date }));
  });

const revokeDelegation = authed
  .route({ method: 'DELETE', path: '/workflows/delegations/{id}', summary: 'End one of my delegations today' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const row = await context.db.selectFrom('wf.delegations').select(['id', 'from_user_id'])
      .where('id', '=', input.id).executeTakeFirst();
    if (row?.from_user_id !== context.user.id) throw new ORPCError('NOT_FOUND', { message: 'Delegation not found' });
    await context.db.deleteFrom('wf.delegations').where('id', '=', input.id).execute();
    await writeAudit(context.db, { actorUserId: context.user.id, action: 'delete', entity: 'wf.delegations', entityId: input.id });
    return { ok: true as const };
  });

const listDefinitions = withPermission('admin.settings')
  .route({ method: 'GET', path: '/workflows/definitions', summary: 'The approval-chain catalog (runtime data)' })
  .output(z.array(z.object({ code: z.string(), name: z.string(), steps: z.unknown(), isActive: z.boolean() })))
  .handler(async ({ context }) => {
    const db = context.db;
    const rows = await db.selectFrom('wf.definitions').selectAll().orderBy('code').execute();
    return rows.map((r) => ({ code: r.code, name: r.name, steps: r.steps, isActive: r.is_active }));
  });

const upsertDefinition = withPermission('admin.settings')
  .route({ method: 'PUT', path: '/workflows/definitions/{code}', summary: 'Edit an approval chain (audited; effective immediately)' })
  .input(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      steps: stepsSchema,
      isActive: z.boolean().default(true),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const db = context.db;
    const previous = await db.selectFrom('wf.definitions').select('steps').where('code', '=', input.code).executeTakeFirst();
    await db
      .insertInto('wf.definitions')
      .values({ code: input.code, name: input.name, steps: JSON.stringify(input.steps), is_active: input.isActive })
      .onConflict((oc) =>
        oc.column('code').doUpdateSet({ name: input.name, steps: JSON.stringify(input.steps), is_active: input.isActive }),
      )
      .execute();
    await writeAudit(db, {
      actorUserId: context.user.id,
      action: previous ? 'update' : 'create',
      entity: 'wf.definitions',
      field: input.code,
      oldValue: previous ? JSON.stringify(previous.steps) : null,
      newValue: JSON.stringify(input.steps),
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

const escalateNow = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/workflows/escalate', summary: 'Run the SLA escalation sweep now' })
  .output(z.object({ handled: z.number() }))
  .handler(async ({ context }) => {
    const db = context.db;
    return { handled: await runEscalations(db) };
  });

const preview = authed
  .route({ method: 'GET', path: '/workflows/preview', summary: 'Who will approve this request for the caller (SHF-16)' })
  .input(z.object({ definitionCode: z.string().min(1) }))
  .output(z.array(z.object({
    step: z.number(),
    approverSpec: z.string(),
    slaHours: z.number(),
    vacant: z.boolean(),
    userId: z.number().nullable(),
    displayName: z.string().nullable(),
    delegatedFromUserId: z.number().nullable(),
    delegatedFromName: z.string().nullable(),
  })))
  .handler(async ({ input, context }) => {
    if (context.user.employee_id === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
    }
    return previewChain(context.db, {
      definitionCode: input.definitionCode,
      subjectEmployeeId: context.user.employee_id,
    });
  });

export const workflowsRouter = {
  create: createProcedure,
  preview,
  inbox: inboxProcedure,
  act: actProcedure,
  resubmit: resubmitProcedure,
  timeline: timelineProcedure,
  setDelegation,
  listDelegations,
  revokeDelegation,
  listDefinitions,
  upsertDefinition,
  escalateNow,
  routingHolds,
  retryHeldRouting,
};
