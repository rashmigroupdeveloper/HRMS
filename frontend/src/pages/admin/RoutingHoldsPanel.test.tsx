import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { runAxe } from '../../test/axe';
import { THEMES, renderThemed } from '../../test/render';
import { apiFetch, ApiError } from '../../lib/api';
import { RoutingHoldsPanel } from './RoutingHoldsPanel';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
const hold = { requestId: 91, type: 'regularization', subjectEmployeeId: 45, createdAt: '2026-10-17T03:30:00Z' };
beforeEach(() => {
  sessionStorage.clear(); vi.mocked(apiFetch).mockReset().mockResolvedValue([hold]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function repair() {
  render(<RoutingHoldsPanel userId={7} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review routing 91' }));
  return screen.getByLabelText(/Routing repair note/);
}
describe('WF-01/04 routing recovery', () => {
  it.each(THEMES)('keeps the loaded queue and repair form accessible in %s', async theme => {
    renderThemed(<main><h1>Approval chains</h1><RoutingHoldsPanel userId={7} /></main>, theme);
    fireEvent.click(await screen.findByRole('button', { name: 'Review routing 91' }));
    expect(await runAxe(document.body)).toHaveNoViolations();
  });
  it('reads a bounded queue and never submits merely by opening a request', async () => {
    await repair();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('/api/workflows/routing-holds?limit=26&offset=0');
    expect(screen.getByText(/These requests have not been approved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Approve$/ })).not.toBeInTheDocument();
  });
  it('requires a meaningful note, focuses it and prevents a request without it', async () => {
    const note = await repair(); fireEvent.change(note, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry routing' }));
    expect(await screen.findByText('Describe the routing repair before retrying.')).toBeInTheDocument();
    expect(note).toHaveFocus(); expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  for (const [state, text] of [
    ['awaiting_approver', /Routing restored.*awaiting their decision/],
    ['held_for_hr', /Still waiting for HR: no eligible approver/],
    ['lapsed', /request has lapsed and was not approved/],
  ] as const) {
    it(`reports ${state} without claiming approval`, async () => {
      vi.mocked(apiFetch).mockImplementation(path => Promise.resolve(path.includes('retry-routing') ? { routingState: state } : [hold]));
      const note = await repair(); fireEvent.change(note, { target: { value: '  Restored active reporting manager  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Retry routing' }));
      expect(await screen.findByRole('status')).toHaveTextContent(text);
      expect(apiFetch).toHaveBeenCalledWith('/api/workflows/requests/91/retry-routing', {
        method: 'POST', body: JSON.stringify({ requestId: 91, reason: 'Restored active reporting manager' }),
      });
      expect(sessionStorage.getItem('hrms.routing-repair:7:91')).toBeNull();
    });
  }
  it('preserves the repair note on a forbidden or failed retry', async () => {
    vi.mocked(apiFetch).mockImplementation(path => path.includes('retry-routing') ? Promise.reject(new ApiError('Outside your permitted scope', 403)) : Promise.resolve([hold]));
    const note = await repair(); fireEvent.change(note, { target: { value: 'Repair evidence to preserve' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry routing' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Outside your permitted scope');
    expect(note).toHaveValue('Repair evidence to preserve');
    expect(sessionStorage.getItem('hrms.routing-repair:7:91')).toBe('Repair evidence to preserve');
  });
  it('restores a cancelled draft for the same user and request only', async () => {
    const note = await repair(); fireEvent.change(note, { target: { value: 'Manager repair draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review routing 91' }));
    expect(screen.getByLabelText(/Routing repair note/)).toHaveValue('Manager repair draft');
    cleanup(); render(<RoutingHoldsPanel userId={8} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review routing 91' }));
    expect(screen.getByLabelText(/Routing repair note/)).toHaveValue('');
  });
  it('retains a single in-flight retry despite repeated clicks', async () => {
    let finish: ((value: { routingState: string }) => void) | undefined;
    const pending = new Promise<{ routingState: string }>(resolve => { finish = resolve; });
    vi.mocked(apiFetch).mockImplementation(path => path.includes('retry-routing') ? pending : Promise.resolve([hold]));
    const note = await repair(); fireEvent.change(note, { target: { value: 'Restored manager' } });
    const retry = screen.getByRole('button', { name: 'Retry routing' }); fireEvent.click(retry); fireEvent.click(retry);
    expect(retry).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(vi.mocked(apiFetch).mock.calls.filter(([path]) => path.includes('retry-routing'))).toHaveLength(1);
    finish?.({ routingState: 'awaiting_approver' });
    await screen.findByRole('status');
  });
  it('pages without treating the lookahead row as part of the current page', async () => {
    vi.mocked(apiFetch).mockImplementation(path => Promise.resolve(path.includes('offset=25') ? [] : Array.from({ length: 26 }, (_,i) => ({ ...hold, requestId: i + 1 }))));
    render(<RoutingHoldsPanel userId={7} />);
    await screen.findByRole('button', { name: 'Review routing 25' });
    expect(screen.queryByRole('button', { name: 'Review routing 26' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next holds' }));
    await screen.findByText('No more routing holds');
    expect(apiFetch).toHaveBeenLastCalledWith('/api/workflows/routing-holds?limit=26&offset=25');
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await screen.findByRole('button', { name: 'Review routing 1' });
  });
  it('shows a list failure and allows a deliberate reload', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('Routing queue unavailable', 503)).mockResolvedValue([]);
    render(<RoutingHoldsPanel userId={7} />);
    expect(await screen.findByText('Routing queue unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => { expect(screen.getByText('No routing holds')).toBeInTheDocument(); });
  });
});
