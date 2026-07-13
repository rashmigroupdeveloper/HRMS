/**
 * Policy repository (CORE-13, PI-ESS-5): publish → every targeted employee
 * sees it in ESS → acknowledgment tracked in real time (the HR tile is a live
 * query, never a counter) → weekly nag to non-acknowledgers.
 *
 * Audience is an optional JSONB filter {categories, departmentIds, locationIds};
 * NULL targets everyone active.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database, EmploymentCategory } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { createDocument } from '../../core/storage/index.js';
import { enqueue, enqueueEvent } from '../notifications/index.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface PolicyAudience {
  categories?: EmploymentCategory[] | undefined;
  departmentIds?: number[] | undefined;
  locationIds?: number[] | undefined;
}

/** Active employees the policy targets (audience filter applied). */
function targetedEmployees(db: Db, audience: PolicyAudience | null) {
  let q = db.selectFrom('core.employees').select(['id']).where('status', 'in', ['active', 'on_notice']);
  if (audience?.categories && audience.categories.length > 0) q = q.where('category', 'in', audience.categories);
  if (audience?.departmentIds && audience.departmentIds.length > 0) q = q.where('department_id', 'in', audience.departmentIds);
  if (audience?.locationIds && audience.locationIds.length > 0) q = q.where('location_id', 'in', audience.locationIds);
  return q;
}

export interface PublishPolicyParams {
  title: string;
  effectiveDate: string;
  requiresAcknowledgment: boolean;
  audience?: PolicyAudience | undefined;
  fileName: string;
  mime: string;
  content: string;
  actorUserId: number;
}

export async function publishPolicy(db: Kysely<Database>, params: PublishPolicyParams): Promise<number> {
  const documentId = await createDocument(db, {
    ownerEmployeeId: null,
    kind: 'policy',
    originalName: params.fileName,
    mime: params.mime,
    content: params.content,
    uploadedBy: params.actorUserId,
  });
  const policy = await db
    .insertInto('core.policies')
    .values({
      title: params.title,
      document_id: documentId,
      effective_date: sql<Date>`${params.effectiveDate}::date` as unknown as Date,
      requires_acknowledgment: params.requiresAcknowledgment,
      audience: params.audience ? JSON.stringify(params.audience) : null,
      created_by: params.actorUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'core.policies',
    entityId: policy.id,
    field: 'publish',
    newValue: params.title,
  });
  await enqueueEvent(db, 'policy.published', 'policy_published', { policyId: policy.id, title: params.title });
  return policy.id;
}

/** ESS list: active policies targeting ME, with my acknowledgment state. */
export async function listPoliciesFor(db: Db, employeeId: number) {
  const employee = await db
    .selectFrom('core.employees')
    .select(['category', 'department_id', 'location_id'])
    .where('id', '=', employeeId)
    .executeTakeFirstOrThrow();
  const policies = await db
    .selectFrom('core.policies as p')
    .leftJoin('core.policy_acknowledgments as a', (join) => join.onRef('a.policy_id', '=', 'p.id').on('a.employee_id', '=', employeeId))
    .where('p.is_active', '=', true)
    .select(['p.id', 'p.title', 'p.document_id', 'p.effective_date', 'p.requires_acknowledgment', 'p.audience', 'a.acknowledged_at'])
    .orderBy('p.effective_date', 'desc')
    .execute();

  return policies
    .filter((p) => {
      const audience = p.audience as PolicyAudience | null;
      if (!audience) return true;
      if (audience.categories && audience.categories.length > 0 && (employee.category === null || !audience.categories.includes(employee.category))) return false;
      if (audience.departmentIds && audience.departmentIds.length > 0 && (employee.department_id === null || !audience.departmentIds.includes(employee.department_id))) return false;
      if (audience.locationIds && audience.locationIds.length > 0 && (employee.location_id === null || !audience.locationIds.includes(employee.location_id))) return false;
      return true;
    })
    .map((p) => ({
      id: p.id,
      title: p.title,
      documentId: p.document_id,
      effectiveDate: formatDbDate(p.effective_date),
      requiresAcknowledgment: p.requires_acknowledgment,
      acknowledgedAt: p.acknowledged_at ? new Date(p.acknowledged_at as unknown as Date).toISOString() : null,
    }));
}

/** One row per employee, idempotent — re-acking is a no-op, timestamp keeps the first. */
export async function acknowledgePolicy(db: Kysely<Database>, policyId: number, employeeId: number): Promise<void> {
  await db.selectFrom('core.policies').select('id').where('id', '=', policyId).where('is_active', '=', true).executeTakeFirstOrThrow();
  await db
    .insertInto('core.policy_acknowledgments')
    .values({ policy_id: policyId, employee_id: employeeId })
    .onConflict((oc) => oc.columns(['policy_id', 'employee_id']).doNothing())
    .execute();
}

/** The HR tile (CORE-13): per policy — targeted, acknowledged, %. Live query. */
export async function policyAckStatus(db: Kysely<Database>) {
  const policies = await db
    .selectFrom('core.policies')
    .selectAll()
    .where('is_active', '=', true)
    .where('requires_acknowledgment', '=', true)
    .orderBy('effective_date', 'desc')
    .execute();

  const out = [];
  for (const p of policies) {
    const audience = p.audience as PolicyAudience | null;
    const targeted = await targetedEmployees(db, audience)
      .clearSelect()
      .select(({ fn }) => fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const acked = await db
      .selectFrom('core.policy_acknowledgments as a')
      .innerJoin('core.employees as e', 'e.id', 'a.employee_id')
      .where('a.policy_id', '=', p.id)
      .where('e.status', 'in', ['active', 'on_notice'])
      .select(({ fn }) => fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const total = Number(targeted.n);
    const done = Number(acked.n);
    out.push({
      id: p.id,
      title: p.title,
      effectiveDate: formatDbDate(p.effective_date),
      targeted: total,
      acknowledged: done,
      pct: total === 0 ? 100 : Math.round((done / total) * 100),
    });
  }
  return out;
}

/** Weekly nag (PI-ESS-5): every targeted non-acknowledger with a user account
 *  gets an in_app reminder per outstanding policy. Returns reminders queued. */
export async function runPolicyAckNag(db: Kysely<Database>): Promise<number> {
  const policies = await db
    .selectFrom('core.policies')
    .selectAll()
    .where('is_active', '=', true)
    .where('requires_acknowledgment', '=', true)
    .execute();

  let queued = 0;
  for (const p of policies) {
    const audience = p.audience as PolicyAudience | null;
    const pending = await targetedEmployees(db, audience)
      .clearSelect()
      .select('core.employees.id')
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('core.policy_acknowledgments as a')
              .select('a.id')
              .whereRef('a.employee_id', '=', 'core.employees.id')
              .where('a.policy_id', '=', p.id),
          ),
        ),
      )
      .execute();

    for (const employee of pending) {
      const user = await db.selectFrom('core.users').select('id').where('employee_id', '=', employee.id).where('is_active', '=', true).executeTakeFirst();
      if (user) {
        await enqueue(db, {
          recipientUserId: user.id,
          channel: 'in_app',
          templateCode: 'policy_ack_reminder',
          payload: { policyId: p.id, title: p.title },
        });
        queued += 1;
      }
    }
  }
  return queued;
}
