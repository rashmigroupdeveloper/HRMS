/** ATT-03/18: the HRMS reporting cutoff is independent of the actual punch clock. */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { addDaysIso, istDateTime } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';

export async function loadFinalizationTime(db: Kysely<Database>): Promise<string> {
  const time = await getTypedSetting(db, 'att.day_finalize_after_time', 'string', '04:00');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('att.day_finalize_after_time must be HH:mm');
  return time;
}

export function dayFinalizationAt(workDate: string, time: string, shiftEnd?: number): Date {
  const cutoff = istDateTime(addDaysIso(workDate, 1), time).getTime();
  return new Date(Math.max(cutoff, shiftEnd ?? cutoff));
}
