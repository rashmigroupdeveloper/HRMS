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

it('loads older links using the server cursor without hiding the current page', async () => {
  const row = (id: number) => ({
    id,
    userId: id,
    email: `person${String(id)}@hrms.invalid`,
    clientId: 'ats',
    externalSubject: String(id),
    active: false,
  });
  vi.mocked(apiFetch)
    .mockResolvedValueOnce({ links: Array.from({ length: 50 }, (_, index) => row(100 - index)) })
    .mockResolvedValueOnce({ links: [row(50)] });
  render(<ConnectedAccountsPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Load more connected accounts' }));
  expect(await screen.findByText('person50@hrms.invalid')).toBeInTheDocument();
  expect(screen.getByText('person100@hrms.invalid')).toBeInTheDocument();
  expect(apiFetch).toHaveBeenLastCalledWith('/api/sso/links?cursor=51');
  expect(
    screen.queryByRole('button', { name: 'Load more connected accounts' }),
  ).not.toBeInTheDocument();
});
