import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { DAY_PORTION_OPTIONS, type DayPortion } from './attendance-portion';
export interface AttendanceWindow { dayPortion: DayPortion; startsAt: string; endsAt: string }
export interface AttendanceSchedule {
  date: string;
  dayKind: 'working' | 'week_off' | 'holiday' | 'unconfigured';
  shiftCode: string | null;
  shiftName: string | null;
  windows: AttendanceWindow[];
}
const clock = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
export function windowTiming(window: AttendanceWindow): string {
  const start = new Date(window.startsAt); const end = new Date(window.endsAt);
  return `${clock.format(start)} – ${clock.format(end)}${day.format(start) !== day.format(end) ? ' (next day)' : ''} IST`;
}
export function schedulePortionOptions(schedule: AttendanceSchedule | null) {
  return (schedule?.windows ?? []).map(window => ({ value: window.dayPortion,
    label: DAY_PORTION_OPTIONS.find(option => option.value === window.dayPortion)?.label ?? window.dayPortion,
    description: windowTiming(window),
  }));
}
export function useAttendanceSchedule(date: string | null, enabled = true, throughDate: string | null = date) {
  const [state, setState] = useState<{ date: string | null; data: AttendanceSchedule | null; error: string | null; loading: boolean }>(
    { date: null, data: null, error: null, loading: false });
  useEffect(() => {
    if (!date || !enabled) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    setState({ date, data: null, error: null, loading: true });
    const load = async () => {
      let previewDate = date;
      while (!isCancelled()) {
        const data = await apiFetch<AttendanceSchedule>(`/api/attendance/requests/schedule?date=${previewDate}`);
        if (!Array.isArray(data.windows) || data.date !== previewDate) throw new Error('Invalid shift timing response');
        if (isCancelled()) return;
        if (data.windows.length === 0 && (data.dayKind === 'holiday' || data.dayKind === 'week_off') && throughDate && previewDate < throughDate) {
          const next = new Date(`${previewDate}T00:00:00Z`);
          next.setUTCDate(next.getUTCDate() + 1);
          previewDate = next.toISOString().slice(0, 10);
          continue;
        }
        setState({ date, data, error: null, loading: false });
        return;
      }
    };
    void load().catch(() => { if (!isCancelled()) setState({ date, data: null, error: 'Shift timings could not be loaded. Reopen the form to retry.', loading: false }); });
    return () => { cancelled = true; };
  }, [date, enabled, throughDate]);
  // Never expose yesterday's timings while a different date is loading.
  return date === state.date && enabled ? state : { date, data: null, error: null, loading: Boolean(date && enabled) };
}
