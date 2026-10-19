import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { SsoAuthorizePage } from './SsoAuthorizePage';

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it('does not exchange a grant until the signed-in person explicitly continues', () => {
  render(<SsoAuthorizePage />);
  expect(apiFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Continue to ATS' })).toBeEnabled();
});

it('keeps the person on HRMS with a retry when no valid connected account exists', async () => {
  window.history.replaceState(
    {},
    '',
    '/connect/ats?clientId=ats&redirectUri=https%3A%2F%2Fats.invalid%2Fcallback&challenge=abc&state=xyz',
  );
  vi.mocked(apiFetch).mockRejectedValue(new Error('Connected account unavailable'));
  render(<SsoAuthorizePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to ATS' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connected account unavailable');
  expect(screen.getByRole('button', { name: 'Continue to ATS' })).toBeEnabled();
  expect(apiFetch).toHaveBeenCalledWith('/api/sso/authorize', {
    method: 'POST',
    body: JSON.stringify({
      clientId: 'ats',
      redirectUri: 'https://ats.invalid/callback',
      challenge: 'abc',
      state: 'xyz',
    }),
  });
  window.history.replaceState({}, '', '/');
});
