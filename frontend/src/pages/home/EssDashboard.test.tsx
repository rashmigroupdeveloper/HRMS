import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { EssDashboard } from './EssDashboard';
import type { EssDashboardData } from './dashboard-types';
import { renderRouted } from '../../test/render';

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
});

const DATA: EssDashboardData = {
  greetingName: 'Rachna',
  ecode: 'RML1',
  today: '2026-09-02',
  shift: { code: 'GEN', name: 'General', startTime: '09:30', endTime: '18:00' },
  todayStatus: { status: 'P', firstIn: '2026-09-02T04:00:00.000Z', lastOut: null },
  leaveBalances: [
    {
      leaveTypeId: 1,
      code: 'CL',
      name: 'Casual leave',
      balance: 8,
      available: 8,
      isPaid: true,
    },
  ],
  pendingRequests: 0,
};

describe('EssDashboard', () => {
  it('uses a serif Hello and a bento of today, pay and attendance — not a stacked admin page', async () => {
    renderRouted(<EssDashboard data={DATA} />);
    const hello = await screen.findByRole('heading', { name: 'Hello Rachna' });
    expect(hello).toHaveClass('font-serif');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This month’s pay' })).toBeInTheDocument();
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Leave balances' })).toBeInTheDocument();
  });
});
