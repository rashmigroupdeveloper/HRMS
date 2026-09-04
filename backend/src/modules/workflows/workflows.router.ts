/**
 * Workflow procedures (WF-01..04). Chains are runtime data (admin.settings);
 * requests/inbox/act are for any authenticated user — the ENGINE enforces who
 * the current approver is, and every touch is audited + receipted.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { assertEmployeesInScope, scopeForPermission } from '../../core/rbac/employee-scope.js';
import { writeAudit } from '../../core/audit/audit.service.js';
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

const createProcedure = withPermission('workflow.participate')
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
    const subjectEmployeeId = input.subjectEmployeeId ?? context.user.employee_id;
    if (subjectEmployeeId === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'No employee record linked to your account — pass subjectEmployeeId' });
    }

    /**
     * W0-T16 (finding [B2]). `subjectEmployeeId` used to be taken from the body
     * and inserted unchecked, so any of 1,066 employees could raise a
     * resignation, transfer or confirmation naming anyone else. The audit did
     * exactly that and the request then auto-approved.
     *
     * Default: you may only raise a request about YOURSELF. Raising on behalf
     * of someone else needs `workflow.request.raise_on_behalf`, which is
     * currently granted to no role pending sponsor decision D21, and is scoped
     * even then — HR raising for their own plant is a different thing from HR
     * raising for the group.
     */
    if (subjectEmployeeId !== context.user.employee_id) {
      if (!context.permissions.has('workflow.request.raise_on_behalf')) {
        throw new ORPCError('FORBIDDEN', {
          message: 'You can only raise a request about yourself',
        });
      }
      await assertEmployeesInScope(
        db,
        await scopeForPermission(db, context.user.id, context.user.employee_id, 'employee.read'),
        [subjectEmployeeId],
      );
    }

    try {
      const requestId = await createRequest(db, {
        definitionCode: input.definitionCode,
        subjectEmployeeId,
        requestedByUserId: context.user.id,
        payload: input.payload,
      });
      return { requestId };
    } catch (err) {
      throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
    }
  });

const inboxProcedure = withPermission('workflow.participate')
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

const actProcedure = withPermission('workflow.participate')
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
    try {
      const outcome = await act(db, {
        requestId: input.requestId,
        actorUserId: context.user.id,
        action: input.action,
        comment: input.comment,
      });
      return { outcome };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cannot act';
      if (message.includes('Not the current approver')) throw new ORPCError('FORBIDDEN', { message });
      throw new ORPCError('BAD_REQUEST', { message });
    }
  });

const resubmitProcedure = withPermission('workflow.participate')
  .route({ method: 'POST', path: '/workflows/requests/{requestId}/resubmit', summary: 'Fix and resubmit a sent-back request' })
  .input(z.object({ requestId: z.coerce.number().int().positive(), payload: z.record(z.unknown()) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const db = context.db;
    try {
      await resubmit(db, { requestId: input.requestId, requesterUserId: context.user.id, payload: input.payload });
      return { ok: true as const };
    } catch (err) {
      throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Cannot resubmit' });
    }
  });

const timelineProcedure = withPermission('workflow.participate')
  .route({ method: 'GET', path: '/workflows/requests/{requestId}', summary: 'Request timeline with notification receipts (WF-04)' })
  .input(z.object({ requestId: z.coerce.number().int().positive() }))
  .output(
    z.object({
      status: z.string(),
      type: z.string(),
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
    const involved =
      request.requested_by === context.user.id ||
      context.user.employee_id === request.subject_employee_id ||
      steps.some((s) => s.approver_user_id === context.user.id || s.delegated_from === context.user.id);
    if (!involved) {
      const { getUserPermissions } = await import('../../core/rbac/permissions.service.js');
      const perms = await getUserPermissions(db, context.user.id);
      if (!perms.has('audit.read')) throw new ORPCError('FORBIDDEN', { message: 'Not involved in this request' });
    }

    return {
      status: request.status,
      type: request.definition_code,
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

const previewProcedure = withPermission('workflow.participate')
  .route({ method: 'GET', path: '/workflows/preview', summary: 'Who will approve this, in this order (SHF-16)' })
  .input(
    z.object({
      definitionCode: z.string().min(1),
      subjectEmployeeId: z.coerce.number().int().positive().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        step: z.number(),
        approverSpec: z.string(),
        slaHours: z.number(),
        vacant: z.boolean(),
        userId: z.number().nullable(),
        displayName: z.string().nullable(),
        delegatedFromUserId: z.number().nullable(),
        delegatedFromName: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const subjectEmployeeId = input.subjectEmployeeId ?? context.user.employee_id;
    if (subjectEmployeeId === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'No employee record linked — pass subjectEmployeeId' });
    }
    /**
     * W0-T20 — a chain preview names people, so it is an employee read and is
     * narrowed by `employee.read`, NOT by the `workflow.participate` gate on
     * this route. Participation is `all` for every role; using it here would
     * have restricted nothing, which the live re-run of the audit's §2 exploit
     * caught: the preview still answered 200 for another company's employee.
     */
    if (subjectEmployeeId !== context.user.employee_id) {
      await assertEmployeesInScope(
        context.db,
        await scopeForPermission(context.db, context.user.id, context.user.employee_id, 'employee.read'),
        [subjectEmployeeId],
      );
    }
    try {
      return await previewChain(context.db, {
        definitionCode: input.definitionCode,
        subjectEmployeeId,
      });
    } catch (err) {
      throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Cannot preview chain' });
    }
  });

const setDelegation = withPermission('workflow.participate')
  .route({ method: 'PUT', path: '/workflows/delegations', summary: 'Delegate YOUR approvals for a date window' })
  .input(
    z.object({
      toUserId: z.number().int().positive(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const db = context.db;
    if (input.toUserId === context.user.id) throw new ORPCError('BAD_REQUEST', { message: 'Cannot delegate to yourself' });
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
      newValue: `→ user ${input.toUserId} (${input.fromDate}..${input.toDate})`,
    });
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

export const workflowsRouter = {
  create: createProcedure,
  inbox: inboxProcedure,
  act: actProcedure,
  resubmit: resubmitProcedure,
  timeline: timelineProcedure,
  preview: previewProcedure,
  setDelegation,
  listDefinitions,
  upsertDefinition,
  escalateNow,
};
