import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRouted } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { BetaFeedback } from './BetaFeedback';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
const user = { id: 1, email: 'reporter@example.com', employeeId: 1, roles: ['employee'], permissions: ['beta.feedback.submit'] };
const reporter = { name: 'Beta Reporter', ecode: 'RML012345', roles: ['employee'], maxScreenshotBytes: 3000000 };
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation(route => route.endsWith('/context') ? Promise.resolve(reporter) : Promise.resolve({ id: 42 }));
});
it('opens and closes from the right-edge tab while preserving the feedback draft', async () => {
  const u = userEvent.setup(); renderRouted(<BetaFeedback user={user} />);
  await u.click(screen.getByRole('button', { name: 'Open beta feedback' }));
  expect(await screen.findByText('Beta Reporter · RML012345')).toBeInTheDocument();
  await u.type(screen.getByLabelText(/Your feedback/), 'The page needs a clearer action.');
  await u.click(screen.getByRole('button', { name: 'Close panel' }));
  await u.click(screen.getByRole('button', { name: 'Open beta feedback' }));
  expect(screen.getByLabelText(/Your feedback/)).toHaveValue('The page needs a clearer action.');
});
it('uploads, previews and removes an optional screenshot; sends page and text without editable identity', async () => {
  const u = userEvent.setup(); renderRouted(<BetaFeedback user={user} />);
  await u.click(screen.getByRole('button', { name: 'Open beta feedback' }));
  await screen.findByText('Beta Reporter · RML012345');
  await u.type(screen.getByLabelText(/Your feedback/), 'Search is hard to find.');
  fireEvent.change(screen.getByLabelText('Upload screenshot file'), { target: { files: [new File(['image'], 'test.png', { type: 'image/png' })] } });
  expect(await screen.findByAltText('Screenshot attached to your feedback')).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Remove screenshot' }));
  expect(screen.queryByAltText('Screenshot attached to your feedback')).not.toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Send feedback' }));
  const call = vi.mocked(apiFetch).mock.calls.find(([route]) => route === '/api/beta-feedback');
  const payload = JSON.parse(typeof call?.[1]?.body === 'string' ? call[1].body : '{}') as Record<string, unknown>;
  expect(payload).toMatchObject({ pagePath: '/', body: 'Search is hard to find.' });
  expect(payload['name']).toBeUndefined(); expect(payload['roles']).toBeUndefined(); expect(payload['screenshot']).toBeUndefined();
});
it('keeps the draft and request identifier after failure so retry does not duplicate a report', async () => {
  const u = userEvent.setup(); let attempts = 0;
  vi.mocked(apiFetch).mockImplementation(route => {
    if (route.endsWith('/context')) return Promise.resolve(reporter);
    attempts++; return attempts === 1 ? Promise.reject(new Error('Connection interrupted')) : Promise.resolve({ id: 43 });
  });
  renderRouted(<BetaFeedback user={user} />);
  await u.click(screen.getByRole('button', { name: 'Open beta feedback' })); await screen.findByText('Beta Reporter · RML012345');
  await u.type(screen.getByLabelText(/Your feedback/), 'A retry should preserve this report.');
  await u.click(screen.getByRole('button', { name: 'Send feedback' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  expect(screen.getByLabelText(/Your feedback/)).toHaveValue('A retry should preserve this report.');
  await u.click(screen.getByRole('button', { name: 'Send feedback' }));
  await waitFor(() => { expect(attempts).toBe(2); });
  const calls = vi.mocked(apiFetch).mock.calls.filter(([route]) => route === '/api/beta-feedback');
  expect(calls[0]?.[1]?.body).toBe(calls[1]?.[1]?.body);
});
it('leaves upload available when screen capture is unavailable', async () => {
  const u = userEvent.setup(); renderRouted(<BetaFeedback user={user} />);
  await u.click(screen.getByRole('button', { name: 'Open beta feedback' })); await screen.findByText('Beta Reporter · RML012345');
  await u.click(screen.getByRole('button', { name: 'Capture this page' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Use Upload screenshot instead');
  expect(screen.getByRole('button', { name: 'Upload screenshot' })).toBeEnabled();
});
