import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { MyAttendancePage } from './MyAttendancePage';
import { renderRouted, THEMES } from '../../test/render';
import type { AttendanceMonthRow } from './attendance-types';
import { runAxe } from '../../test/axe';
import { todayISOIST } from '../../ui/calendar';

const fixtures = vi.hoisted(() => ({ rows: [] as AttendanceMonthRow[] }));
beforeEach(() => { fixtures.rows = [{
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
    const day = screen.getByRole('button', { name: /Session 1: Present; Session 2: Off/ });
    expect(day).toHaveTextContent('P:O');
    fireEvent.click(day);
    expect(screen.getByLabelText('Attendance sessions')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });

  it.each(THEMES)('shows OD as duty with its own glyph rather than a week off in %s', theme => {
    fixtures.rows = [{ date: todayISOIST(), status: 'OD', sessionStatuses: null,
      firstIn: null, lastOut: null, otMinutes: 0, lateMinutes: 0, source: 'regularized' }];
    renderRouted(<MyAttendancePage />, theme);
    expect(screen.getByRole('button', { name: /Official duty · In/ })).toHaveTextContent('OD');
    expect(screen.getByText('Official duty')).toBeInTheDocument();
    expect(screen.queryByText('Week off')).not.toBeInTheDocument();
    expect(screen.getByText('From an approved request')).toBeInTheDocument();
  });

  it.each(THEMES)('shows sick leave from the real type instead of a generic L in %s', theme => {
    fixtures.rows = [{ date: todayISOIST(), status: 'L', sessionStatuses: null,
      firstIn: null, lastOut: null, otMinutes: 0, lateMinutes: 0,
      leaveTypeCode: 'SL', leaveTypeName: 'Sick leave', leaveIsPaid: true, source: 'regularized' }];
    renderRouted(<MyAttendancePage />, theme);
    expect(screen.getByRole('button', { name: /Sick leave · In/ })).toHaveTextContent('SL');
    expect(screen.getByText('Sick leave')).toBeInTheDocument();
  });
  it('preserves the half-day summary alongside the sick-leave type', () => {
    fixtures.rows = [{ date: todayISOIST(), status: 'HD', sessionStatuses: null,
      firstIn: null, lastOut: null, otMinutes: 0, lateMinutes: 0, leaveTypeCode: 'SL', leaveTypeName: 'Sick leave' }];
    renderRouted(<MyAttendancePage />);
    expect(screen.getByRole('button', { name: /Sick leave · In/ })).toHaveTextContent('HD/SL');
    expect(screen.getByText('Half day · Sick leave')).toBeInTheDocument();
  });
});
