/** WF-01/02: open, notify and advance a round without treating vacancy as consent. */
import { sql } from 'kysely';
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
  if (adminRef?.trim()) {
    const trimmed = adminRef.trim();
    const adminEmp = await db
      .selectFrom('core.employees')
      .select('id')
      .where((eb) => eb.or([eb('ecode', '=', trimmed), eb('id', '=', Number(trimmed) || 0)]))
      .executeTakeFirst();
    if (adminEmp?.id === employeeId) return true;
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

  // Duplicate collapse must only consider approvals from the CURRENT round.
  // A send_back + resubmit starts a fresh approval chain (doc 11 §4b/§5), so
  // approvals from a superseded round must NOT skip their approver this time —
  // otherwise an edited request silently bypasses everyone who approved the
  // previous version (e.g. RM approves ₹10k, HOD sends back, employee resubmits
  // ₹100k, RM is never asked again). The last `sent_back` marks the boundary.
  const boundaryRow = await db
    .selectFrom('wf.request_steps')
    .select(sql<number>`coalesce(max(id), 0)`.as('round_start'))
    .where('request_id', '=', request.id)
    .where('action', '=', 'sent_back')
    .executeTakeFirst();
  const roundStartId = boundaryRow?.round_start ?? 0;

  const vacant: StepSpec[] = [];
  const collapsed: { step: number; userId: number; approver: string }[] = [];
  const auditVacancies = async () => {
    for (const item of collapsed) await writeAudit(db, { action: 'update', entity: 'wf.requests', entityId: request.id,
      field: `step_${item.step}`, newValue: `collapsed — approver #${item.userId} ('${item.approver}') already approved in prior step` });
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
        .where('id', '>', roundStartId)
        .execute();
      if (priorApproved.some((s) => s.approver_user_id === approver.userId)) {
        collapsed.push({ step: spec.step, userId: approver.userId, approver: spec.approver });
        continue;
      }

      await db.updateTable('wf.requests').set({ current_step: spec.step }).where('id', '=', request.id).execute();
      await openStep(db, request.id, spec.step, spec.approver, approver, spec.slaHours, request.definition_code);
      await auditVacancies();
      return;
    }
    vacant.push(spec);
  }

  // Vacancy is not consent. An all-vacant first round, and a later round whose
  // remaining approvers are all missing, stay pending for HR. A round that only
  // collapsed duplicate approvers (they already approved) may still complete.
  if (vacant.length > 0) {
    await auditVacancies();
    const heldBecause = fromStepNo === 0
      ? 'Held for HR: all configured approvers are missing or inactive'
      : 'Held for HR: every remaining approver is missing or inactive';
    await db.updateTable('wf.requests').set({ status: 'pending', decided_at: null })
      .where('id', '=', request.id).execute();
    await writeAudit(db, { action: 'update', entity: 'wf.requests', entityId: request.id,
      subjectEmployeeId: request.subject_employee_id, field: 'routing_hold',
      newValue: heldBecause });
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
  await writeAudit(db, { action: 'approve', entity: 'wf.requests', entityId: request.id,
    subjectEmployeeId: request.subject_employee_id, newValue: 'All steps approved' });
  await auditVacancies();
}

