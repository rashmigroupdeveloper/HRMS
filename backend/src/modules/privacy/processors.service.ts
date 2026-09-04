/**
 * Stage 5.3 — processors + breach register (PRV-07/08).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';

export interface ProcessorView {
  id: number;
  name: string;
  purpose: string;
  dpaStatus: string;
  dpaExpiresOn: string | null;
  ownerEmail: string | null;
}

export interface BreachView {
  id: number;
  discoveredAt: string;
  summary: string;
  notifiedBoardAt: string | null;
  notifiedPrincipalsAt: string | null;
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  // Local getters, not toISOString — a DATE column is local midnight.
  return formatDbDate(value);
}

export async function listProcessors(db: Kysely<Database>): Promise<ProcessorView[]> {
  const rows = await db.selectFrom('prv.processors').selectAll().orderBy('name').execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    dpaStatus: row.dpa_status,
    dpaExpiresOn: isoDate(row.dpa_expires_on),
    ownerEmail: row.owner_email,
  }));
}

export async function listBreaches(db: Kysely<Database>): Promise<BreachView[]> {
  const rows = await db
    .selectFrom('prv.breach_register')
    .selectAll()
    .orderBy('discovered_at', 'desc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    discoveredAt: row.discovered_at.toISOString(),
    summary: row.summary,
    notifiedBoardAt: row.notified_board_at?.toISOString() ?? null,
    notifiedPrincipalsAt: row.notified_principals_at?.toISOString() ?? null,
  }));
}

export async function upsertProcessor(
  db: Kysely<Database>,
  params: {
    id?: number;
    name: string;
    purpose: string;
    dpaStatus: 'active' | 'expired' | 'missing';
    dpaExpiresOn: string | null;
    ownerEmail: string | null;
    actorUserId: number;
  },
): Promise<ProcessorView> {
  let row;
  if (params.id !== undefined) {
    row = await db
      .updateTable('prv.processors')
      .set({
        name: params.name,
        purpose: params.purpose,
        dpa_status: params.dpaStatus,
        dpa_expires_on: params.dpaExpiresOn,
        owner_email: params.ownerEmail,
        updated_at: new Date(),
      })
      .where('id', '=', params.id)
      .returningAll()
      .executeTakeFirst();
    if (row === undefined) throw new Error('Processor not found');
  } else {
    row = await db
      .insertInto('prv.processors')
      .values({
        name: params.name,
        purpose: params.purpose,
        dpa_status: params.dpaStatus,
        dpa_expires_on: params.dpaExpiresOn,
        owner_email: params.ownerEmail,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: params.id === undefined ? 'privacy_processor_create' : 'privacy_processor_update',
    entity: 'prv.processors',
    entityId: row.id,
    newValue: `${row.name}:${row.dpa_status}`,
  });

  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    dpaStatus: row.dpa_status,
    dpaExpiresOn: isoDate(row.dpa_expires_on),
    ownerEmail: row.owner_email,
  };
}

export async function recordBreach(
  db: Kysely<Database>,
  summary: string,
  recordedBy: number,
): Promise<{ id: number }> {
  const row = await db
    .insertInto('prv.breach_register')
    .values({ summary, recorded_by: recordedBy })
    .returning('id')
    .executeTakeFirstOrThrow();
  await writeAudit(db, {
    actorUserId: recordedBy,
    action: 'privacy_breach_record',
    entity: 'prv.breach_register',
    entityId: row.id,
    newValue: summary.slice(0, 200),
  });
  return { id: row.id };
}
