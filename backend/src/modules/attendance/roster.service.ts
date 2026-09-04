/**
 * Roster persistence for manager-maintained employee-day assignments.
 *
 * ATT-03/04/12: only a semantic roster change may enqueue recomputation or
 * invalidate a manager's month approval. Replaying the same assignment is a
 * no-op, which also makes retrying a partially completed client batch safe.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { assertRosterSaveAllowed, recordPublishedRevisions } from './roster-guard.service.js';

export interface RosterPersistenceEntry {
  employeeId: number;
  date: string;
  shiftId: number | null;
  weekOff: boolean;
}

interface ApplyRosterEntriesOptions {
  actorUserId: number;
  entries: RosterPersistenceEntry[];
  ip: string | null;
  reason?: string | null;
}

type Db = Kysely<Database> | Transaction<Database>;

export async function applyRosterEntries(
  db: Db,
  options: ApplyRosterEntriesOptions,
): Promise<number> {
  return db.transaction().execute(async (trx) => {
    const reason = paramsReason(options.reason);
    await assertRosterSaveAllowed(trx, {
      actorUserId: options.actorUserId,
      entries: options.entries,
      reason,
    });
    await recordPublishedRevisions(trx, {
      actorUserId: options.actorUserId,
      entries: options.entries,
      reason,
    });

    let changed = 0;

    for (const entry of options.entries) {
      const persisted = await trx
        .insertInto('att.rosters')
        .values({
          employee_id: entry.employeeId,
          work_date: sql<Date>`${entry.date}::date` as unknown as Date,
          shift_id: entry.shiftId,
          is_week_off: entry.weekOff,
          set_by: options.actorUserId,
        })
        .onConflict((conflict) =>
          conflict
            .columns(['employee_id', 'work_date'])
            .doUpdateSet({
              shift_id: entry.shiftId,
              is_week_off: entry.weekOff,
              set_by: options.actorUserId,
            })
            .where(
              sql<boolean>`att.rosters.shift_id IS DISTINCT FROM excluded.shift_id
                OR att.rosters.is_week_off IS DISTINCT FROM excluded.is_week_off`,
            ),
        )
        .returning('employee_id')
        .executeTakeFirst();

      if (!persisted) continue;
      changed += 1;

      await trx
        .insertInto('att.recompute_queue')
        .values({
          employee_id: entry.employeeId,
          work_date: sql<Date>`${entry.date}::date` as unknown as Date,
        })
        .onConflict((conflict) => conflict.doNothing())
        .execute();
    }

    if (changed > 0) {
      await writeAudit(trx, {
        actorUserId: options.actorUserId,
        action: 'update',
        entity: 'att.rosters',
        field: 'bulk roster assignment',
        newValue: `${String(changed)} employee-day entries`,
        ip: options.ip,
      });
    }

    return changed;
  });
}

function paramsReason(reason: string | null | undefined): string | null {
  if (reason === undefined || reason === null) return null;
  const trimmed = reason.trim();
  return trimmed.length === 0 ? null : trimmed;
}
