import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRouted, renderThemed } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { canAccessRoute } from '../../app/route-guard';
import type { SessionUser } from '../../lib/session';
import { ReimbursementPaymentsPage } from './ReimbursementPaymentsPage';
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));
const user = (permissions: string[]): SessionUser => ({
  id: 1,
  email: 'synthetic@hrms.invalid',
  employeeId: null,
  roles: [],
  permissions,
});
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation((path) =>
    Promise.resolve(
      path.endsWith('/eligible')
        ? [
            {
              claimId: 9,
              employeeId: 2,
              ecode: 'TEST2',
              name: 'Synthetic',
              companyId: 1,
              companyName: 'Test company',
              amountRupees: 100,
            },
          ]
        : [
            {
              id: 7,
              companyId: 1,
              companyName: 'Test company',
              status: 'prepared',
              totalRupees: 100,
              paymentReference: null,
            },
          ],
    ),
  );
});
it('keeps salary authority separate from reimbursement routes and controls', async () => {
  const salary = user(['payroll.run.view', 'payroll.run.manage']);
  expect(canAccessRoute(salary, '/claims/payments')).toBe(false);
  expect(canAccessRoute(salary, '/claims')).toBe(false);
  const viewer = user(['claims.payout.view']);
  expect(canAccessRoute(viewer, '/claims/payments')).toBe(true);
  expect(canAccessRoute(viewer, '/payroll')).toBe(false);
  renderRouted(<ReimbursementPaymentsPage user={viewer} />);
  await screen.findByText(/TEST2/);
  expect(
    screen.queryByRole('button', { name: 'Create reimbursement batch' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Confirm reimbursement/ })).not.toBeInTheDocument();
});
it('creates and confirms reimbursement payments without a salary run or salary permission', async () => {
  const actor = userEvent.setup();
  renderRouted(
    <ReimbursementPaymentsPage
      user={user(['claims.payout.view', 'claims.payout.manage', 'claims.payout.confirm'])}
    />,
  );
  await actor.click(await screen.findByRole('checkbox'));
  await actor.click(screen.getByRole('button', { name: 'Create reimbursement batch' }));
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/claims/payments', {
      method: 'POST',
      body: JSON.stringify({ claimIds: [9] }),
    });
  });
  await screen.findByRole('checkbox');
  await waitFor(() => {
    expect(screen.getByLabelText('Reimbursement transfer reference for batch 7')).toBeEnabled();
  });
  await actor.type(
    screen.getByLabelText('Reimbursement transfer reference for batch 7'),
    'BANK-REIMB-7',
  );
  await actor.click(screen.getByRole('button', { name: 'Confirm reimbursement #7 paid' }));
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/claims/payments/7/paid', {
      method: 'POST',
      body: JSON.stringify({ id: 7, paymentReference: 'BANK-REIMB-7' }),
    });
  });
  expect(vi.mocked(apiFetch).mock.calls.every(([path]) => !path.includes('/payroll/'))).toBe(true);
});
it('clears reimbursement data when the signed-in account changes', async () => {
  const first = user(['claims.payout.view']);
  const rendered = renderThemed(<ReimbursementPaymentsPage user={first} />);
  await screen.findByText(/TEST2/);
  vi.mocked(apiFetch).mockImplementation(() => new Promise(() => undefined));
  rendered.rerender(
    <ReimbursementPaymentsPage user={{ ...first, id: 99, email: 'other@hrms.invalid' }} />,
  );
  expect(screen.queryByText(/TEST2/)).not.toBeInTheDocument();
});
