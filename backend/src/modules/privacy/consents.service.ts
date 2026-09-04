/**
 * Stage 5.3 — consents + append-only events (PRV-03).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { ConsentPurpose } from '../../core/db/types.prv.js';
import { writeAudit } from '../../core/audit/audit.service.js';

const CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  'photograph',
  'wellness',
  'bgv',
  'family',
  'alumni',
];

export interface ConsentView {
  employeeId: number;
  employeeName: string | null;
  purpose: ConsentPurpose;
  granted: boolean;
  updatedAt: string | null;
}

export async function listMyConsents(
  db: Kysely<Database>,
  employeeId: number,
): Promise<ConsentView[]> {
  const rows = await db
    .selectFrom('prv.consents')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .execute();
  const byPurpose = new Map(rows.map((r) => [r.purpose, r]));
  return CONSENT_PURPOSES.map((purpose) => {
    const row = byPurpose.get(purpose);
    return {
      employeeId,
      employeeName: null,
      purpose,
      granted: row?.granted ?? false,
      updatedAt: row?.updated_at.toISOString() ?? null,
    };
  });
}

export async function listAllConsents(db: Kysely<Database>): Promise<ConsentView[]> {
  const rows = await db
    .selectFrom('prv.consents as c')
    .innerJoin('core.employees as e', 'e.id', 'c.employee_id')
    .select([
      'c.employee_id',
      'c.purpose',
      'c.granted',
      'c.updated_at',
      'e.first_name',
      'e.last_name',
    ])
    .orderBy('c.updated_at', 'desc')
    .execute();
  return rows.map((row) => ({
    employeeId: row.employee_id,
    employeeName: [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
    purpose: row.purpose,
    granted: row.granted,
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function setConsent(
  db: Kysely<Database>,
  params: {
    employeeId: number;
    userId: number;
    purpose: ConsentPurpose;
    granted: boolean;
    ip?: string | null;
  },
): Promise<void> {
  // Grant/withdraw + append-only event are one transaction so a crash cannot
  // leave the registry ahead of the event log (PRV-03).
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('prv.consents')
      .values({
        employee_id: params.employeeId,
        purpose: params.purpose,
        granted: params.granted,
      })
      .onConflict((oc) =>
        oc.columns(['employee_id', 'purpose']).doUpdateSet({
          granted: params.granted,
          updated_at: new Date(),
        }),
      )
      .execute();
    await trx
      .insertInto('prv.consent_events')
      .values({
        employee_id: params.employeeId,
        purpose: params.purpose,
        action: params.granted ? 'grant' : 'withdraw',
        actor_user_id: params.userId,
      })
      .execute();
    await writeAudit(trx, {
      actorUserId: params.userId,
      action: params.granted ? 'privacy_consent_grant' : 'privacy_consent_withdraw',
      entity: 'prv.consents',
      entityId: params.employeeId,
      subjectEmployeeId: params.employeeId,
      ip: params.ip ?? null,
      newValue: `${params.purpose}:${params.granted ? 'grant' : 'withdraw'}`,
    });
  });
}
