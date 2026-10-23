import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { LeaveApplyDrawer, type LeaveTypeOption } from './LeaveApplyDrawer';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
const types: LeaveTypeOption[] = [{ code: 'CL', name: 'Casual leave', available: 10, isPaid: true, allowHalfDay: true, maxPerRequest: null, sandwichRule: 'exclude' }];
const preview = { days: 1, available: 10, remaining: 9, skipped: [], blackouts: [], coverage: { blocked: false, warnings: [] }, blocked: false };
beforeEach(() => { localStorage.clear(); vi.mocked(apiFetch).mockReset().mockImplementation(path => Promise.resolve(path.startsWith('/api/leave/preview') ? preview : [])); });
it('restores the owner draft and never transfers it when the signed-in user changes', async () => {
  const props = { open: true, leaveTypes: types, onClose: vi.fn(), onSubmitted: vi.fn() };
  const view = render(<LeaveApplyDrawer {...props} ownerId={101} />);
  fireEvent.change(screen.getByLabelText(/Why are you taking/), { target: { value: 'Private employee reason' } });
  view.rerender(<LeaveApplyDrawer {...props} ownerId={202} />);
  expect(screen.getByLabelText(/Why are you taking/)).toHaveValue('');
  view.rerender(<LeaveApplyDrawer {...props} ownerId={101} />);
  expect(screen.getByLabelText(/Why are you taking/)).toHaveValue('Private employee reason');
  await waitFor(() => { expect(screen.getByRole('button', { name: 'Send to my manager' })).toBeEnabled(); });
});
it('blocks submission while the preview is pending and when preview fails', async () => {
  let rejectPreview: (reason: Error) => void = () => { throw new Error('Preview was not requested'); };
  vi.mocked(apiFetch).mockImplementation(path => path.startsWith('/api/leave/preview') ? new Promise((_resolve, reject) => { rejectPreview = reject; }) : Promise.resolve([]));
  render(<LeaveApplyDrawer ownerId={101} open leaveTypes={types} onClose={vi.fn()} onSubmitted={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/Why are you taking/), { target: { value: 'Medical appointment' } });
  expect(screen.getByRole('button', { name: 'Send to my manager' })).toBeDisabled();
  rejectPreview(new Error('Could not check the balance'));
  await screen.findByText('Could not check the balance');
  expect(screen.getByRole('button', { name: 'Send to my manager' })).toBeDisabled();
  expect(vi.mocked(apiFetch).mock.calls.some(call => call[1]?.method === 'POST')).toBe(false);
});
