/** SEC-04: preserve the interrupted action through password confirmation. */
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, apiFetch } from '../lib/api';
import { renderThemed } from '../test/render';
import { useStepUpAction } from './useStepUpAction';
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  apiFetch: vi.fn(),
}));
function Harness({ action }: { action: () => Promise<string> }) {
  const proof = useStepUpAction();
  const [result, setResult] = useState('Waiting');
  return (
    <>
      <button
        onClick={() => {
          void proof
            .run(action, 'Assign HR Operations to Synthetic User.')
            .then(setResult)
            .catch((error: unknown) => {
              setResult(error instanceof Error ? error.message : 'Failed');
            });
        }}
      >
        Assign role
      </button>
      <p>{result}</p>
      {proof.dialog}
    </>
  );
}
afterEach(() => {
  vi.resetAllMocks();
});
describe('password confirmation', () => {
  it('retries once after verification, retaining the dialog on a wrong password', async () => {
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('Re-enter password', 403, 'STEP_UP_REQUIRED'))
      .mockResolvedValue('Assigned');
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new Error('Wrong password'))
      .mockResolvedValueOnce({ steppedUpUntil: '2026-10-19T10:00:00Z' });
    renderThemed(<Harness action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Assign role' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Assign HR Operations to Synthetic User.',
    );
    await userEvent.type(screen.getByLabelText('Your password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password');
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Your password')).toHaveValue('');
    await userEvent.type(screen.getByLabelText('Your password'), 'correct');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Assigned')).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenLastCalledWith('/api/auth/step-up', {
      method: 'POST',
      body: JSON.stringify({ password: 'correct' }),
    });
  });
  it('cancels without replaying the mutation or verifying a password', async () => {
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('Re-enter password', 403, 'STEP_UP_REQUIRED'));
    renderThemed(<Harness action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Assign role' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Access change cancelled')).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it('never challenges an ordinary permission denial', async () => {
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new ApiError('Missing permission', 403));
    renderThemed(<Harness action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Assign role' }));
    expect(await screen.findByText('Missing permission')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
