import type { AttendanceMonthRow } from './attendance-types';
import { useAttendanceSchedule, windowTiming } from './attendance-schedule';
import { dayPortionLabel } from './attendance-portion';
const LABEL = { P: 'Present', A: 'Absent', O: 'Off', OD: 'Official duty' } as const;
export function AttendanceHalfDetails({ date, row }: { date: string; row?: AttendanceMonthRow | undefined }) {
  const schedule = useAttendanceSchedule(date);
  const unavailable = schedule.data?.dayKind === 'week_off' ? 'Week off — no working half'
    : schedule.data?.dayKind === 'holiday' ? 'Holiday — no working half' : 'Half timings not configured';
  return <div className="mt-4">
    <dl className="grid grid-cols-2 gap-3 text-sm" aria-label="Attendance sessions">
      {([1, 2] as const).map(half => {
        const portion = half === 1 ? 'first_half' : 'second_half';
        const session = row?.sessionStatuses?.find(s => s.session === half);
        const window = schedule.data?.windows.find(w => w.dayPortion === portion);
        return <div key={half}>
          <dt className="text-hero-muted">{dayPortionLabel(portion)}</dt>
          <dd className="mt-1 font-semibold">{session ? LABEL[session.status] : 'No half result posted'}</dd>
          <dd className="mt-1 text-xs tabular-nums text-hero-muted">{schedule.loading ? 'Loading timings…' : window ? windowTiming(window) : unavailable}</dd>
        </div>;
      })}
    </dl>
    {schedule.error && <p role="status" className="mt-2 text-xs text-hero-muted">{schedule.error}</p>}
  </div>;
}
