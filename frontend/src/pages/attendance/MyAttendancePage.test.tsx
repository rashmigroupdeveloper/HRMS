import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { MyAttendancePage } from './MyAttendancePage';
import { renderThemed, THEMES } from '../../test/render';
import { runAxe } from '../../test/axe';
import { todayISOIST } from '../../ui/calendar';

vi.mock('../home/useDashboardResource', () => ({
  useDashboardResource: (path: string) => ({
    loading: false, error: null, reload: vi.fn(),
    data: path.startsWith('/api/my/attendance') ? [{
      date: todayISOIST(), status: 'P', firstIn: null, lastOut: null,
      lateMinutes: 0, otMinutes: 0,
      sessionStatuses: [{ session: 1, status: 'P' }, { session: 2, status: 'O' }],
    }] : [],
  }),
}));

describe('ATT-05 employee session drill-down', () => {
  it.each(THEMES)('shows P:O and names both sessions in the %s theme', async (theme) => {
    const { container } = renderThemed(<MyAttendancePage />, theme);
    const day = screen.getByRole('button', { name: /Session 1: Present; Session 2: Off/ });
    expect(day).toHaveTextContent('P:O');
    fireEvent.click(day);
    expect(screen.getByLabelText('Attendance sessions')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});
