/** WF-01/04: recover held routing through existing administrative authority. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { logger } from '../../core/logger.js';
import { enqueue } from '../notifications/index.js';
import { workflowRoutingHoldSql } from './workflow-access.js';
import { advance } from './workflow-routing.js';
import { lockWorkflowRequest } from './workflow-locks.js';
import { getSteps } from './workflow-definition.js';
import { fireFinalHooks } from './workflow-hooks.js';
import type { Selectable } from 'kysely';
import type { WfRequestsTable } from '../../core/db/types.js';
import { inTransaction } from '../../core/db/database.js';

/** A hold is derived from existing state and audit evidence, not another status column. */
export function routingHeldSql() {
  return sql<boolean>`r.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM wf.request_steps s WHERE s.request_id = r.id AND s.action IS NULL)
    AND EXISTS (SELECT 1 FROM core.audit_log a WHERE a.entity = 'wf.requests'
      AND a.entity_id = r.id AND a.field = 'routing_hold')`;
}

export async function listRoutingHolds(db: Kysely<Database>, actorUserId: number, limit: number, offset: number) {
  return db.selectFrom('wf.requests as r').select(['r.id', 'r.definition_code', 'r.subject_employee_id', 'r.created_at'])
    .where(routingHeldSql())
    .where(workflowRoutingHoldSql(actorUserId, sql.ref<number>('r.subject_employee_id')))
    .orderBy('r.created_at').orderBy('r.id').limit(limit).offset(offset).execute();
}

/** A routing hold cannot extend an explicit lapse deadline (especially ATT-08 OT). */
async function expireHeldRequest(db: Kysely<Database>, request: Selectable<WfRequestsTable>, asOf: Date) {
  const steps = await getSteps(db, request.definition_code);
  const lapse = steps.filter(step => step.onBreach === 'lapse').sort((a, b) => a.slaHours - b.slaHours)[0];
  if (!lapse || request.created_at.getTime() + lapse.slaHours * 3600_000 >= asOf.getTime()) return false;
  await db.updateTable('wf.requests').set({ status: 'lapsed', decided_at: asOf }).where('id', '=', request.id).execute();
  await fireFinalHooks(db, request.id, 'lapsed');
  await writeAudit(db, { action: 'update', entity: 'wf.requests', entityId: request.id,
    subjectEmployeeId: request.subject_employee_id, field: 'routing_hold_lapsed',
    newValue: 'Configured lapse deadline reached while waiting for HR routing repair' });
  await enqueue(db, { recipientUserId: request.requested_by, channel: 'in_app',
    templateCode: 'request_lapsed', payload: { requestId: request.id } });
  return true;
}

export async function expireRoutingHolds(db: Kysely<Database>, asOf: Date) {
  const held = await db.selectFrom('wf.requests as r').select('r.id').where(routingHeldSql()).execute();
  let expired = 0;
  for (const row of held) {
    try {
      await inTransaction(db, async trx => {
        const request = await lockWorkflowRequest(trx, row.id);
        if (!await trx.selectFrom('wf.requests as r').select('r.id').where('r.id', '=', row.id)
          .where(routingHeldSql()).executeTakeFirst()) return;
        if (await expireHeldRequest(trx, request, asOf)) expired++;
      });
    } catch (cause) {
      logger.error({ requestId: row.id, errorType: cause instanceof Error ? cause.name : 'UnknownError' },
        'Held workflow expiry failed; request retained for HR routing review');
    }
  }
  return expired;
}

/** Re-evaluate the configured chain, never assign HR an implicit approval. */
export async function retryRouting(db: Kysely<Database>, requestId: number, actorUserId: number, reason: string) {
  if (!reason.trim()) throw new Error('A routing repair reason is required');
  return inTransaction(db, async trx => {
    const request = await lockWorkflowRequest(trx, requestId);
    const allowed = await trx.selectFrom('core.users').select('id').where('id', '=', actorUserId)
      .where(workflowRoutingHoldSql(actorUserId, request.subject_employee_id)).executeTakeFirst();
    if (!allowed) throw new Error('Routing administration is outside your permitted scope');
    const held = await trx.selectFrom('wf.requests as r').select('r.id').where('r.id', '=', requestId)
      .where(routingHeldSql()).executeTakeFirst();
    if (!held) throw new Error('Request is not held for routing repair');
    if (await expireHeldRequest(trx, request, new Date())) return { routingState: 'lapsed' as const };
    await writeAudit(trx, { actorUserId, action: 'update', entity: 'wf.requests', entityId: requestId,
      subjectEmployeeId: request.subject_employee_id, field: 'routing_retry', newValue: reason.trim() });
    await advance(trx, request, 0);
    const open = await trx.selectFrom('wf.request_steps').select('id').where('request_id', '=', requestId)
      .where('action', 'is', null).executeTakeFirst();
    return { routingState: open ? 'awaiting_approver' as const : 'held_for_hr' as const };
  });
}
