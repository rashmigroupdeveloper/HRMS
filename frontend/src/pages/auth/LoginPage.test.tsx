/**
 * Login is the product's front door (docs/05). These tests pin the Crextio
 * split: one charcoal hero, one gold CTA, form on a raised surface — not a
 * floating stack on flat canvas.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionUser } from '../../lib/session';
import { LoginPage } from './LoginPage';
import { renderThemed, THEMES } from '../../test/render';
import { runAxe } from '../../test/axe';

const SESSION: SessionUser = {
  id: 1,
  email: 'a@b.test',
  employeeId: 1,
  roles: [],
  permissions: [],
  mfa: { enrolled: false, required: false, enforcement: 'grace' },
  steppedUpUntil: null,
};

function renderLogin() {
  return renderThemed(<LoginPage loadSession={vi.fn(() => Promise.resolve(SESSION))} />);
}

describe('LoginPage', () => {
  it.each(THEMES)('is operable and axe-clean in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <LoginPage loadSession={vi.fn(() => Promise.resolve(SESSION))} />,
      theme,
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });

  it('keeps one charcoal hero panel with grain', () => {
    renderLogin();
    const hero = screen.getByRole('complementary');
    expect(hero).toHaveClass('u-grain');
    expect(hero).toHaveClass('bg-hero');
  });

  it('sits the form on a raised surface card', () => {
    renderLogin();
    const form = screen.getByRole('form', { name: 'Employee sign-in' });
    expect(form.closest('.u-shadow-float')).toBeTruthy();
  });

  it('gives the hero headline a gold underline — the single accent on the page', () => {
    renderLogin();
    expect(document.querySelector('.u-gold-sweep')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/people, attendance and payroll/i);
  });

  it('opens the forgot-password form on the same page', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('form', { name: 'Forgot password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });
});
