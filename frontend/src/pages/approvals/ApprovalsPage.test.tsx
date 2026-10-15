import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiFetch, ApiError } from '../../lib/api';
import { toast } from '../../ui';
import { ApprovalsPage } from './ApprovalsPage';

vi.mock('../../lib/api', async original => ({
  ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn(),
}));

const request = {
  requestId: 10, type: 'od', typeName: 'Official duty',
  subject: { ecode: 'FIXTURE-10', name: 'Fixture employee' },
  payload: { fromDate: '2026-10-14', toDate: '2026-10-14', reason: 'Client duty' },
  stepNo: 1, notifiedAt: '2026-10-14T09:00:00+05:30',
  slaDueAt: '2026-10-16T09:00:00+05:30', delegated: false,
};

function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/approvals/:id?" element={<ApprovalsPage />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockImplementation(path => {
    if (path === '/api/workflows/inbox') return Promise.resolve([request]);
    if (path === '/api/workflows/requests/999') return Promise.resolve({
      status: 'approved', type: 'od', payload: request.payload, steps: [],
    });
    return Promise.resolve({ outcome: 'advanced' });
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('WF-04 approval identity and decision state', () => {
  it('never substitutes another actionable request for an old notification link', async () => {
    open('/approvals/999');
    await screen.findByText('Request 999');
    expect(screen.queryByRole('button', { name: /^Approve$/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Fixture employee')).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/api/workflows/requests/999');
  });

  it('reports an intermediate decision as recorded rather than final approval', async () => {
    const success = vi.spyOn(toast, 'success');
    open('/approvals/10');
    fireEvent.click(await screen.findByRole('button', { name: /^Approve$/ }));
    await waitFor(() => { expect(success).toHaveBeenCalledWith('Approval recorded', {
      description: 'Waiting for the next approver.',
    }); });
    success.mockRestore();
  });

  it('keeps only failed batch items selected and reports each committed outcome accurately', async () => {
    const second = { ...request, requestId: 11, subject: { ecode: 'FIXTURE-11', name: 'Second fixture employee' } };
    vi.mocked(apiFetch).mockImplementation(path => {
      if (path === '/api/workflows/inbox') return Promise.resolve([request, second]);
      if (path === '/api/workflows/requests/11/act') return Promise.reject(new ApiError('Attendance has an HR override', 400));
      return Promise.resolve({ outcome: 'approved' });
    });
    const success = vi.spyOn(toast, 'success');
    const error = vi.spyOn(toast, 'error');
    open('/approvals');
    const firstCheck = await screen.findByRole('checkbox', { name: 'Select Fixture employee' });
    const secondCheck = screen.getByRole('checkbox', { name: 'Select Second fixture employee' });
    fireEvent.click(firstCheck); fireEvent.click(secondCheck);
    fireEvent.click(screen.getByRole('button', { name: 'Batch approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve selected' }));
    await waitFor(() => { expect(error).toHaveBeenCalledWith('1 decisions could not be saved', expect.any(Object)); });
    expect(success).toHaveBeenCalledWith('1 decisions recorded', { description: '1 approved; 0 waiting for the next approver.' });
    expect(firstCheck).not.toBeChecked();
    expect(secondCheck).toBeChecked();
  });

  it('lets the requester correct a sent-back OD and resubmit the same request', async () => {
    vi.mocked(apiFetch).mockImplementation(path => {
      if (path === '/api/workflows/inbox') return Promise.resolve([request]);
      if (path.endsWith('/resubmit')) return Promise.resolve({ ok: true });
      return Promise.resolve({ status: 'sent_back', type: 'od', payload: { kind: 'OD', ...request.payload }, canResubmit: true,
        steps: [{ stepNo: 1, action: 'sent_back', comment: 'Please confirm the visit', notifiedAt: request.notifiedAt, actedAt: request.notifiedAt }] });
    });
    open('/approvals/999');
    await screen.findByText('Please confirm the visit');
    fireEvent.change(screen.getByLabelText(/Revised reason/), { target: { value: 'Confirmed revised client visit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resubmit for approval' }));
    await waitFor(() => { expect(apiFetch).toHaveBeenCalledWith('/api/workflows/requests/999/resubmit', {
      method: 'POST', body: JSON.stringify({ payload: { kind: 'OD', ...request.payload,
        reason: 'Confirmed revised client visit', fromTime: null, toTime: null } }),
    }); });
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Resubmit for approval' })).not.toBeDisabled(); });
  });
});
