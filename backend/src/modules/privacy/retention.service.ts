/**
 * Stage 5.3 — retention rules + two-person purge (PRV-06).
 * v1 logs the purge decision; it does not delete attendance rows.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';

export interface RetentionRuleView {
  dataClass: string;
  retentionDays: number;
  openHolds: number;
}

export interface PurgeProposalView {
  id: number;
  dataClass: string;
  rowCount: number;
  excludedHolds: number;
  proposedBy: string | null;
  proposedAt: string;
  confirmedAt: string | null;
}

export async function listRetention(
  db: Kysely<Database>,
): Promise<{ rules: RetentionRuleView[]; proposals: PurgeProposalView[] }> {
  const [rules, proposals, holds] = await Promise.all([
    db.selectFrom('prv.retention_rules').selectAll().orderBy('data_class').execute(),
    db
      .selectFrom('prv.purge_proposals as p')
      .leftJoin('core.users as u', 'u.id', 'p.proposed_by')
      .select([
        'p.id',
        'p.data_class',
        'p.row_count',
        'p.excluded_holds',
        'p.proposed_at',
        'p.confirmed_at',
        'u.email',
      ])
      .orderBy('p.proposed_at', 'desc')
      .execute(),
    db
      .selectFrom('prv.legal_holds')
      .select(['data_class'])
      .where('released_at', 'is', null)
      .execute(),
  ]);
  const holdCounts = new Map<string, number>();
  for (const hold of holds) {
    const key = hold.data_class ?? '*';
    holdCounts.set(key, (holdCounts.get(key) ?? 0) + 1);
  }
  return {
    rules: rules.map((r) => ({
      dataClass: r.data_class,
      retentionDays: r.retention_days,
      openHolds: (holdCounts.get(r.data_class) ?? 0) + (holdCounts.get('*') ?? 0),
    })),
    proposals: proposals.map((p) => ({
      id: p.id,
      dataClass: p.data_class,
      rowCount: p.row_count,
      excludedHolds: p.excluded_holds,
      proposedBy: p.email,
      proposedAt: p.proposed_at.toISOString(),
      confirmedAt: p.confirmed_at?.toISOString() ?? null,
    })),
  };
}

/**
 * Propose a purge for a data class. Row counts are estimated from consents /
 * notice acks when those classes map; otherwise 0 with an honest audit note.
 * Never invents a count for attendance.
 */
export async function proposePurge(
  db: Kysely<Database>,
  dataClass: string,
  proposedBy: number,
): Promise<PurgeProposalView | 'unknown_class'> {
  const rule = await db
    .selectFrom('prv.retention_rules')
    .selectAll()
    .where('data_class', '=', dataClass)
    .executeTakeFirst();
  if (rule === undefined) return 'unknown_class';

  const openHolds = await db
    .selectFrom('prv.legal_holds')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('released_at', 'is', null)
    .where((eb) =>
      eb.or([eb('data_class', '=', dataClass), eb('data_class', 'is', null)]),
    )
    .executeTakeFirst();
  const excludedHolds = Number(openHolds?.count ?? 0);

  // v1: only consent rows are countable without inventing attendance history.
  let rowCount = 0;
  if (dataClass === 'photograph' || dataClass === 'family' || dataClass === 'health') {
    const counted = await db
      .selectFrom('prv.consents')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('purpose', 'in', ['photograph', 'family', 'wellness'])
      .executeTakeFirst();
    rowCount = Number(counted?.count ?? 0);
  }

  const inserted = await db
    .insertInto('prv.purge_proposals')
    .values({
      data_class: dataClass,
      row_count: rowCount,
      excluded_holds: excludedHolds,
      proposed_by: proposedBy,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId: proposedBy,
    action: 'privacy_purge_propose',
    entity: 'prv.purge_proposals',
    entityId: inserted.id,
    newValue: `${dataClass}:${rowCount}`,
  });

  const user = await db
    .selectFrom('core.users')
    .select('email')
    .where('id', '=', proposedBy)
    .executeTakeFirst();

  return {
    id: inserted.id,
    dataClass: inserted.data_class,
    rowCount: inserted.row_count,
    excludedHolds: inserted.excluded_holds,
    proposedBy: user?.email ?? null,
    proposedAt: inserted.proposed_at.toISOString(),
    confirmedAt: null,
  };
}

export async function confirmPurge(
  db: Kysely<Database>,
  proposalId: number,
  confirmerId: number,
): Promise<'ok' | 'not_found' | 'already' | 'same_user'> {
  const proposal = await db
    .selectFrom('prv.purge_proposals')
    .selectAll()
    .where('id', '=', proposalId)
    .executeTakeFirst();
  if (proposal === undefined) return 'not_found';
  if (proposal.confirmed_at !== null) return 'already';
  if (proposal.proposed_by === confirmerId) return 'same_user';

  await db
    .updateTable('prv.purge_proposals')
    .set({ confirmed_by: confirmerId, confirmed_at: new Date() })
    .where('id', '=', proposalId)
    .execute();

  const ruleText = `PRV-06 confirm class=${proposal.data_class} count=${String(proposal.row_count)} (log-only; no attendance delete in v1)`;
  await db.insertInto('prv.purge_log').values({
    proposal_id: proposalId,
    data_class: proposal.data_class,
    row_count: proposal.row_count,
    rule: ruleText,
  }).execute();

  await writeAudit(db, {
    actorUserId: confirmerId,
    action: 'privacy_purge_confirm',
    entity: 'prv.purge_proposals',
    entityId: proposalId,
    newValue: ruleText,
  });
  return 'ok';
}
