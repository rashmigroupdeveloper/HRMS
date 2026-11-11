import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRouted } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { DeclarationReviewPage } from './DeclarationReviewPage';
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));
const user = {
  id: 1,
  email: 'synthetic@hrms.invalid',
  employeeId: null,
  roles: ['payroll_admin'],
  permissions: ['payroll.run.view', 'payroll.run.manage'],
};
const item = {
  id: 7,
  employeeId: 2,
  ecode: 'TEST2',
  name: 'Synthetic',
  section: '80C',
  declaredPaise: 100000,
  verifiedPaise: null,
  proofDocumentId: 9,
  verified: false,
};
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation((path) =>
    Promise.resolve(
      path.startsWith('/api/payroll/declarations?') ? { items: [item], hasMore: false } : {},
    ),
  );
});
it('submits exact paise for a partial proof verification', async () => {
  const actor = userEvent.setup();
  renderRouted(<DeclarationReviewPage user={user} />);
  const field = await screen.findByLabelText('Verified amount (₹) for TEST2 80C');
  await actor.clear(field);
  await actor.type(field, '123.45');
  await actor.click(screen.getByRole('button', { name: 'Verify TEST2 80C' }));
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/payroll/statutory/verifyDeclaration', {
      method: 'POST',
      body: JSON.stringify({ declarationId: 7, verifiedAmountPaise: 12345 }),
    });
  });
});
it('refuses an amount above the declaration and hides writes from readers', async () => {
  const actor = userEvent.setup();
  const rendered = renderRouted(<DeclarationReviewPage user={user} />);
  const field = await screen.findByLabelText('Verified amount (₹) for TEST2 80C');
  await actor.clear(field);
  await actor.type(field, '1000.01');
  await actor.click(screen.getByRole('button', { name: 'Verify TEST2 80C' }));
  expect(screen.getByRole('alert')).toHaveTextContent('cannot exceed');
  expect(apiFetch).not.toHaveBeenCalledWith(
    '/api/payroll/statutory/verifyDeclaration',
    expect.anything(),
  );
  rendered.unmount();
  renderRouted(<DeclarationReviewPage user={{ ...user, permissions: ['payroll.run.view'] }} />);
  await screen.findByText('Proof submitted');
  expect(screen.queryByRole('button', { name: 'Verify TEST2 80C' })).not.toBeInTheDocument();
});
