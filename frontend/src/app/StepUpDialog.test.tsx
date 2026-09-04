/**
 * SEC-04 — the step-up dialog's contract, which is a UX contract as much as a
 * security one (docs/05 §6 kill-list):
 *   · it says WHY it is asking,
 *   · it RETRIES what the user was doing, so nothing is lost,
 *   · it asks for the second factor only when the account has one,
 *   · it is a real dialog for assistive technology.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAxe } from '../test/axe';
import { StepUpDialog } from './StepUpDialog';

function mockFetchOk(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ steppedUpUntil: new Date(Date.now() + 600_000).toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StepUpDialog', () => {
  it('renders nothing until a request is made', () => {
    const { container } = render(
      <StepUpDialog request={null} onClose={vi.fn()} onElevated={vi.fn()} mfaEnrolled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('states the reason it is asking, so the friction is legible', () => {
    render(
      <StepUpDialog
        request={{ reason: 'Viewing unmasked PAN for 3 employees.', retry: vi.fn() }}
        onClose={vi.fn()}
        onElevated={vi.fn()}
        mfaEnrolled={false}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Viewing unmasked PAN for 3 employees.')).toBeInTheDocument();
  });

  it('asks for a code only when the account has a second factor', () => {
    const { rerender } = render(
      <StepUpDialog
        request={{ reason: 'x', retry: vi.fn() }}
        onClose={vi.fn()}
        onElevated={vi.fn()}
        mfaEnrolled={false}
      />,
    );
    expect(screen.queryByLabelText(/authenticator/i)).not.toBeInTheDocument();

    rerender(
      <StepUpDialog
        request={{ reason: 'x', retry: vi.fn() }}
        onClose={vi.fn()}
        onElevated={vi.fn()}
        mfaEnrolled
      />,
    );
    expect(screen.getByLabelText(/authenticator/i)).toBeInTheDocument();
  });

  it('RETRIES the interrupted action after a successful step-up', async () => {
    mockFetchOk();
    const retry = vi.fn();
    const onElevated = vi.fn();
    const onClose = vi.fn();

    render(
      <StepUpDialog
        request={{ reason: 'Resetting a second factor.', retry }}
        onClose={onClose}
        onElevated={onElevated}
        mfaEnrolled={false}
      />,
    );

    await userEvent.type(screen.getByLabelText(/your password/i), 'Kharagpur2026x');
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(retry).toHaveBeenCalledTimes(1);
    });
    expect(onElevated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the user in place and shows the error when the password is wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'That password is not right' }), { status: 401 }),
        ),
      ),
    );
    const retry = vi.fn();
    render(
      <StepUpDialog
        request={{ reason: 'x', retry }}
        onClose={vi.fn()}
        onElevated={vi.fn()}
        mfaEnrolled={false}
      />,
    );

    await userEvent.type(screen.getByLabelText(/your password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not right/i);
    expect(retry).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('confirm stays disabled until a password is typed', async () => {
    render(
      <StepUpDialog
        request={{ reason: 'x', retry: vi.fn() }}
        onClose={vi.fn()}
        onElevated={vi.fn()}
        mfaEnrolled={false}
      />,
    );
    const confirm = screen.getByRole('button', { name: /confirm/i });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/your password/i), 'a');
    expect(confirm).toBeEnabled();
  });

  it('has no accessibility violations', async () => {
    const { baseElement } = render(
      <StepUpDialog
        request={{ reason: 'Viewing salary details.', retry: vi.fn() }}
        onClose={vi.fn()}
        onElevated={vi.fn()}
        mfaEnrolled
      />,
    );
    expect(await runAxe(baseElement)).toHaveNoViolations();
  });
});
