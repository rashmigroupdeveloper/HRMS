/**
 * App shell is the Crextio masthead (docs/05 §3 + 12 §7): wordmark, center
 * pill nav with a dark active segment, utilities on the right. The left
 * admin rail is the greytHR anti-reference — these tests pin that it is gone.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionUser } from '../lib/session';
import { AppShell } from './AppShell';

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
});

function session(roles: string[], permissions: string[]): SessionUser {
  return {
    id: 1,
    email: 'a@b.test',
    employeeId: 1,
    roles,
    permissions,
    mfa: { enrolled: false, required: false, enforcement: 'grace' },
    steppedUpUntil: null,
  };
}

function renderShell(user: SessionUser, path = '/'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell user={user} onSignedOut={() => undefined} />}>
          <Route path="*" element={<h1>Page body</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const ESS = session(
  ['employee'],
  ['attendance.own', 'leave.own', 'employee.read', 'employee.compensation.read'],
);

describe('AppShell', () => {
  it('has no left rail and no collapse control', () => {
    renderShell(ESS);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /expand sidebar/i })).not.toBeInTheDocument();
  });

  it('does not put a page heading in the masthead — the page owns the h1', () => {
    renderShell(ESS);
    expect(screen.getByRole('heading', { name: 'Page body' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).queryByRole('heading')).not.toBeInTheDocument();
  });

  it('centers the pill cluster on the canvas, not in leftover flex space', () => {
    renderShell(ESS);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.parentElement).toHaveClass('left-1/2');
  });

  it('floats the pill cluster on the cream canvas, not inside a filled admin bar', () => {
    renderShell(ESS);
    const banner = screen.getByRole('banner');
    expect(banner.className).not.toMatch(/\bbg-canvas\b/);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveClass('u-shadow-float');
  });

  it('puts ESS destinations in the center pill nav, not Policies', () => {
    renderShell(ESS);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toHaveTextContent('Home');
    expect(nav).toHaveTextContent('My Attendance');
    expect(nav).toHaveTextContent('My Leave');
    expect(nav).not.toHaveTextContent('Policies');
    expect(screen.queryByRole('navigation', { name: 'Daily' })).not.toBeInTheDocument();
  });

  it('slides a charcoal thumb under the active pill, not a gold fill', () => {
    renderShell(ESS, '/my/attendance');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.querySelector('[data-pill-thumb]')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { current: 'page' })).not.toHaveClass('bg-accent');
  });

  it('opens overflow destinations from More', async () => {
    const user = userEvent.setup();
    renderShell(ESS);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: 'Policies' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Travel' })).toBeInTheDocument();
  });
});
