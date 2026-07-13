/**
 * Policy repository + acknowledgment (CORE-13, PI-ESS-5).
 * Balance/ack % = policies requiring ack × active employees − acknowledgments.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { istDateString } from '../../core/dates.js';
import { enqueue } from '../notifications/index.js';

export async function listActivePolicies(db: Kysely<Database>) {
  return db
    .selectFrom('core.policies')
    .selectAll()
    .where('is_active', '=', true)
    .orderBy('effective_date', 'desc')
    .execute();
}

export async function publishPolicy(
  db: Kysely<Database>,
  params: {
    title: string;
    bodySummary?: string | null | undefined;
    effectiveDate: string;
    requiresAcknowledgment?: boolean | undefined;
    actorUserId: number;
  },
): Promise<number> {
  const row = await db
    .insertInto('core.policies')
    .values({
      title: params.title,
      body_summary: params.bodySummary ?? null,
      effective_date: sql<Date>`${params.effectiveDate}::date` as unknown as Date,
      requires_acknowledgment: params.requiresAcknowledgment ?? true,
      is_active: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'core.policies',
    entityId: row.id,
    field: 'title',
    newValue: params.title,
  });
  return row.id;
}

export async function acknowledgePolicy(
  db: Kysely<Database>,
  params: { policyId: number; employeeId: number },
): Promise<void> {
  const policy = await db
    .selectFrom('core.policies')
    .select(['id', 'requires_acknowledgment', 'is_active'])
    .where('id', '=', params.policyId)
    .executeTakeFirst();
  if (!policy?.is_active) throw new Error('Policy not found or inactive');
  if (!policy.requires_acknowledgment) throw new Error('Policy does not require acknowledgment');

  await db
    .insertInto('core.policy_acknowledgments')
    .values({
      policy_id: params.policyId,
      employee_id: params.employeeId,
    })
    .onConflict((oc) => oc.columns(['policy_id', 'employee_id']).doNothing())
    .execute();
}

export async function myPendingPolicies(db: Kysely<Database>, employeeId: number) {
  return db
    .selectFrom('core.policies as p')
    .select(['p.id', 'p.title', 'p.body_summary', 'p.effective_date'])
    .where('p.is_active', '=', true)
    .where('p.requires_acknowledgment', '=', true)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('core.policy_acknowledgments as a')
            .select(sql`1`.as('one'))
            .whereRef('a.policy_id', '=', 'p.id')
            .where('a.employee_id', '=', employeeId),
        ),
      ),
    )
    .orderBy('p.effective_date', 'desc')
    .execute();
}

/** Ack % for HR tile: (acks for active required policies) / (policies × active employees). */
export async function policyAckStats(db: Kysely<Database>, companyId?: number): Promise<{
  policyCount: number;
  activeEmployees: number;
  expectedAcks: number;
  actualAcks: number;
  percent: number;
}> {
  const policies = await db
    .selectFrom('core.policies')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('is_active', '=', true)
    .where('requires_acknowledgment', '=', true)
    .executeTakeFirstOrThrow();
  let employeesQuery = db
    .selectFrom('core.employees')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('status', 'in', ['active', 'on_notice']);
  if (companyId !== undefined) employeesQuery = employeesQuery.where('company_id', '=', companyId);
  const emps = await employeesQuery.executeTakeFirstOrThrow();
  let acknowledgmentsQuery = db
    .selectFrom('core.policy_acknowledgments as a')
    .innerJoin('core.policies as p', 'p.id', 'a.policy_id')
    .innerJoin('core.employees as e', 'e.id', 'a.employee_id')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('p.is_active', '=', true)
    .where('p.requires_acknowledgment', '=', true)
    .where('e.status', 'in', ['active', 'on_notice']);
  if (companyId !== undefined) {
    acknowledgmentsQuery = acknowledgmentsQuery.where('e.company_id', '=', companyId);
  }
  const acks = await acknowledgmentsQuery.executeTakeFirstOrThrow();

  const policyCount = policies.n;
  const activeEmployees = emps.n;
  const expectedAcks = policyCount * activeEmployees;
  const actualAcks = acks.n;
  const percent = expectedAcks === 0 ? 100 : Math.round((actualAcks / expectedAcks) * 1000) / 10;
  return { policyCount, activeEmployees, expectedAcks, actualAcks, percent };
}

/** Weekly nag: notify employees with pending policy acks. */
export async function runPolicyAckNag(db: Kysely<Database>): Promise<number> {
  const pending = await db
    .selectFrom('core.policies as p')
    .innerJoin('core.employees as e', (join) =>
      join.on('e.status', 'in', ['active', 'on_notice']),
    )
    .innerJoin('core.users as u', (join) =>
      join.onRef('u.employee_id', '=', 'e.id').on('u.is_active', '=', true),
    )
    .select(['u.id as user_id', 'p.id as policy_id', 'p.title'])
    .where('p.is_active', '=', true)
    .where('p.requires_acknowledgment', '=', true)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('core.policy_acknowledgments as a')
            .select(sql`1`.as('one'))
            .whereRef('a.policy_id', '=', 'p.id')
            .whereRef('a.employee_id', '=', 'e.id'),
        ),
      ),
    )
    .execute();

  // One notification per user (aggregate count)
  const byUser = new Map<number, number>();
  for (const row of pending) {
    byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + 1);
  }
  for (const [userId, count] of byUser) {
    await enqueue(db, {
      recipientUserId: userId,
      channel: 'in_app',
      templateCode: 'policy_ack_nag',
      payload: { pendingCount: count, asOf: istDateString() },
    });
  }
  return byUser.size;
}
