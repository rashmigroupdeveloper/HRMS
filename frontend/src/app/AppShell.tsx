/**
 * App shell — masthead + role-filtered pill nav + warm canvas (docs/05 §3).
 * Composed only from `frontend/src/ui` (§0.1 firewall) + local shell parts.
 *
 * Masthead affordances (docs/05 §3): brand → primary pill-nav (dark active
 * segment) → ⌘K command palette · approvals badge one-click-from-anywhere ·
 * theme toggle · identity menu. Skip-link + a mobile nav sheet round out a11y.
 */
import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CheckCheck, Menu, Search, X } from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { hasAnyPermission } from '../lib/session';
import { IconButton, ThemeToggle, Toaster, Tooltip } from '../ui';
import { isNavActive, navForUser } from './nav-config';
import { CommandPalette } from './CommandPalette';
import { UserMenu } from './UserMenu';
import { useInboxCount } from './useInboxCount';

interface AppShellProps {
  user: SessionUser;
  onSignedOut: () => void;
}

const APPROVAL_PERMS = ['leave.approve', 'ar.approve', 'od.approve', 'ot.approve', 'claims.approve'] as const;

export function AppShell({ user, onSignedOut }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = navForUser(user);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const canApprove = hasAnyPermission(user, APPROVAL_PERMS);
  const inboxCount = useInboxCount(canApprove);

  // ⌘K / Ctrl-K opens the palette from anywhere (docs/05 §6 #8).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Close the mobile sheet on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const pill = (active: boolean): string =>
    'u-press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-(--motion-micro) ' +
    (active ? 'bg-hero text-hero-ink shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-surface');

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-hero focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-hero-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-line/60 bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="u-press flex items-center gap-2.5"
            onClick={() => {
              void navigate('/');
            }}
          >
            <span className="grid size-8 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">R</span>
            <span className="hidden text-sm font-semibold text-ink sm:block">Rashmi HRMS</span>
          </button>

          <nav
            className="ml-2 hidden max-w-[min(100%,46rem)] items-center gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Primary"
          >
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={pill(isNavActive(location.pathname, item))}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Tooltip label="Search · ⌘K" side="bottom">
              <IconButton
                label="Open command palette (⌘K)"
                icon={<Search />}
                onClick={() => {
                  setPaletteOpen(true);
                }}
              />
            </Tooltip>

            {canApprove && (
              <Tooltip label="Approvals" side="bottom">
                <button
                  type="button"
                  onClick={() => {
                    void navigate('/approvals');
                  }}
                  aria-label={`Approvals${inboxCount > 0 ? ` — ${String(inboxCount)} waiting` : ''}`}
                  className="u-press relative grid size-10 place-items-center rounded-full bg-surface-2 text-ink-muted transition-colors hover:text-ink"
                >
                  <CheckCheck className="size-[1.15rem]" aria-hidden />
                  {inboxCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink tabular-nums ring-2 ring-surface">
                      {inboxCount > 99 ? '99+' : inboxCount}
                    </span>
                  )}
                </button>
              </Tooltip>
            )}

            <ThemeToggle />
            <UserMenu user={user} onSignedOut={onSignedOut} />

            <div className="lg:hidden">
              <IconButton
                label={mobileOpen ? 'Close menu' : 'Open menu'}
                icon={mobileOpen ? <X /> : <Menu />}
                onClick={() => {
                  setMobileOpen((value) => !value);
                }}
              />
            </div>
          </div>
        </div>

        {/* Mobile nav sheet — the pill row doesn't fit on small screens. */}
        {mobileOpen && (
          <nav
            className="border-t border-line/60 bg-surface px-4 py-3 lg:hidden"
            aria-label="Primary (mobile)"
            style={{ animation: 'u-pop var(--motion-short) var(--ease-out-strong)' }}
          >
            <div className="grid grid-cols-2 gap-1.5">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    'u-press rounded-row px-3.5 py-2.5 text-sm font-medium ' +
                    (isActive || isNavActive(location.pathname, item) ? 'bg-hero text-hero-ink' : 'bg-surface-2 text-ink')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:py-10">
        <Outlet />
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false);
        }}
        user={user}
      />
      <Toaster />
    </div>
  );
}
