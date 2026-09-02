/**
 * Button — the one button vocabulary in the product (docs/05 §7b). These tests
 * pin the states the spec enumerates, in BOTH themes.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { renderThemed, THEMES } from '../test/render';
import { runAxe } from '../test/axe';

describe('Button', () => {
  it.each(THEMES)('renders and is operable in the %s theme', async (theme) => {
    const onClick = vi.fn();
    const { container } = renderThemed(<Button onClick={onClick}>Save</Button>, theme);

    const button = screen.getByRole('button', { name: 'Save' });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    renderThemed(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
  });

  it('disabled: is not clickable and is exposed as disabled', async () => {
    const onClick = vi.fn();
    renderThemed(
      <Button disabled onClick={onClick}>
        Locked
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Locked' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading: blocks the click AND announces busy (a spinner alone is not a state)', async () => {
    const onClick = vi.fn();
    renderThemed(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    // Double-submit protection: this is what stops two payroll runs.
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading replaces the leading icon rather than showing both', () => {
    renderThemed(
      <Button loading leadingIcon={<span data-testid="leading" />} trailingIcon={<span data-testid="trailing" />}>
        Saving
      </Button>,
    );
    expect(screen.queryByTestId('leading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trailing')).not.toBeInTheDocument();
  });

  it('is keyboard reachable and activates on Enter', async () => {
    const onClick = vi.fn();
    renderThemed(<Button onClick={onClick}>Approve</Button>);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['primary', 'hero', 'secondary', 'ghost', 'danger'] as const)(
    'variant %s keeps its accessible name and press affordance',
    (variant) => {
      renderThemed(<Button variant={variant}>Act</Button>);
      const button = screen.getByRole('button', { name: 'Act' });
      // Every pressable element carries the press feedback class (docs/05 §2.3).
      expect(button.className).toContain('u-press');
    },
  );
});
