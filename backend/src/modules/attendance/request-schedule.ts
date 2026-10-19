/** ATT-04/05/06/07: own resolved roster times, never guessed half-day hours. */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { scheduledShiftIntervals, shiftSessions } from './shift-windows.js';
import { resolveDay } from './day-status.service.js';
import type { DayPortion } from './half-requests.js';
export interface AttendanceWindow {
  dayPortion: DayPortion;
  startsAt: string;
  endsAt: string;
}
export async function attendanceRequestSchedule(
  db: Kysely<Database>,
  employeeId: number,
  date: string,
) {
  const resolved = await resolveDay(db, employeeId, date);
  const shift = resolved.shift;
  const dayKind = resolved.isHoliday
    ? ('holiday' as const)
    : resolved.isWeekOff
      ? ('week_off' as const)
      : shift
        ? ('working' as const)
        : ('unconfigured' as const);
  const windows: AttendanceWindow[] = [];
  if (dayKind === 'working' && shift) {
    const intervals = scheduledShiftIntervals(shift, date);
    const start = Math.min(...intervals.map((iv) => iv.start));
    const end = Math.max(...intervals.map((iv) => iv.end));
    windows.push({
      dayPortion: 'full_day',
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    });
    const sessions = shiftSessions(shift, date, intervals);
    if (sessions) {
      for (const [index, session] of sessions.entries())
        windows.push({
          dayPortion: index === 0 ? 'first_half' : 'second_half',
          startsAt: new Date(session.start).toISOString(),
          endsAt: new Date(session.end).toISOString(),
        });
    }
  }
  return { date, dayKind, shiftCode: shift?.code ?? null, shiftName: shift?.name ?? null, windows };
}
