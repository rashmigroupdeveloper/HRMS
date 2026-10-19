import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { ConnectedAccountsPanel } from './ConnectedAccountsPanel';

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it('requires named selection and a verification reason before linking accounts', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ links: [] });
  render(<ConnectedAccountsPanel />);
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/sso/links');
  });
  expect(screen.getByRole('button', { name: 'Verify and link accounts' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Verification / change reason'), {
    target: { value: 'Identity checked' },
  });
  expect(screen.getByRole('button', { name: 'Verify and link accounts' })).toBeDisabled();
  expect(apiFetch).toHaveBeenCalledTimes(1);
});

it('retains the reason and shows a failed unlink instead of claiming success', async () => {
  vi.mocked(apiFetch)
    .mockResolvedValueOnce({
      links: [
        {
          id: 7,
          userId: 3,
          email: 'person@hrms.invalid',
          clientId: 'ats',
          externalSubject: '9',
          active: true,
        },
      ],
    })
    .mockRejectedValueOnce(new Error('Current authority unavailable'));
  render(<ConnectedAccountsPanel />);
  const unlink = await screen.findByRole('button', { name: 'Unlink' });
  expect(unlink).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Verification / change reason'), {
    target: { value: 'Access removed' },
  });
  fireEvent.click(unlink);
  expect(await screen.findByRole('alert')).toHaveTextContent('Current authority unavailable');
  expect(screen.getByLabelText('Verification / change reason')).toHaveValue('Access removed');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(apiFetch).toHaveBeenLastCalledWith('/api/sso/links/7/unlink', {
    method: 'POST',
    body: JSON.stringify({ reason: 'Access removed' }),
  });
});

it('reports unavailable account lists visibly', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('Access denied'));
  render(<ConnectedAccountsPanel />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
});
