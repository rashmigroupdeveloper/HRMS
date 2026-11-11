import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRouted } from '../../test/render';
import { apiFetch, authFetch } from '../../lib/api';
import { ClaimsPage } from './ClaimsPage';
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
  authFetch: vi.fn(),
}));
const entitlement = {
  claimTypeCode: 'medical',
  claimTypeName: 'Medical',
  basis: 'annual',
  totalEntitlementRupees: 1000,
  approvedClaimsRupees: 0,
  pendingClaimsRupees: 0,
  availableBalanceRupees: 1000,
  billRequired: true,
  taxableIfUnsubstantiated: false,
  payoutComponentCode: 'OTHER_EARNINGS',
};
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(authFetch).mockReset();
  vi.mocked(apiFetch).mockResolvedValue({ documentId: 42 });
  vi.mocked(authFetch).mockImplementation((path) =>
    Promise.resolve(
      Response.json(
        path === '/api/claims/my-entitlements'
          ? [entitlement]
          : path === '/api/claims/submit'
            ? { success: true, claimId: 9, totalClaimedRupees: 100 }
            : [],
      ),
    ),
  );
});
it('requires a real receipt upload and submits its returned document id instead of a sample', async () => {
  const actor = userEvent.setup();
  renderRouted(
    <ClaimsPage
      user={{
        id: 1,
        email: 'synthetic@hrms.invalid',
        employeeId: 2,
        roles: ['employee'],
        permissions: [],
      }}
    />,
  );
  await screen.findByText('Medical');
  await actor.click(screen.getByRole('button', { name: 'Submit Claim' }));
  await actor.type(screen.getByLabelText('Amount (₹)'), '100');
  expect(screen.getByRole('button', { name: 'Submit for Approval' })).toBeDisabled();
  await actor.upload(
    screen.getByLabelText('Receipt for bill 1'),
    new File(['%PDF-synthetic'], 'receipt.pdf', { type: 'application/pdf' }),
  );
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Submit for Approval' })).toBeEnabled();
  });
  await actor.click(screen.getByRole('button', { name: 'Submit for Approval' }));
  await waitFor(() => {
    const call = vi.mocked(authFetch).mock.calls.find(([path]) => path === '/api/claims/submit');
    expect(call?.[1]?.method).toBe('POST');
    const body = call?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Expected serialized claim');
    expect(body).toContain('"documentId":42');
  });
  const upload = vi.mocked(apiFetch).mock.calls.find(([path]) => path === '/api/claims/receipts');
  expect(upload?.[1]?.method).toBe('POST');
  const uploadBody = upload?.[1]?.body;
  if (typeof uploadBody !== 'string') throw new Error('Expected serialized receipt');
  expect(uploadBody).toContain('receipt.pdf');
});
