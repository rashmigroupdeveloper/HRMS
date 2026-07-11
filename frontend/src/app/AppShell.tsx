/**
 * App shell — masthead + role-filtered pill nav + cream canvas (docs/05 §3).
 * Composed only from `frontend/src/ui` (§0.1 firewall).
 */
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Search } from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { logout } from '../lib/session';
import { IconButton, ThemeToggle, Toaster, Tooltip } from '../ui';
import { isNavActive, navForUser } from './nav-config';

interface AppShellProps {
  user: SessionUser;
  onSignedOut: () => void;
}

export function AppShell({ user, onSignedOut }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = navForUser(user);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <button
            type="button"
            className="flex items-center gap-2 u-press"
            onClick={() => {
              void navigate('/');
            }}
          >
            <span className="grid size-8 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
              R
            </span>
            <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>
          </button>

          <nav
            className="ml-4 hidden max-w-[min(100%,42rem)] items-center gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 md:flex"
            aria-label="Primary"
          >
            {nav.map((item) => {
              const active = isNavActive(location.pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={
                    'u-press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-(--motion-micro) ' +
                    (active
                      ? 'bg-hero text-hero-ink'
                      : 'text-ink-muted hover:text-ink')
                  }
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Tooltip label="Search · ⌘K" side="bottom">
              <IconButton label="Search (⌘K)" icon={<Search />} />
            </Tooltip>
            <Tooltip label="Notifications" side="bottom">
              <IconButton label="Notifications" icon={<Bell />} />
            </Tooltip>
            <ThemeToggle />
            <Tooltip label="Sign out" side="bottom">
              <IconButton
                label="Sign out"
                icon={<LogOut />}
                onClick={() => {
                  void logout().finally(onSignedOut);
                }}
              />
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>

      <Toaster />
    </div>
  );
}
