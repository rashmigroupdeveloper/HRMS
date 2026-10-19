/**
 * Roster persistence for manager-maintained employee-day assignments.
 *
 * ATT-03/04/12 + SHF-02/03/05: only a semantic roster change may enqueue
 * recomputation or invalidate a manager's month approval. Replaying the same
 * assignment is a no-op, which also makes retrying a partially completed
 * client batch safe. Roster guards check fatigue, rest, overlap, and publish
 * revisions before writing.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import type { EmployeeScope } from '../../core/rbac/employee-scope.js';
import {
  attendanceTransaction,
  lockAttendanceEmployee,
  assertAttendanceMonthOpen,
} from './attendance-mutation.js';
import {
  assertRosterSaveAllowed,
  recordPublishedRevisions,
  type RosterGuardEntry,
} from './roster-guard.service.js';

export interface RosterPersistenceEntry {
  employeeId: number;
  date: string;
  shiftId: number | null;
  weekOff: boolean;
}

export interface ApplyRosterEntriesOptions {
  actorUserId: number;
  entries: RosterPersistenceEntry[];
  ip: string | null;
  scope?: EmployeeScope;
  reason?: string | null;
}

export async function applyRosterEntries(
  db: Kysely<Database>,
  options: ApplyRosterEntriesOptions,
): Promise<number> {
  return attendanceTransaction(db, async (trx) => {
    const people = new Map<number, number>();
    for (const id of [...new Set(options.entries.map((e) => e.employeeId))].sort((a, b) => a - b)) {
      const employee = await lockAttendanceEmployee(trx, id, options.scope);
      people.set(id, employee.company_id);
    }

    const reason = paramsReason(options.reason);
    const guardEntries: RosterGuardEntry[] = options.entries.map((e) => ({
      employeeId: e.employeeId,
      date: e.date,
      shiftId: e.shiftId,
      weekOff: e.weekOff,
    }));

    await assertRosterSaveAllowed(trx, {
      actorUserId: options.actorUserId,
      entries: guardEntries,
      reason,
    });
    await recordPublishedRevisions(trx, {
      actorUserId: options.actorUserId,
      entries: guardEntries,
      reason,
    });

    let changed = 0;

    for (const entry of [...options.entries].sort(
      (a, b) => a.employeeId - b.employeeId || a.date.localeCompare(b.date),
    )) {
      const previous = await trx
        .selectFrom('att.rosters')
        .select(['shift_id', 'is_week_off'])
        .where('employee_id', '=', entry.employeeId)
        .where('work_date', '=', sql<Date>`${entry.date}::date`)
        .executeTakeFirst();
      if (previous?.shift_id === entry.shiftId && previous.is_week_off === entry.weekOff)
        continue;
      const companyId = people.get(entry.employeeId);
      if (!companyId) throw new Error('Missing roster employee');
      await assertAttendanceMonthOpen(trx, companyId, entry.date);
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
