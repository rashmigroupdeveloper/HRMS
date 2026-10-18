import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, renderHook } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { renderRouted, THEMES } from '../../test/render';
import { runAxe } from '../../test/axe';
import { scheduleFixture } from '../../test/attendance-schedule';
import { AttendanceHalfDetails } from './AttendanceHalfDetails';
import { useAttendanceSchedule, windowTiming, type AttendanceSchedule } from './attendance-schedule';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
const date = '2026-10-16';
beforeEach(() => { vi.mocked(apiFetch).mockReset().mockResolvedValue(scheduleFixture(date)); });
describe('ATT-05/06/07 resolved half timings', () => {
  it.each(THEMES)('shows actual half windows beside separate attendance in %s', async theme => {
    const { container } = renderRouted(<AttendanceHalfDetails date={date} row={{ date, status: 'HD', firstIn: null, lastOut: null, lateMinutes: 0, otMinutes: 0,
      sessionStatuses: [{ session: 1, status: 'P' }, { session: 2, status: 'A' }] }} />, theme);
    expect(await screen.findByText('09:00 – 13:30 IST')).toBeInTheDocument();
    expect(screen.getByText('13:30 – 18:00 IST')).toBeInTheDocument();
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.getByText('Absent')).toBeInTheDocument();
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
  it('marks next-day end times explicitly', () => {
    expect(windowTiming({ dayPortion: 'full_day', startsAt: '2026-10-16T22:00:00+05:30', endsAt: '2026-10-17T06:00:00+05:30' }))
      .toBe('22:00 – 06:00 (next day) IST');
  });
  it('does not retain the previous date’s shift while the new date loads', async () => {
    let resolve: (schedule: AttendanceSchedule) => void = () => { throw new Error('No pending request'); };
    const pending = new Promise<AttendanceSchedule>(done => { resolve = done; });
    vi.mocked(apiFetch).mockResolvedValueOnce(scheduleFixture(date)).mockReturnValueOnce(pending);
    const hook = renderHook(({ date: selected }) => useAttendanceSchedule(selected), { initialProps: { date } });
    await waitFor(() => { expect(hook.result.current.data?.date).toBe(date); });
    hook.rerender({ date: '2026-10-17' });
    expect(hook.result.current.data).toBeNull();
    expect(hook.result.current.loading).toBe(true);
    resolve(scheduleFixture('2026-10-17'));
    await waitFor(() => { expect(hook.result.current.data?.date).toBe('2026-10-17'); });
  });
  it('uses the first working date’s timings when a range begins on a week off', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ date: '2026-10-18', dayKind: 'week_off', shiftCode: null, shiftName: null, windows: [] })
      .mockResolvedValueOnce(scheduleFixture('2026-10-19'));
    const hook = renderHook(() => useAttendanceSchedule('2026-10-18', true, '2026-10-19'));
    await waitFor(() => { expect(hook.result.current.data?.date).toBe('2026-10-19'); });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

});
