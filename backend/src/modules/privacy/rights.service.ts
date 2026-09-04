/**
 * Stage 5.3 — DPDP rights requests (PRV-04).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { RightsKind } from '../../core/db/types.prv.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getTypedSetting } from '../../core/settings/read.js';
import { createRequest } from '../workflows/index.js';

export interface RightsView {
  id: number;
  employeeId: number;
  employeeName: string | null;
  employeeEmail: string | null;
  kind: string;
  status: string;
  reason: string | null;
  refusalReason: string | null;
  dueAt: string;
  closedAt: string | null;
  createdAt: string;
}

export async function createRightsRequest(
  db: Kysely<Database>,
  params: {
    employeeId: number;
    userId: number;
    kind: RightsKind;
    reason: string | null;
    ip?: string | null;
  },
): Promise<{ id: number }> {
  const slaDays = await getTypedSetting(db, 'prv.rights_sla_days', 'number', 15);
  const dueAt = new Date(Date.now() + slaDays * 86_400_000);

  let rightsId = 0;
  try {
    await createRequest(
      db,
      {
        definitionCode: 'privacy_rights',
        subjectEmployeeId: params.employeeId,
        requestedByUserId: params.userId,
        payload: { kind: params.kind, reason: params.reason },
      },
      async (trx, requestId) => {
        const inserted = await trx
          .insertInto('prv.rights_requests')
          .values({
            employee_id: params.employeeId,
            kind: params.kind,
            reason: params.reason,
            due_at: dueAt,
            workflow_request_id: requestId,
            status: 'open',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        rightsId = inserted.id;
      },
    );
  } catch {
    // Definition missing or chain cannot advance — still open the statutory clock.
    const row = await db
      .insertInto('prv.rights_requests')
      .values({
        employee_id: params.employeeId,
        kind: params.kind,
        reason: params.reason,
        due_at: dueAt,
        status: 'open',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    rightsId = row.id;
  }

  await writeAudit(db, {
    actorUserId: params.userId,
    action: 'privacy_rights_create',
    entity: 'prv.rights_requests',
    entityId: rightsId,
    subjectEmployeeId: params.employeeId,
    ip: params.ip ?? null,
    newValue: params.kind,
  });
  return { id: rightsId };
}

export async function listRightsRequests(db: Kysely<Database>): Promise<RightsView[]> {
  const rows = await db
    .selectFrom('prv.rights_requests as r')
    .innerJoin('core.employees as e', 'e.id', 'r.employee_id')
    .select([
      'r.id',
      'r.employee_id',
      'r.kind',
      'r.status',
      'r.reason',
      'r.refusal_reason',
      'r.due_at',
      'r.closed_at',
      'r.created_at',
      'e.first_name',
      'e.last_name',
      'e.work_email',
    ])
    .orderBy('r.created_at', 'desc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
    employeeEmail: row.work_email,
    kind: row.kind,
    status: row.status,
    reason: row.reason,
    refusalReason: row.refusal_reason,
    dueAt: row.due_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function fulfillRights(
  db: Kysely<Database>,
  requestId: number,
  actorUserId: number,
): Promise<'ok' | 'not_found' | 'closed'> {
  const row = await db
    .selectFrom('prv.rights_requests')
    .select(['id', 'status'])
    .where('id', '=', requestId)
    .executeTakeFirst();
  if (row === undefined) return 'not_found';
  if (row.status === 'fulfilled' || row.status === 'refused') return 'closed';
  await db
    .updateTable('prv.rights_requests')
    .set({ status: 'fulfilled', closed_at: new Date() })
    .where('id', '=', requestId)
    .execute();
  await writeAudit(db, {
    actorUserId,
    action: 'privacy_rights_fulfill',
    entity: 'prv.rights_requests',
    entityId: requestId,
    newValue: 'fulfilled',
  });
  return 'ok';
}

export async function refuseRights(
  db: Kysely<Database>,
  requestId: number,
  actorUserId: number,
  reason: string,
): Promise<'ok' | 'not_found' | 'closed' | 'no_reason'> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return 'no_reason';
  const row = await db
    .selectFrom('prv.rights_requests')
    .select(['id', 'status'])
    .where('id', '=', requestId)
    .executeTakeFirst();
  if (row === undefined) return 'not_found';
  if (row.status === 'fulfilled' || row.status === 'refused') return 'closed';
  await db
    .updateTable('prv.rights_requests')
    .set({ status: 'refused', refusal_reason: trimmed, closed_at: new Date() })
    .where('id', '=', requestId)
    .execute();
  await writeAudit(db, {
    actorUserId,
    action: 'privacy_rights_refuse',
    entity: 'prv.rights_requests',
    entityId: requestId,
    newValue: trimmed,
  });
  return 'ok';
}
