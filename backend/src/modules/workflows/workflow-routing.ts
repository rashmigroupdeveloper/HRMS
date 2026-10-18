/** WF-01/02: open, notify and advance a round without treating vacancy as consent. */
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { Database, WfRequestsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { enqueue, enqueueEvent } from '../notifications/index.js';
import { resolveApprover, type ResolvedApprover } from './workflow-approvers.js';
import { getSteps, type StepSpec } from './workflow-definition.js';
import { fireFinalHooks } from './workflow-hooks.js';
type Db = Kysely<Database> | Transaction<Database>;
type RequestRow = Selectable<WfRequestsTable>;

/** Insert the open step, THEN notify (both inside the caller's transaction, so
 *  they commit or roll back together — the PP-14 receipt is atomic). */
export async function openStep(
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

/** Open the next resolvable step after `fromStepNo`; vacant approvers skip
 * with audit. If nobody resolved at the start of a round, hold for HR. */
export async function advance(db: Db, request: Pick<RequestRow, 'id' | 'definition_code' | 'subject_employee_id'>, fromStepNo: number): Promise<void> {
  const steps = await getSteps(db, request.definition_code);

  const vacant: StepSpec[] = [];
  const auditVacancies = async () => {
    for (const spec of vacant) await writeAudit(db, { action: 'update', entity: 'wf.requests', entityId: request.id,
      field: `step_${spec.step}`, newValue: `skipped — approver '${spec.approver}' vacant` });
  };

  for (const spec of steps.filter((s) => s.step > fromStepNo).sort((a, b) => a.step - b.step)) {
    const approver = await resolveApprover(db, spec.approver, request.subject_employee_id, request.definition_code);
    if (approver) {
      await db.updateTable('wf.requests').set({ current_step: spec.step }).where('id', '=', request.id).execute();
      await openStep(db, request.id, spec.step, spec.approver, approver, spec.slaHours, request.definition_code);
      await auditVacancies();
      return;
    }
    vacant.push(spec);
  }

  if (fromStepNo === 0) {
    await auditVacancies();
    // Sponsor decision, 16 Oct 2026: an all-vacant round is not consent.
    // No invented approver/receipt or domain finalization; HR repairs routing.
    await db.updateTable('wf.requests').set({ status: 'pending', decided_at: null })
      .where('id', '=', request.id).execute();
    await writeAudit(db, { action: 'update', entity: 'wf.requests', entityId: request.id,
      subjectEmployeeId: request.subject_employee_id, field: 'routing_hold',
      newValue: 'Held for HR: all configured approvers are missing or inactive' });
    await enqueueEvent(db, 'workflow.routing_held', 'workflow_routing_held', {
      requestId: request.id, definitionCode: request.definition_code,
      subjectEmployeeId: request.subject_employee_id,
    });
    const requester = await db.selectFrom('wf.requests').select('requested_by')
      .where('id', '=', request.id).executeTakeFirstOrThrow();
    await enqueue(db, { recipientUserId: requester.requested_by, channel: 'in_app',
      templateCode: 'request_routing_held', payload: { requestId: request.id,
        message: 'Waiting for HR to restore the approval routing. Your request is not approved.' } });
    return;
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
  await auditVacancies();
}

