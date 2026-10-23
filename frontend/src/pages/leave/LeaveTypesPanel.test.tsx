import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { LeaveTypesPanel, type LeaveCatalog } from './LeaveTypesPanel';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
const catalog: LeaveCatalog = { canManageTypes: false, canRunJobs: false, types: [{ code: 'CL', name: 'Casual leave', isActive: false, isPaid: true, accrualPerMonth: 1, accrualRequiresServiceMonths: 0, maxCarryForward: null, maxPerRequest: null, encashable: false, allowHalfDay: true, sandwichRule: 'exclude', applicableGender: null, applicableCategories: null }] };
it('shows inactive policy to scoped HR without offering changes', () => {
  render(<LeaveTypesPanel catalog={catalog} onSaved={vi.fn()} />);
  expect(screen.getByText('CL · Inactive')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit CL' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New leave type' })).not.toBeInTheDocument();
});
it('preserves unlimited caps and eligibility when saving policy', async () => {
  vi.mocked(apiFetch).mockResolvedValue({});
  const saved = vi.fn();
  render(<LeaveTypesPanel catalog={{ ...catalog, canManageTypes: true }} onSaved={saved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit CL' }));
  expect(screen.getByLabelText(/^Code/)).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await waitFor(() => { expect(saved).toHaveBeenCalledOnce(); });
  const body = vi.mocked(apiFetch).mock.calls[0]?.[1]?.body;
  expect(typeof body === 'string' ? JSON.parse(body) : null).toMatchObject({ code: 'CL', isActive: false, maxCarryForward: null, maxPerRequest: null, applicableCategories: null });
});
