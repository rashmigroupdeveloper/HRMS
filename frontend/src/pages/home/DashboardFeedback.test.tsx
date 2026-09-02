/**
 * Shared loading and error surfaces (docs/05 §7, §6 kill-list #3 and #5).
 *
 * These two components back roughly fifteen pages, so a gap here is a gap
 * everywhere. `DashboardError` shipped without `role="alert"`: the failure was
 * drawn but never ANNOUNCED, so a screen-reader user got silence where a
 * sighted user got a red card.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardError, DashboardSkeleton } from './DashboardFeedback';
import { renderThemed, THEMES } from '../../test/render';
import { runAxe } from '../../test/axe';

describe('DashboardError', () => {
  it('announces the failure to assistive tech, not just visually', () => {
    renderThemed(<DashboardError message="Could not load." onRetry={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('Could not load.');
  });

  it('always offers a recovery path (§6 kill-list #5 — no error without a way out)', async () => {
    const onRetry = vi.fn();
    renderThemed(<DashboardError message="Network down." onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('reassures that nothing was lost — filters and session survive an error', () => {
    renderThemed(<DashboardError message="Timeout." onRetry={vi.fn()} />);
    expect(screen.getByText(/filters are unchanged/i)).toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <DashboardError message="Could not load." onRetry={vi.fn()} />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});

describe('DashboardSkeleton', () => {
  it('marks the region busy and hides the bones from assistive tech', () => {
    const { container } = renderThemed(<DashboardSkeleton />);
    const region = container.querySelector('[aria-busy="true"]');
    expect(region).not.toBeNull();
    // Bones are decorative — a screen reader must not read empty boxes.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(<DashboardSkeleton />, theme);
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});
