import { expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRouted } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { SalaryHoldsPage } from './SalaryHoldsPage';
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));
it('finds a scoped employee and sends an explicit hold type, first-of-month and reason', async () => {
  vi.mocked(apiFetch).mockImplementation((path) =>
    Promise.resolve(
      path.startsWith('/api/payroll/holds/employees?')
        ? [{ id: 23, ecode: 'TEST23', name: 'Synthetic' }]
        : [],
    ),
  );
  const actor = userEvent.setup();
  renderRouted(
    <SalaryHoldsPage
      user={{
        id: 1,
        email: 'payroll@hrms.invalid',
        employeeId: null,
        roles: [],
        permissions: ['payroll.run.view', 'payroll.run.manage'],
      }}
    />,
  );
  await actor.type(screen.getByLabelText('Search e-code'), 'TEST23');
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/payroll/holds/employees?ecode=TEST23');
  });
  await actor.click(screen.getByRole('combobox', { name: 'Employee' }));
  await actor.click(screen.getByRole('option', { name: 'TEST23 · Synthetic' }));
  await actor.type(await screen.findByLabelText('Start month'), '2097-01');
  await actor.type(screen.getByLabelText('Reason'), 'Synthetic payment hold');
  await actor.click(screen.getByRole('button', { name: 'Place hold' }));
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/payroll/holds/place', {
      method: 'POST',
      body: JSON.stringify({
        employee_id: 23,
        hold_type: 'payment',
        start_month: '2097-01-01',
        reason: 'Synthetic payment hold',
      }),
    });
  });
});
