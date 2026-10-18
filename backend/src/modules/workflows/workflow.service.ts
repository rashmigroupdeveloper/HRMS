/**
 * The generic approval engine (WF-01..04, doc 11 §4b send_back):
 *   create → resolve approver (RM | functional manager | role | user, with
 *   out-of-office delegation) → NOTIFY (receipt is structural: the step row
 *   cannot exist without notified_at) → act (approve / reject / send_back)
 *   → advance or complete. Vacant steps are skipped with audit; an all-vacant round is held
 *   for HR routing repair (sponsor, 16 Oct 2026). SLA breaches escalate / auto-reject / lapse / auto-approve.
 *
 * Correctness guarantees (Phase-1 review):
 *  - Every mutating flow (create / act / resubmit / escalate) runs in ONE
 *    transaction, so a mid-sequence failure never strands a request (F5).
 *  - act() locks the open step FOR UPDATE and the DB enforces at most one open
 *    step per request, so concurrent approvals cannot fork the chain (F4).
 *  - A `role:` step is a QUEUE: any active holder of the role may act, and it
 *    appears in every holder's inbox — not just the lowest-id user (F8).
 */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { Database, WfRequestsTable, WfRequestStepsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { logger } from '../../core/logger.js';
import { ForbiddenError } from '../../core/errors/index.js';
import { enqueue } from '../notifications/index.js';
import { workflowPermissionSql, workflowRoleSql } from './workflow-access.js';
import { resolveApprover, canActOnStep, type ResolvedApprover } from './workflow-approvers.js';
import { DEFAULT_STEP_SLA_HOURS, getSteps, type StepSpec } from './workflow-definition.js';
import { advance, openStep } from './workflow-routing.js';
import { lockWorkflowRequest, lockWorkflowSubject } from './workflow-locks.js';
import { expireRoutingHolds } from './workflow-holds.service.js';
export { stepsSchema } from './workflow-definition.js';
export type { StepSpec } from './workflow-definition.js';
import { fireFinalHooks, prepareResubmission } from './workflow-hooks.js';
import { inTransaction } from '../../core/db/database.js';
export { onWorkflowFinal, clearWorkflowFinalHooks, onWorkflowResubmit } from './workflow-hooks.js';
export type { WorkflowFinalStatus } from './workflow-hooks.js';

type Db = Kysely<Database> | Transaction<Database>;

export type RequestRow = Selectable<WfRequestsTable>;
export type StepRow = Selectable<WfRequestStepsTable>;

export async function createRequest(
  db: Kysely<Database>,
  params: { definitionCode: string; subjectEmployeeId: number; requestedByUserId: number; payload: Record<string, unknown> },
  /** Attach the authoritative domain row inside the creation transaction,
   * before routing; a held request retains this row without final effects. */
  attach?: (trx: Db, requestId: number) => Promise<void>,
): Promise<number> {
  await getSteps(db, params.definitionCode); // validate existence + shape before opening a tx

  return inTransaction(db, async (trx) => {
    await lockWorkflowSubject(trx, params.subjectEmployeeId);
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
  return inTransaction(db, async (trx) => {
    const request = await lockWorkflowRequest(trx, params.requestId);
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
    // C-07 / B-03: segregation of duties — nobody decides a request about
    // themselves, whatever route (delegation, role queue) put it in front of them.
    const actor = await trx.selectFrom('core.users').select('employee_id').where('id', '=', params.actorUserId).executeTakeFirst();
    if (actor?.employee_id !== null && actor?.employee_id === request.subject_employee_id) {
      throw new ForbiddenError('You cannot approve or reject your own request');
    }
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
    const auditDecision = () => writeAudit(trx, {
      actorUserId: params.actorUserId,
      action: params.action,
      entity: 'wf.requests',
      entityId: params.requestId,
      field: `step_${step.step_no}`,
      newValue: params.comment ?? null,
    });

    if (params.action === 'approve') {
      await advance(trx, request, step.step_no);
      await auditDecision();
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
    await auditDecision();
    return status === 'rejected' ? 'rejected' : 'sent_back';
  });
}

/** Requester withdrawal (or domain cancellation) of a request that has not
 *  reached a final decision. Closes the open step so it leaves every inbox. */
export async function cancelRequest(
  db: Db,
  params: { requestId: number; actorUserId: number; reason: string },
): Promise<void> {
  const request = await lockWorkflowRequest(db, params.requestId);
  if (request.status !== 'pending' && request.status !== 'sent_back') {
    throw new Error(`Request is ${request.status}, it can no longer be withdrawn`);
  }
  await db
    .updateTable('wf.request_steps')
    .set({ action: 'skipped', comment: `Withdrawn: ${params.reason}`, acted_at: new Date() })
    .where('request_id', '=', params.requestId)
    .where('action', 'is', null)
    .execute();
  await db
    .updateTable('wf.requests')
    .set({ status: 'cancelled', decided_at: new Date() })
    .where('id', '=', params.requestId)
    .execute();
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'cancel',
    entity: 'wf.requests',
    entityId: params.requestId,
    newValue: params.reason,
  });
}

/** After send_back: requester edits and the chain restarts from step 1 (doc 11 §4b). */
export async function resubmit(
  db: Kysely<Database>,
  params: { requestId: number; requesterUserId: number; payload: Record<string, unknown> },
): Promise<void> {
  await inTransaction(db, async (trx) => {
    const request = await lockWorkflowRequest(trx, params.requestId);
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
  const expiredHolds = await expireRoutingHolds(db, asOf);
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

  let handled = expiredHolds;
  for (const row of overdue) {
    try {
      const steps = await specsFor(row.definition_code);
      const spec = steps.find((s) => s.step === row.step_no);
      const onBreach = spec?.onBreach ?? 'escalate';

      await inTransaction(db, async (trx) => {
        const request = await lockWorkflowRequest(trx, row.request_id);
        if (request.status !== 'pending') return;
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
        const auditBreach = () => writeAudit(trx, {
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
          await auditBreach();
          return;
        }
        if (onBreach === 'auto_approve') {
          await advance(trx, { id: row.request_id, definition_code: row.definition_code, subject_employee_id: row.subject_employee_id }, row.step_no);
          await auditBreach();
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
        await auditBreach();
      });
      handled += 1;
    } catch (cause) {
      // A malformed/blocked request cannot stop unrelated valid SLA decisions.
      // Keep its transaction rolled back, log identifiers only, and let HR repair it.
      logger.error({ requestId: row.request_id, definitionCode: row.definition_code,
        errorType: cause instanceof Error ? cause.name : 'UnknownError' },
      'Workflow escalation failed; request remains pending and needs HR routing review');
    }
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
    // Never show me a request about myself (SoD, C-07).
    .where(sql<boolean>`NOT EXISTS (SELECT 1 FROM core.users me WHERE me.id = ${userId} AND me.employee_id = r.subject_employee_id)`)
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
