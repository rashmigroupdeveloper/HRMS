/**
 * The generic approval engine (WF-01..04, doc 11 §4b send_back):
 *   create → resolve approver (RM | functional manager | role | user, with
 *   out-of-office delegation) → NOTIFY (receipt is structural: the step row
 *   cannot exist without notified_at) → act (approve / reject / send_back)
 *   → advance or complete. Vacant approvers are auto-skipped WITH an audit
 *   trail. SLA breaches escalate / auto-reject / lapse / auto-approve.
 *
 * Correctness guarantees (Phase-1 review):
 *  - Every mutating flow (create / act / resubmit / escalate) runs in ONE
 *    transaction, so a mid-sequence failure never strands a request (F5).
 *  - act() locks the open step FOR UPDATE and the DB enforces at most one open
 *    step per request, so concurrent approvals cannot fork the chain (F4).
 *  - A `role:` step is a QUEUE: any active holder of the role may act, and it
 *    appears in every holder's inbox — not just the lowest-id user (F8).
 */
import { z } from 'zod';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { Database, WfRequestsTable, WfRequestStepsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { enqueue } from '../notifications/index.js';
import { workflowPermissionSql, workflowRoleSql } from './workflow-access.js';
import { resolveApprover, canActOnStep, type ResolvedApprover } from './workflow-approvers.js';
import { fireFinalHooks, prepareResubmission } from './workflow-hooks.js';
export { onWorkflowFinal, clearWorkflowFinalHooks, onWorkflowResubmit } from './workflow-hooks.js';
export type { WorkflowFinalStatus } from './workflow-hooks.js';

type Db = Kysely<Database> | Transaction<Database>;

/** Schema-level default when a chain omits slaHours; the real SLA is per-step
 *  chain DATA (editable via the definitions API). */
const DEFAULT_STEP_SLA_HOURS = 48;

export const stepSpecSchema = z.object({
  step: z.number().int().positive(),
  /** 'reporting_manager' | 'functional_manager' | 'role:<code>' | 'user:<id>' */
  approver: z.string().min(1),
  slaHours: z.number().positive().default(DEFAULT_STEP_SLA_HOURS),
  onBreach: z.enum(['escalate', 'auto_reject', 'lapse', 'auto_approve']).default('escalate'),
  /** approver spec for escalation target; default = approver's own manager. */
  escalateTo: z.string().min(1).optional(),
});
export type StepSpec = z.infer<typeof stepSpecSchema>;
export const stepsSchema = z.array(stepSpecSchema).min(1);

export type RequestRow = Selectable<WfRequestsTable>;
export type StepRow = Selectable<WfRequestStepsTable>;

async function getSteps(db: Db, definitionCode: string): Promise<StepSpec[]> {
  const def = await db.selectFrom('wf.definitions').select(['steps', 'is_active']).where('code', '=', definitionCode).executeTakeFirst();
  if (def?.is_active !== true) throw new Error(`Unknown or inactive workflow: ${definitionCode}`);
  return stepsSchema.parse(def.steps);
}

/** Insert the open step, THEN notify (both inside the caller's transaction, so
 *  they commit or roll back together — the PP-14 receipt is atomic). */
async function openStep(
  db: Db,
  requestId: number,
  stepNo: number,
  spec: string,
  approver: ResolvedApprover,
  slaHours: number,
  definitionCode: string,
): Promise<void> {
  const now = new Date();
  await db
    .insertInto('wf.request_steps')
    .values({
      request_id: requestId,
      step_no: stepNo,
      approver_user_id: approver.userId,
      approver_spec: spec,
      delegated_from: approver.delegatedFrom,
      notified_at: now,
      sla_due_at: new Date(now.getTime() + slaHours * 3600_000),
    })
    .execute();
  await enqueue(db, {
    recipientUserId: approver.userId,
    channel: 'in_app',
    templateCode: 'approval_pending',
    payload: { requestId, definitionCode, stepNo },
  });
}

/** Open the next resolvable step after `fromStepNo`; vacant approvers auto-skip
 *  with audit; running out of steps completes the request as approved. */
async function advance(db: Db, request: Pick<RequestRow, 'id' | 'definition_code' | 'subject_employee_id'>, fromStepNo: number): Promise<void> {
  const steps = await getSteps(db, request.definition_code);

  for (const spec of steps.filter((s) => s.step > fromStepNo).sort((a, b) => a.step - b.step)) {
    const approver = await resolveApprover(db, spec.approver, request.subject_employee_id, request.definition_code);
    if (approver) {
      await db.updateTable('wf.requests').set({ current_step: spec.step }).where('id', '=', request.id).execute();
      await openStep(db, request.id, spec.step, spec.approver, approver, spec.slaHours, request.definition_code);
      return;
    }
    await writeAudit(db, {
      action: 'update',
      entity: 'wf.requests',
      entityId: request.id,
      field: `step_${spec.step}`,
      newValue: `skipped — approver '${spec.approver}' vacant`,
    });
  }

  await db.updateTable('wf.requests').set({ status: 'approved', decided_at: new Date() }).where('id', '=', request.id).execute();
  const requester = await db.selectFrom('wf.requests').select('requested_by').where('id', '=', request.id).executeTakeFirstOrThrow();
  await enqueue(db, {
    recipientUserId: requester.requested_by,
    channel: 'in_app',
    templateCode: 'request_approved',
    payload: { requestId: request.id },
  });
  await fireFinalHooks(db, request.id, 'approved');
}

export async function createRequest(
  db: Kysely<Database>,
  params: { definitionCode: string; subjectEmployeeId: number; requestedByUserId: number; payload: Record<string, unknown> },
  /** Runs inside the same transaction AFTER the request row exists but BEFORE
   *  the chain advances — the place to insert the domain row (regularization,
   *  OT entry) so a vacant-chain auto-approval's completion hook can see it. */
  attach?: (trx: Db, requestId: number) => Promise<void>,
): Promise<number> {
  await getSteps(db, params.definitionCode); // validate existence + shape before opening a tx

  return db.transaction().execute(async (trx) => {
    const request = await trx
      .insertInto('wf.requests')
      .values({
        definition_code: params.definitionCode,
        subject_employee_id: params.subjectEmployeeId,
        requested_by: params.requestedByUserId,
        payload: JSON.stringify(params.payload),
      })
      .returning(['id', 'definition_code', 'subject_employee_id'])
      .executeTakeFirstOrThrow();
    if (attach) await attach(trx, request.id);
    await advance(trx, request, 0);
    return request.id;
  });
}

export type ActOutcome = 'advanced' | 'approved' | 'rejected' | 'sent_back';

export async function act(
  db: Kysely<Database>,
  params: { requestId: number; actorUserId: number; action: 'approve' | 'reject' | 'send_back'; comment?: string | undefined },
): Promise<ActOutcome> {
  if (params.action !== 'approve' && !params.comment?.trim()) {
    throw new Error('A decision reason is required when rejecting or sending back');
  }
  return db.transaction().execute(async (trx) => {
    const request = await trx.selectFrom('wf.requests').selectAll().where('id', '=', params.requestId).executeTakeFirstOrThrow();
    if (request.status !== 'pending') throw new Error(`Request is ${request.status}, not actionable`);

    // Lock the open step; a concurrent act() blocks here and then finds no open
    // step (action set) → clean serialization, no forked chain (review F4).
    const step = await trx
      .selectFrom('wf.request_steps')
      .selectAll()
      .where('request_id', '=', params.requestId)
      .where('action', 'is', null)
      .orderBy('id', 'desc')
      .forUpdate()
      .executeTakeFirst();
    if (!step) throw new Error('No pending step');
    if (!(await canActOnStep(trx, step, params.actorUserId, request))) {
      throw new Error('Not the current approver'); // routers map this to FORBIDDEN
    }

    const actionMap = { approve: 'approved', reject: 'rejected', send_back: 'sent_back' } as const;
    await trx
      .updateTable('wf.request_steps')
      .set({ action: actionMap[params.action], comment: params.comment ?? null, acted_at: new Date(), approver_user_id: params.actorUserId })
      .where('id', '=', step.id)
      .where('action', 'is', null)
      .execute();
    await writeAudit(trx, {
      actorUserId: params.actorUserId,
      action: params.action,
      entity: 'wf.requests',
      entityId: params.requestId,
      field: `step_${step.step_no}`,
      newValue: params.comment ?? null,
    });

    if (params.action === 'approve') {
      await advance(trx, request, step.step_no);
      const after = await trx.selectFrom('wf.requests').select('status').where('id', '=', params.requestId).executeTakeFirstOrThrow();
      return after.status === 'approved' ? 'approved' : 'advanced';
    }

    const status = params.action === 'reject' ? 'rejected' : 'sent_back';
    await trx
      .updateTable('wf.requests')
      .set({ status, decided_at: params.action === 'reject' ? new Date() : null })
      .where('id', '=', params.requestId)
      .execute();
    await enqueue(trx, {
      recipientUserId: request.requested_by,
      channel: 'in_app',
      templateCode: params.action === 'reject' ? 'request_rejected' : 'request_sent_back',
      payload: { requestId: params.requestId, comment: params.comment ?? null },
    });
    if (status === 'rejected') await fireFinalHooks(trx, params.requestId, 'rejected');
    return status === 'rejected' ? 'rejected' : 'sent_back';
  });
}

/** After send_back: requester edits and the chain restarts from step 1 (doc 11 §4b). */
export async function resubmit(
  db: Kysely<Database>,
  params: { requestId: number; requesterUserId: number; payload: Record<string, unknown> },
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const request = await trx.selectFrom('wf.requests').selectAll().where('id', '=', params.requestId).forUpdate().executeTakeFirstOrThrow();
    if (request.status !== 'sent_back') throw new Error('Only sent-back requests can be resubmitted');
    if (request.requested_by !== params.requesterUserId) throw new Error('Only the requester can resubmit');

    const payload = await prepareResubmission(trx, request, params.payload);
    await writeAudit(trx, { actorUserId: params.requesterUserId, action: 'update', entity: 'wf.requests',
      entityId: request.id, field: 'resubmit', newValue: 'Domain request revalidated; approval chain restarted' });
    await trx
      .updateTable('wf.requests')
      .set({ payload: JSON.stringify(payload), status: 'pending', current_step: 1 })
      .where('id', '=', params.requestId)
      .execute();
    await advance(trx, request, 0);
  });
}

/** SLA sweep (hourly job — WF-03). Each overdue step handled in its own
 *  transaction so one failure doesn't abort the whole sweep. */
export async function runEscalations(db: Kysely<Database>, asOf = new Date()): Promise<number> {
  const overdue = await db
    .selectFrom('wf.request_steps as s')
    .innerJoin('wf.requests as r', 'r.id', 's.request_id')
    .where('s.action', 'is', null)
    .where('s.sla_due_at', '<', asOf)
    .where('r.status', '=', 'pending')
    .select(['s.id as step_id', 's.step_no', 's.approver_user_id', 'r.id as request_id', 'r.definition_code', 'r.subject_employee_id', 'r.requested_by'])
    .execute();

  const definitionCache = new Map<string, StepSpec[]>();
  async function specsFor(code: string): Promise<StepSpec[]> {
    const hit = definitionCache.get(code);
    if (hit) return hit;
    const s = await getSteps(db, code);
    definitionCache.set(code, s);
    return s;
  }

  let handled = 0;
  for (const row of overdue) {
    const steps = await specsFor(row.definition_code);
    const spec = steps.find((s) => s.step === row.step_no);
    const onBreach = spec?.onBreach ?? 'escalate';

    await db.transaction().execute(async (trx) => {
      // Re-check the step is still open under the row lock (it may have been
      // acted on between the scan and now).
      const still = await trx
        .selectFrom('wf.request_steps')
        .selectAll()
        .where('id', '=', row.step_id)
        .where('action', 'is', null)
        .forUpdate()
        .executeTakeFirst();
      if (!still) return;

      await trx
        .updateTable('wf.request_steps')
        .set({ action: 'escalated', acted_at: asOf, comment: `SLA breached → ${onBreach}` })
        .where('id', '=', row.step_id)
        .execute();
      await writeAudit(trx, {
        action: 'update',
        entity: 'wf.requests',
        entityId: row.request_id,
        field: `step_${row.step_no}`,
        newValue: `SLA breach → ${onBreach}`,
      });

      if (onBreach === 'auto_reject' || onBreach === 'lapse') {
        const status = onBreach === 'auto_reject' ? 'rejected' : 'lapsed';
        await trx.updateTable('wf.requests').set({ status, decided_at: asOf }).where('id', '=', row.request_id).execute();
        await enqueue(trx, { recipientUserId: row.requested_by, channel: 'in_app', templateCode: `request_${status}`, payload: { requestId: row.request_id } });
        await fireFinalHooks(trx, row.request_id, status);
        return;
      }
      if (onBreach === 'auto_approve') {
        await advance(trx, { id: row.request_id, definition_code: row.definition_code, subject_employee_id: row.subject_employee_id }, row.step_no);
        return;
      }

      // escalate: spec'd target, else the overdue approver's own reporting
      // manager — resolved through resolveApprover so DELEGATION still applies.
      let target: ResolvedApprover | null = null;
      if (spec?.escalateTo) {
        target = await resolveApprover(trx, spec.escalateTo, row.subject_employee_id, row.definition_code);
      } else {
        const approver = await trx.selectFrom('core.users').select('employee_id').where('id', '=', row.approver_user_id).executeTakeFirst();
        if (approver && approver.employee_id !== null) {
          target = await resolveApprover(trx, 'reporting_manager', approver.employee_id, row.definition_code);
        }
      }
      const escalateSpec = spec?.escalateTo ?? 'reporting_manager';
      if (target) {
        await openStep(trx, row.request_id, row.step_no, escalateSpec, target, spec?.slaHours ?? DEFAULT_STEP_SLA_HOURS, row.definition_code);
      } else {
        // Missing escalation routing is not consent. Keep the decision pending
        // and re-notify the existing approver using the configured SLA.
        await openStep(trx, row.request_id, row.step_no, still.approver_spec ?? spec?.approver ?? 'reporting_manager',
          { userId: still.approver_user_id, delegatedFrom: still.delegated_from },
          spec?.slaHours ?? DEFAULT_STEP_SLA_HOURS, row.definition_code);
        await writeAudit(trx, { action: 'update', entity: 'wf.requests', entityId: row.request_id,
          field: 'escalation_target_missing', newValue: 'Existing approver re-notified; request remains pending' });
      }
    });
    handled += 1;
  }
  return handled;
}

/** Everything waiting on ME — the approvals inbox (05 §3). Includes role-queue
 *  steps for every role I hold, not just steps addressed to me by name. */
export async function inbox(db: Kysely<Database>, userId: number) {
  return db
    .selectFrom('wf.request_steps as s')
    .innerJoin('wf.requests as r', 'r.id', 's.request_id')
    .innerJoin('wf.definitions as d', 'd.code', 'r.definition_code')
    .innerJoin('core.employees as e', 'e.id', 'r.subject_employee_id')
    .where('s.action', 'is', null)
    .where('r.status', '=', 'pending')
    .where(sql<boolean>`(
      (s.approver_user_id = ${userId}
        AND ${workflowPermissionSql(sql<number>`coalesce(s.delegated_from, ${userId})`, sql.ref<string>('r.definition_code'), sql.ref<number>('r.subject_employee_id'))}
        AND (coalesce(s.approver_spec, '') NOT LIKE 'role:%' OR ${workflowRoleSql(sql<number>`coalesce(s.delegated_from, ${userId})`, sql.ref<string>('s.approver_spec'), sql.ref<string>('r.definition_code'), sql.ref<number>('r.subject_employee_id'))}))
      OR ${workflowRoleSql(userId, sql.ref<string>('s.approver_spec'), sql.ref<string>('r.definition_code'), sql.ref<number>('r.subject_employee_id'))}
    )`)
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
  return db.selectFrom('wf.request_steps').selectAll().where('request_id', '=', requestId).orderBy('id').execute();
}
