/** WF-01/02: open, notify and advance a round without treating vacancy as consent. */
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { Database, WfRequestsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { enqueue, enqueueEvent } from '../notifications/index.js';
import { resolveApprover, type ResolvedApprover } from './workflow-approvers.js';
import { getSteps, type StepSpec } from './workflow-definition.js';
import { fireFinalHooks } from './workflow-hooks.js';
import { getTypedSetting } from '../settings/index.js';
type Db = Kysely<Database> | Transaction<Database>;
type RequestRow = Selectable<WfRequestsTable>;

async function isDesignatedTravelAdmin(db: Db, userId: number, employeeId: number): Promise<boolean> {
  const adminRef = await getTypedSetting<string | null>(db, 'te.admin_employee_id', 'string', null);
  if (adminRef && adminRef.trim()) {
    const trimmed = adminRef.trim();
    const adminEmp = await db
      .selectFrom('core.employees')
      .select('id')
      .where((eb) => eb.or([eb('ecode', '=', trimmed), eb('id', '=', Number(trimmed) || 0)]))
      .executeTakeFirst();
    if (adminEmp && adminEmp.id === employeeId) return true;
  }
  const adminRole = await db
    .selectFrom('core.user_roles as ur')
    .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
    .where('ur.user_id', '=', userId)
    .where('r.code', 'in', ['super_admin', 'hr_head'])
    .select('r.id')
    .executeTakeFirst();
  return Boolean(adminRole);
}

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
  // EMS Rule: Admin's own claim / budget request auto-approves immediately on submit
  if (fromStepNo === 0 && request.definition_code.startsWith('travel_')) {
    const requesterRow = await db
      .selectFrom('wf.requests')
      .select(['requested_by', 'subject_employee_id'])
      .where('id', '=', request.id)
      .executeTakeFirst();
    if (requesterRow) {
      const isAdmin = await isDesignatedTravelAdmin(db, requesterRow.requested_by, requesterRow.subject_employee_id);
      if (isAdmin) {
        await db.updateTable('wf.requests').set({ status: 'approved', decided_at: new Date() }).where('id', '=', request.id).execute();
        await writeAudit(db, {
          action: 'approve',
          entity: 'wf.requests',
          entityId: request.id,
          subjectEmployeeId: request.subject_employee_id,
          newValue: 'Auto-approved: submitter is the designated Travel/Org Administrator',
        });
        await enqueue(db, {
          recipientUserId: requesterRow.requested_by,
          channel: 'in_app',
          templateCode: 'request_approved',
          payload: { requestId: request.id },
        });
        await fireFinalHooks(db, request.id, 'approved');
        return;
      }
    }
  }

  const steps = await getSteps(db, request.definition_code);

  const vacant: StepSpec[] = [];
  const auditVacancies = async () => {
    for (const spec of vacant) await writeAudit(db, { action: 'update', entity: 'wf.requests', entityId: request.id,
      field: `step_${spec.step}`, newValue: `skipped — approver '${spec.approver}' vacant` });
  };

  for (const spec of steps.filter((s) => s.step > fromStepNo).sort((a, b) => a.step - b.step)) {
    const approver = await resolveApprover(db, spec.approver, request.subject_employee_id, request.definition_code, request.id);
    if (approver) {
      // EMS Rule: duplicates collapse (if RM and HOD are the same person, it becomes one step)
      const priorApproved = await db
        .selectFrom('wf.request_steps')
        .select(['approver_user_id', 'action'])
        .where('request_id', '=', request.id)
        .where('action', '=', 'approved')
        .execute();
      if (priorApproved.some((s) => s.approver_user_id === approver.userId)) {
        await writeAudit(db, {
          action: 'update',
          entity: 'wf.requests',
          entityId: request.id,
          field: `step_${spec.step}`,
          newValue: `collapsed — approver #${approver.userId} ('${spec.approver}') already approved in prior step`,
        });
        continue;
      }

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
  await writeAudit(db, { action: 'approve', entity: 'wf.requests', entityId: request.id,
    subjectEmployeeId: request.subject_employee_id, newValue: 'All steps approved' });
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

