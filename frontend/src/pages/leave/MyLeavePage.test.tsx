import { expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRouted } from '../../test/render';
import { MyLeavePage } from './MyLeavePage';
vi.mock('../home/useDashboardResource', () => ({
  useDashboardResource: (path: string) => ({ loading: false, error: null, reload: vi.fn(),
    data: path === '/api/leave/applications/mine' ? [{ id: 5, workflowRequestId: 55,
      leaveType: 'SL', fromDate: '2032-05-12', toDate: '2032-05-13', days: 2,
      status: 'pending', workflowStatus: 'sent_back',
    }] : [],
  }),
}));
it('shows the returned workflow state and gives the employee an exact link to its decision and correction', () => {
  renderRouted(<MyLeavePage />);
  expect(screen.getByText('sent back')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /SL.*View decisions/ })).toHaveAttribute('href', '/approvals/55');
  expect(screen.getByText('2 days reserved')).toBeInTheDocument();
  expect(screen.queryByText('1 awaiting approval')).not.toBeInTheDocument();
});
