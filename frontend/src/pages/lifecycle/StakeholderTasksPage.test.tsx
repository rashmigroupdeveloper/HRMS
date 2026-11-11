import { expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRouted } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { StakeholderTasksPage } from './StakeholderTasksPage';
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));
it('loads only the stakeholder queue and completes through its dedicated API', async () => {
  vi.mocked(apiFetch).mockImplementation((path) =>
    Promise.resolve(
      path === '/api/lifecycle/my-tasks'
        ? {
            tasks: [
              {
                id: 3,
                employeeId: 9,
                ecode: 'TEST9',
                employeeName: 'Synthetic',
                taskCode: 'it_email',
                taskName: 'Provision email',
                department: 'IT',
                ownerRole: 'it_admin',
                dueDate: '2097-01-01',
                slaHours: 24,
                status: 'open',
              },
            ],
          }
        : { success: true },
    ),
  );
  const actor = userEvent.setup();
  renderRouted(<StakeholderTasksPage />);
  await actor.click(await screen.findByRole('button', { name: 'Mark Done' }));
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/lifecycle/my-tasks/complete', {
      method: 'POST',
      body: JSON.stringify({ taskId: 3 }),
    });
  });
  expect(apiFetch).not.toHaveBeenCalledWith('/api/lifecycle/candidates');
});
