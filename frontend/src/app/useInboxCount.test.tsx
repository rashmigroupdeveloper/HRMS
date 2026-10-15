import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { apiFetch } from '../lib/api';
import { useInboxCount } from './useInboxCount';
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
beforeEach(() => { vi.mocked(apiFetch).mockReset().mockResolvedValue([{}]); });
function Badge() { return <output aria-label="Approval count">{useInboxCount(true)}</output>; }
it('refreshes the masthead badge immediately after a committed workflow change', async () => {
  render(<Badge />);
  await screen.findByText('1');
  vi.mocked(apiFetch).mockResolvedValue([]);
  act(() => { window.dispatchEvent(new Event('hrms:workflow-changed')); });
  await screen.findByText('0');
  expect(apiFetch).toHaveBeenCalledTimes(2);
});
