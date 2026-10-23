import { apiFetch } from '../../lib/api';
import { scheduleFixture } from '../../test/attendance-schedule';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { MyAttendancePage } from './MyAttendancePage';
import { renderRouted, THEMES } from '../../test/render';
import type { AttendanceMonthRow } from './attendance-types';
import { runAxe } from '../../test/axe';
import { todayISOIST } from '../../ui/calendar';

vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
const fixtures = vi.hoisted(() => ({ rows: [] as AttendanceMonthRow[] }));
beforeEach(() => { vi.mocked(apiFetch).mockResolvedValue(scheduleFixture(todayISOIST())); fixtures.rows = [{
  date: todayISOIST(), status: 'P', firstIn: null, lastOut: null,
  lateMinutes: 0, otMinutes: 0,
  sessionStatuses: [{ session: 1, status: 'P' }, { session: 2, status: 'O' }],
}]; });
vi.mock('../home/useDashboardResource', () => ({
  useDashboardResource: (path: string) => ({
    loading: false, error: null, reload: vi.fn(),
    data: path.startsWith('/api/my/attendance') ? fixtures.rows : [],
  }),
}));

describe('ATT-05 employee session drill-down', () => {
  it.each(THEMES)('shows P:O and names both sessions in the %s theme', async (theme) => {
    const { container } = renderRouted(<MyAttendancePage />, theme);
    await screen.findByText('09:00 – 13:30 IST');
    const day = screen.getByRole('button', { name: /First half: Present; Second half: Off/ });
    expect(day).toHaveTextContent('P:O');
    fireEvent.click(day);
    expect(screen.getByLabelText('Attendance sessions')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('First half')).toBeInTheDocument();
    expect(screen.getByText('Second half')).toBeInTheDocument();
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });

  it.each(THEMES)('shows OD as duty with its own glyph rather than a week off in %s', async theme => {
    fixtures.rows = [{ date: todayISOIST(), status: 'OD', sessionStatuses: null,
      firstIn: null, lastOut: null, otMinutes: 0, lateMinutes: 0, source: 'regularized' }];
    renderRouted(<MyAttendancePage />, theme);
    await screen.findByText('09:00 – 13:30 IST');
    expect(screen.getByRole('button', { name: /Official duty · In/ })).toHaveTextContent('OD');
    expect(screen.getAllByText('Official duty').length).toBeGreaterThan(0);
    expect(screen.queryByText('Week off')).not.toBeInTheDocument();
    expect(screen.getByText('From an approved request')).toBeInTheDocument();
  });

  it.each(THEMES)('shows sick leave from the real type instead of a generic L in %s', async theme => {
    fixtures.rows = [{ date: todayISOIST(), status: 'L', sessionStatuses: null,
      firstIn: null, lastOut: null, otMinutes: 0, lateMinutes: 0,
      leaveTypeCode: 'SL', leaveTypeName: 'Sick leave', leaveIsPaid: true, source: 'regularized' }];
    renderRouted(<MyAttendancePage />, theme);
    await screen.findByText('09:00 – 13:30 IST');
    expect(screen.getByRole('button', { name: /Sick leave · In/ })).toHaveTextContent('SL');
    expect(screen.getAllByText('Sick leave').length).toBeGreaterThan(0);
  });
  it('preserves the half-day summary alongside the sick-leave type', async () => {
    fixtures.rows = [{ date: todayISOIST(), status: 'HD', sessionStatuses: null,
      firstIn: null, lastOut: null, otMinutes: 0, lateMinutes: 0, leaveTypeCode: 'SL', leaveTypeName: 'Sick leave' }];
    renderRouted(<MyAttendancePage />);
    await screen.findByText('09:00 – 13:30 IST');
    expect(screen.getByRole('button', { name: /Sick leave · In/ })).toHaveTextContent('HD/SL');
    expect(screen.getByText('Half day · Sick leave')).toBeInTheDocument();
  });
});


it.each([['P', 'A', 'P:A'], ['A', 'P', 'A:P'], ['OD', 'A', 'OD:A']] as const)('shows %s/%s as a half-day, with both halves visible', async (first, second, glyph) => {
    fixtures.rows = [{ date: todayISOIST(), status: 'HD', sessionStatuses: [{ session: 1, status: first }, { session: 2, status: second }], firstIn: null, lastOut: null, otMinutes: 0, lateMinutes: 0 }];
    renderRouted(<MyAttendancePage />);
    await screen.findByText('09:00 – 13:30 IST');
    const day = screen.getByRole('button', { name: /First half:.*Second half:/ });
    expect(day).toHaveTextContent(glyph);
    fireEvent.click(day);
    expect(screen.getByText('Half-day present')).toBeInTheDocument();
    expect(screen.getByText('First half')).toBeInTheDocument();
    expect(screen.getByText('Second half')).toBeInTheDocument();
  });
