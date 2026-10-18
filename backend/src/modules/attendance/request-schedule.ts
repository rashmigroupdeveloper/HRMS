/** ATT-04/05/06/07: own resolved roster times, never guessed half-day hours. */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { istDateTime } from '../../core/dates.js';
import { resolveDay } from './day-status.service.js';
import type { DayPortion } from './half-requests.js';
export interface AttendanceWindow { dayPortion: DayPortion; startsAt: string; endsAt: string }
export async function attendanceRequestSchedule(db: Kysely<Database>, employeeId: number, date: string) {
  const resolved = await resolveDay(db, employeeId, date);
  const shift = resolved.shift;
  const dayKind = resolved.isHoliday ? 'holiday' as const : resolved.isWeekOff ? 'week_off' as const
    : shift ? 'working' as const : 'unconfigured' as const;
  const windows: AttendanceWindow[] = [];
  if (dayKind === 'working' && shift) {
    const start = istDateTime(date, shift.start_time);
    const end = istDateTime(date, shift.end_time);
    if (shift.crosses_midnight) end.setUTCDate(end.getUTCDate() + 1);
    if (end > start) {
      windows.push({ dayPortion: 'full_day', startsAt: start.toISOString(), endsAt: end.toISOString() });
      if (shift.session_split) {
        const split = istDateTime(date, shift.session_split);
        if (split < start) split.setUTCDate(split.getUTCDate() + 1);
        if (split > start && split < end) windows.push(
          { dayPortion: 'first_half', startsAt: start.toISOString(), endsAt: split.toISOString() },
          { dayPortion: 'second_half', startsAt: split.toISOString(), endsAt: end.toISOString() },
        );
      }
    }
  }
  return { date, dayKind, shiftCode: shift?.code ?? null, shiftName: shift?.name ?? null, windows };
}
