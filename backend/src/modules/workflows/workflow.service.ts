/**
 * The generic approval engine (WF-01..04, doc 11 §4b send_back):
 *   create → resolve approver (RM | functional manager | role | user, with
 *   out-of-office delegation) → NOTIFY (receipt is structural: the step row
 *   cannot exist without notified_at) → act (approve / reject / send_back)
 *   → advance or complete. Vacant approvers are auto-skipped WITH an audit
 *   trail. SLA breaches escalate / auto-reject / lapse / auto-approve per the
 *   definition — all of which is runtime-editable DATA.
 */
import { z } from 'zod';
import type { Kysely, Selectable } from 'kysely';
import type { Database, WfRequestsTable, WfRequestStepsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { enqueue } from '../notifications/index.js';

export const stepSpecSchema = z.object({
  step: z.number().int().positive(),
  /** 'reporting_manager' | 'functional_manager' | 'role:<code>' | 'user:<id>' */
  approver: z.string().min(1),
  slaHours: z.number().positive().default(48),
  onBreach: z.enum(['escalate', 'auto_reject', 'lapse', 'auto_approve']).default('escalate'),
  /** approver spec for escalation target; default = approver's own manager. */
  escalateTo: z.string().min(1).optional(),
});
export type StepSpec = z.infer<typeof stepSpecSchema>;
export const stepsSchema = z.array(stepSpecSchema).min(1);

export type RequestRow = Selectable<WfRequestsTable>;
export type StepRow = Selectable<WfRequestStepsTable>;

interface ResolvedApprover {
  userId: number;
  delegatedFrom: number | null;
}

/** Spec → concrete ACTIVE user, with delegation applied. Null = vacant. */
async function resolveApprover(
  db: Kysely<Database>,
  spec: string,
  subjectEmployeeId: number,
): Promise<ResolvedApprover | null> {
  let userId: number | null = null;

  if (spec === 'reporting_manager' || spec === 'functional_manager') {
    const col = spec === 'reporting_manager' ? 'reporting_manager_id' : 'functional_manager_id';
    const subject = await db
      .selectFrom('core.employees')
      .select([col])
      .where('id', '=', subjectEmployeeId)
      .executeTakeFirst();
    const managerEmployeeId = subject?.[col] ?? null;
    if (managerEmployeeId !== null) {
      const user = await db
        .selectFrom('core.users')
        .select('id')
        .where('employee_id', '=', managerEmployeeId)
        .where('is_active', '=', true)
        .executeTakeFirst();
      userId = user?.id ?? null;
    }
  } else if (spec.startsWith('role:')) {
    const roleCode = spec.slice('role:'.length);
    const user = await db
      .selectFrom('core.user_roles as ur')
      .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
      .innerJoin('core.users as u', 'u.id', 'ur.user_id')
      .where('r.code', '=', roleCode)
      .where('u.is_active', '=', true)
      .select('u.id')
      .orderBy('u.id')
      .executeTakeFirst(); // deterministic first holder; role queues arrive with scoping
    userId = user?.id ?? null;
  } else if (spec.startsWith('user:')) {
    const explicit = Number(spec.slice('user:'.length));
    const user = await db
      .selectFrom('core.users')
      .select('id')
      .where('id', '=', explicit)
      .where('is_active', '=', true)
      .executeTakeFirst();
    userId = user?.id ?? null;
  }

  if (userId === null) return null;

  // Out-of-office delegation (WF-01): active window today.
  const today = new Date().toISOString().slice(0, 10);
  const delegation = await db
    .selectFrom('wf.delegations')
    .select('to_user_id')
    .where('from_user_id', '=', userId)
    .where('from_date', '<=', today as unknown as Date)
    .where('to_date', '>=', today as unknown as Date)
    .orderBy('id', 'desc')
    .executeTakeFirst();

  if (delegation) {
    const delegate = await db
      .selectFrom('core.users')
      .select('id')
      .where('id', '=', delegation.to_user_id)
      .where('is_active', '=', true)
      .executeTakeFirst();
    if (delegate) return { userId: delegate.id, delegatedFrom: userId };
  }
  return { userId, delegatedFrom: null };
}

async function getSteps(db: Kysely<Database>, definitionCode: string): Promise<StepSpec[]> {
  const def = await db
    .selectFrom('wf.definitions')
    .select(['steps', 'is_active'])
    .where('code', '=', definitionCode)
    .executeTakeFirst();
  if (def?.is_active !== true) throw new Error(`Unknown or inactive workflow: ${definitionCode}`);
  return stepsSchema.parse(def.steps);
}

/** Create the step row + its notification — atomically the SAME moment (PP-14). */
async function openStep(
  db: Kysely<Database>,
  requestId: number,
  stepNo: number,
  approver: ResolvedApprover,
  slaHours: number,
  definitionCode: string,
): Promise<void> {
  const now = new Date();
  await enqueue(db, {
    recipientUserId: approver.userId,
    channel: 'in_app',
    templateCode: 'approval_pending',
    payload: { requestId, definitionCode, stepNo },
  });
  await db
    .insertInto('wf.request_steps')
    .values({
      request_id: requestId,
      step_no: stepNo,
      approver_user_id: approver.userId,
      delegated_from: approver.delegatedFrom,
      notified_at: now, // receipt — column is NOT NULL by design
      sla_due_at: new Date(now.getTime() + slaHours * 3600_000),
    })
    .execute();
}

/**
 * Advance from `fromStepNo` (exclusive): opens the next resolvable step;
 * vacant approvers are skipped with an audited 'skipped' row; running out of
 * steps completes the request as approved.
 */
async function advance(
  db: Kysely<Database>,
  request: Pick<RequestRow, 'id' | 'definition_code' | 'subject_employee_id'>,
  fromStepNo: number,
): Promise<void> {
  const steps = await getSteps(db, request.definition_code);

  for (const spec of steps.filter((s) => s.step > fromStepNo).sort((a, b) => a.step - b.step)) {
    const approver = await resolveApprover(db, spec.approver, request.subject_employee_id);
    if (approver) {
      await db.updateTable('wf.requests').set({ current_step: spec.step }).where('id', '=', request.id).execute();
      await openStep(db, request.id, spec.step, approver, spec.slaHours, request.definition_code);
      return;
    }
    // Vacant (no RM, empty role, inactive user): auto-skip, audited (WF-01).
    await writeAudit(db, {
      action: 'update',
      entity: 'wf.requests',
      entityId: request.id,
      field: `step_${spec.step}`,
      newValue: `skipped — approver '${spec.approver}' vacant`,
    });
  }

  await db
    .updateTable('wf.requests')
    .set({ status: 'approved', decided_at: new Date() })
    .where('id', '=', request.id)
    .execute();
}

export async function createRequest(
  db: Kysely<Database>,
  params: {
    definitionCode: string;
    subjectEmployeeId: number;
    requestedByUserId: number;
    payload: Record<string, unknown>;
  },
): Promise<number> {
  await getSteps(db, params.definitionCode); // validates existence + shape

  const request = await db
    .insertInto('wf.requests')
    .values({
      definition_code: params.definitionCode,
      subject_employee_id: params.subjectEmployeeId,
      requested_by: params.requestedByUserId,
      payload: JSON.stringify(params.payload),
    })
    .returning(['id', 'definition_code', 'subject_employee_id'])
    .executeTakeFirstOrThrow();

  await advance(db, request, 0);
  return request.id;
}

export type ActOutcome = 'advanced' | 'approved' | 'rejected' | 'sent_back';

export async function act(
  db: Kysely<Database>,
  params: { requestId: number; actorUserId: number; action: 'approve' | 'reject' | 'send_back'; comment?: string | undefined },
): Promise<ActOutcome> {
  const request = await db
    .selectFrom('wf.requests')
    .selectAll()
    .where('id', '=', params.requestId)
    .executeTakeFirstOrThrow();
  if (request.status !== 'pending') throw new Error(`Request is ${request.status}, not actionable`);

  const step = await db
    .selectFrom('wf.request_steps')
    .selectAll()
    .where('request_id', '=', params.requestId)
    .where('action', 'is', null)
    .orderBy('id', 'desc')
    .executeTakeFirst();
  if (!step) throw new Error('No pending step');
  if (step.approver_user_id !== params.actorUserId) {
    throw new Error('Not the current approver'); // routers map this to FORBIDDEN
  }

  const actionMap = { approve: 'approved', reject: 'rejected', send_back: 'sent_back' } as const;
  await db
    .updateTable('wf.request_steps')
    .set({ action: actionMap[params.action], comment: params.comment ?? null, acted_at: new Date() })
    .where('id', '=', step.id)
    .execute();
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: params.action,
    entity: 'wf.requests',
    entityId: params.requestId,
    field: `step_${step.step_no}`,
    newValue: params.comment ?? null,
  });

  if (params.action === 'approve') {
    await advance(db, request, step.step_no);
    const after = await db
      .selectFrom('wf.requests')
      .select('status')
      .where('id', '=', params.requestId)
      .executeTakeFirstOrThrow();
    return after.status === 'approved' ? 'approved' : 'advanced';
  }

  const status = params.action === 'reject' ? 'rejected' : 'sent_back';
  await db
    .updateTable('wf.requests')
    .set({ status, decided_at: params.action === 'reject' ? new Date() : null })
    .where('id', '=', params.requestId)
    .execute();
  // Tell the requester their request came back / was rejected.
  await enqueue(db, {
    recipientUserId: request.requested_by,
    channel: 'in_app',
    templateCode: params.action === 'reject' ? 'request_rejected' : 'request_sent_back',
    payload: { requestId: params.requestId, comment: params.comment ?? null },
  });
  return status === 'rejected' ? 'rejected' : 'sent_back';
}

/** After send_back: requester edits and the chain restarts from step 1 (doc 11 §4b). */
export async function resubmit(
  db: Kysely<Database>,
  params: { requestId: number; requesterUserId: number; payload: Record<string, unknown> },
): Promise<void> {
  const request = await db
    .selectFrom('wf.requests')
    .selectAll()
    .where('id', '=', params.requestId)
    .executeTakeFirstOrThrow();
  if (request.status !== 'sent_back') throw new Error('Only sent-back requests can be resubmitted');
  if (request.requested_by !== params.requesterUserId) throw new Error('Only the requester can resubmit');

  await db
    .updateTable('wf.requests')
    .set({ payload: JSON.stringify(params.payload), status: 'pending', current_step: 1 })
    .where('id', '=', params.requestId)
    .execute();
  await advance(db, request, 0);
}

/** SLA sweep (hourly job — WF-03). Returns how many steps were acted on. */
export async function runEscalations(db: Kysely<Database>, asOf = new Date()): Promise<number> {
  const overdue = await db
    .selectFrom('wf.request_steps as s')
    .innerJoin('wf.requests as r', 'r.id', 's.request_id')
    .where('s.action', 'is', null)
    .where('s.sla_due_at', '<', asOf)
    .where('r.status', '=', 'pending')
    .select(['s.id as step_id', 's.step_no', 's.approver_user_id', 'r.id as request_id', 'r.definition_code', 'r.subject_employee_id', 'r.requested_by'])
    .execute();

  let handled = 0;
  for (const row of overdue) {
    const steps = await getSteps(db, row.definition_code);
    const spec = steps.find((s) => s.step === row.step_no);
    const onBreach = spec?.onBreach ?? 'escalate';

    await db
      .updateTable('wf.request_steps')
      .set({ action: 'escalated', acted_at: asOf, comment: `SLA breached → ${onBreach}` })
      .where('id', '=', row.step_id)
      .execute();
    await writeAudit(db, {
      action: 'update',
      entity: 'wf.requests',
      entityId: row.request_id,
      field: `step_${row.step_no}`,
      newValue: `SLA breach → ${onBreach}`,
    });

    if (onBreach === 'auto_reject' || onBreach === 'lapse') {
      const status = onBreach === 'auto_reject' ? 'rejected' : 'lapsed';
      await db.updateTable('wf.requests').set({ status, decided_at: asOf }).where('id', '=', row.request_id).execute();
      await enqueue(db, {
        recipientUserId: row.requested_by,
        channel: 'in_app',
        templateCode: `request_${status}`,
        payload: { requestId: row.request_id },
      });
    } else if (onBreach === 'auto_approve') {
      await advance(db, { id: row.request_id, definition_code: row.definition_code, subject_employee_id: row.subject_employee_id }, row.step_no);
    } else {
      // escalate: same step number, new approver (spec'd target, else the
      // overdue approver's own manager); falls back to skipping forward.
      let target: ResolvedApprover | null = null;
      if (spec?.escalateTo) {
        target = await resolveApprover(db, spec.escalateTo, row.subject_employee_id);
      } else {
        const approverEmployee = await db
          .selectFrom('core.users')
          .select('employee_id')
          .where('id', '=', row.approver_user_id)
          .executeTakeFirst();
        if (approverEmployee?.employee_id !== null && approverEmployee?.employee_id !== undefined) {
          const manager = await db
            .selectFrom('core.employees')
            .select('reporting_manager_id')
            .where('id', '=', approverEmployee.employee_id)
            .executeTakeFirst();
          if (manager?.reporting_manager_id !== null && manager?.reporting_manager_id !== undefined) {
            const managerUser = await db
              .selectFrom('core.users')
              .select('id')
              .where('employee_id', '=', manager.reporting_manager_id)
              .where('is_active', '=', true)
              .executeTakeFirst();
            if (managerUser) target = { userId: managerUser.id, delegatedFrom: null };
          }
        }
      }
      if (target) {
        await openStep(db, row.request_id, row.step_no, target, spec?.slaHours ?? 48, row.definition_code);
      } else {
        await advance(db, { id: row.request_id, definition_code: row.definition_code, subject_employee_id: row.subject_employee_id }, row.step_no);
      }
    }
    handled += 1;
  }
  return handled;
}

/** Everything waiting on ME — the approvals inbox (05 §3). */
export async function inbox(db: Kysely<Database>, userId: number) {
  return db
    .selectFrom('wf.request_steps as s')
    .innerJoin('wf.requests as r', 'r.id', 's.request_id')
    .innerJoin('wf.definitions as d', 'd.code', 'r.definition_code')
    .innerJoin('core.employees as e', 'e.id', 'r.subject_employee_id')
    .where('s.approver_user_id', '=', userId)
    .where('s.action', 'is', null)
    .where('r.status', '=', 'pending')
    .select([
      'r.id as request_id',
      'd.code as definition_code',
      'd.name as definition_name',
      'e.ecode as subject_ecode',
      'e.first_name as subject_first_name',
      'e.last_name as subject_last_name',
      'r.payload',
      's.step_no',
      's.notified_at',
      's.sla_due_at',
      's.delegated_from',
    ])
    .orderBy('s.sla_due_at')
    .execute();
}

/** The request timeline (WF-04) — every touch with its receipts. */
export async function timeline(db: Kysely<Database>, requestId: number) {
  return db
    .selectFrom('wf.request_steps')
    .selectAll()
    .where('request_id', '=', requestId)
    .orderBy('id')
    .execute();
}
