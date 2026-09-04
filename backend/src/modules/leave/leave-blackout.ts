/**
 * SHF-08 leave blackouts — calendar display is att.leave_blackouts; apply must
 * refuse the same dates (otherwise the X on the team planner is decoration).
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate, formatDisplayDate } from '../../core/dates.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface LeaveBlackoutHit {
  date: string;
  name: string;
}

export async function findLeaveBlackouts(
  db: Db,
  params: { locationId: number | null; from: string; to: string },
): Promise<LeaveBlackoutHit[]> {
  const rows = await db
    .selectFrom('att.leave_blackouts')
    .select(['blackout_date', 'name', 'location_id'])
    .where('blackout_date', '>=', sql<Date>`${params.from}::date`)
    .where('blackout_date', '<=', sql<Date>`${params.to}::date`)
    .orderBy('blackout_date')
    .execute();
  const hits: LeaveBlackoutHit[] = [];
  for (const row of rows) {
    if (row.location_id !== null && row.location_id !== params.locationId) continue;
    hits.push({ date: formatDbDate(row.blackout_date), name: row.name });
  }
  return hits;
}

export function leaveBlackoutMessage(hit: LeaveBlackoutHit): string {
  return `Leave is blocked on ${formatDisplayDate(hit.date)} (${hit.name}).`;
}

export async function assertNoLeaveBlackout(
  db: Db,
  params: { locationId: number | null; from: string; to: string },
): Promise<void> {
  const hits = await findLeaveBlackouts(db, params);
  const first = hits[0];
  if (first) throw new Error(leaveBlackoutMessage(first));
}
