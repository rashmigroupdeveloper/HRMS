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
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { Database, WfRequestsTable, WfRequestStepsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { enqueue } from '../notifications/index.js';
import { getUserRoleCodes } from '../../core/rbac/permissions.service.js';
import { istDateString } from '../../core/dates.js';

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

/**
 * COMPLETION HOOKS — how domain modules react to a request reaching a final
 * state WITHOUT the workflows module importing them (no dependency cycle):
 * the domain registers `onWorkflowFinal('regularization', handler)` at app
 * wiring time; the engine fires the handler inside the SAME transaction that
 * finalized the request, so domain side-effects are atomic with the decision.
 */
export type WorkflowFinalStatus = 'approved' | 'rejected' | 'lapsed';
export type WorkflowFinalHook = (db: Db, request: RequestRow, status: WorkflowFinalStatus) => Promise<void>;

const finalHooks = new Map<string, WorkflowFinalHook[]>();

export function onWorkflowFinal(definitionCode: string, hook: WorkflowFinalHook): void {
  const list = finalHooks.get(definitionCode) ?? [];
  list.push(hook);
  finalHooks.set(definitionCode, list);
}

/** Test/bootstrap helper: clears registered hooks (idempotent re-registration). */
export function clearWorkflowFinalHooks(): void {
  finalHooks.clear();
}

async function fireFinalHooks(db: Db, requestId: number, status: WorkflowFinalStatus): Promise<void> {
  const request = await db.selectFrom('wf.requests').selectAll().where('id', '=', requestId).executeTakeFirst();
  if (!request) return;
  for (const hook of finalHooks.get(request.definition_code) ?? []) {
    await hook(db, request, status);
  }
}

interface ResolvedApprover {
  userId: number;
  delegatedFrom: number | null;
}

/** Spec → the canonical ACTIVE recipient, with delegation applied. Null = vacant.
 *  For `role:` this is the deterministic first holder who is NOTIFIED; any
 *  holder may still act (see canActOnStep / inbox). */
async function resolveApprover(db: Db, spec: string, subjectEmployeeId: number): Promise<ResolvedApprover | null> {
  let userId: number | null = null;

  if (spec === 'reporting_manager' || spec === 'functional_manager') {
    const col = spec === 'reporting_manager' ? 'reporting_manager_id' : 'functional_manager_id';
    const subject = await db.selectFrom('core.employees').select([col]).where('id', '=', subjectEmployeeId).executeTakeFirst();
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
      .executeTakeFirst();
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

  // Out-of-office delegation (WF-01): active IST-calendar window today.
  const today = istDateString();
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

/** May this actor act on this step? The named approver, or (role queue) any
 *  active holder of the step's role. */
async function canActOnStep(db: Db, step: Pick<StepRow, 'approver_user_id' | 'approver_spec'>, actorUserId: number): Promise<boolean> {
  if (step.approver_user_id === actorUserId) return true;
  if (step.approver_spec?.startsWith('role:')) {
    const roleCode = step.approver_spec.slice('role:'.length);
    const roles = await getUserRoleCodes(db, actorUserId);
    return roles.has(roleCode);
  }
  return false;
}

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
    const approver = await resolveApprover(db, spec.approver, request.subject_employee_id);
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
    if (!(await canActOnStep(trx, step, params.actorUserId))) {
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

    await trx
      .updateTable('wf.requests')
      .set({ payload: JSON.stringify(params.payload), status: 'pending', current_step: 1 })
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
        .select('id')
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
        target = await resolveApprover(trx, spec.escalateTo, row.subject_employee_id);
      } else {
        const approver = await trx.selectFrom('core.users').select('employee_id').where('id', '=', row.approver_user_id).executeTakeFirst();
        if (approver && approver.employee_id !== null) {
          target = await resolveApprover(trx, 'reporting_manager', approver.employee_id);
        }
      }
      const escalateSpec = spec?.escalateTo ?? 'reporting_manager';
      if (target) {
        await openStep(trx, row.request_id, row.step_no, escalateSpec, target, spec?.slaHours ?? DEFAULT_STEP_SLA_HOURS, row.definition_code);
      } else {
        await advance(trx, { id: row.request_id, definition_code: row.definition_code, subject_employee_id: row.subject_employee_id }, row.step_no);
      }
    });
    handled += 1;
  }
  return handled;
}

/** Everything waiting on ME — the approvals inbox (05 §3). Includes role-queue
 *  steps for every role I hold, not just steps addressed to me by name. */
export async function inbox(db: Kysely<Database>, userId: number) {
  const roleSpecs = [...(await getUserRoleCodes(db, userId))].map((code) => `role:${code}`);

  return db
    .selectFrom('wf.request_steps as s')
    .innerJoin('wf.requests as r', 'r.id', 's.request_id')
    .innerJoin('wf.definitions as d', 'd.code', 'r.definition_code')
    .innerJoin('core.employees as e', 'e.id', 'r.subject_employee_id')
    .where('s.action', 'is', null)
    .where('r.status', '=', 'pending')
    .where((eb) =>
      roleSpecs.length > 0
        ? eb.or([eb('s.approver_user_id', '=', userId), eb('s.approver_spec', 'in', roleSpecs)])
        : eb('s.approver_user_id', '=', userId),
    )
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
