/**
 * ConfirmModal — the last thing standing between a click and an irreversible
 * act: payroll finalize, month lock, exit conversion (docs/05 §4.5, §8).
 *
 * The typed-confirmation gate is the highest-consequence behaviour in the kit,
 * so it is pinned hard: near-misses, case differences and whitespace must all
 * keep the confirm button disabled.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmModal } from './ConfirmModal';
import { renderThemed, THEMES } from '../test/render';
import { runAxe } from '../test/axe';

function setup(overrides: Partial<Parameters<typeof ConfirmModal>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const utils = renderThemed(
    <ConfirmModal
      open
      onClose={onClose}
      onConfirm={onConfirm}
      title="Lock attendance month"
      description="This freezes attendance for June 2026."
      {...overrides}
    />,
  );
  return { onConfirm, onClose, ...utils };
}

describe('ConfirmModal', () => {
  it('renders as a modal dialog with an accessible name', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Lock attendance month' })).toBeInTheDocument();
  });

  it('is closed by Escape — an accidental open is always escapable', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms on click when no typed confirmation is required', async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  describe('typed confirmation (the destructive-action gate)', () => {
    const PHRASE = 'LOCK 2026-06';

    it('keeps confirm disabled until the phrase matches EXACTLY', async () => {
      const { onConfirm } = setup({ typedConfirmation: PHRASE, confirmLabel: 'Lock month' });
      const confirm = screen.getByRole('button', { name: 'Lock month' });
      expect(confirm).toBeDisabled();

      const field = screen.getByRole('textbox');
      await userEvent.type(field, PHRASE);

      expect(confirm).toBeEnabled();
      await userEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a prefix', 'LOCK 2026-0'],
      ['the wrong month', 'LOCK 2026-07'],
      ['wrong case', 'lock 2026-06'],
      ['trailing whitespace', 'LOCK 2026-06 '],
    ])('stays disabled for %s', async (_label, attempt) => {
      const { onConfirm } = setup({ typedConfirmation: PHRASE, confirmLabel: 'Lock month' });
      await userEvent.type(screen.getByRole('textbox'), attempt);

      expect(screen.getByRole('button', { name: 'Lock month' })).toBeDisabled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('clears the typed phrase between openings, so a second open re-gates', async () => {
      const PHRASE2 = 'FINALIZE JUNE 2026';
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      const { rerender } = renderThemed(
        <ConfirmModal
          open
          onClose={onClose}
          onConfirm={onConfirm}
          title="Finalize payroll"
          typedConfirmation={PHRASE2}
          confirmLabel="Finalize"
        />,
      );
      await userEvent.type(screen.getByRole('textbox'), PHRASE2);
      expect(screen.getByRole('button', { name: 'Finalize' })).toBeEnabled();

      // Close, then reopen — the gate must be armed again, not pre-satisfied.
      rerender(
        <ConfirmModal
          open={false}
          onClose={onClose}
          onConfirm={onConfirm}
          title="Finalize payroll"
          typedConfirmation={PHRASE2}
          confirmLabel="Finalize"
        />,
      );
      rerender(
        <ConfirmModal
          open
          onClose={onClose}
          onConfirm={onConfirm}
          title="Finalize payroll"
          typedConfirmation={PHRASE2}
          confirmLabel="Finalize"
        />,
      );

      expect(screen.getByRole('button', { name: 'Finalize' })).toBeDisabled();
    });
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { baseElement } = renderThemed(
      <ConfirmModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Lock attendance month"
        description="This freezes attendance."
        typedConfirmation="LOCK"
        danger
      />,
      theme,
    );
    // The modal portals out of the container, so axe runs on the whole body.
    await expect(runAxe(baseElement)).resolves.toHaveNoViolations();
  });
});
