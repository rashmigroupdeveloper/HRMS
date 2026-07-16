/**
 * App shell — sidebar rail + slim top bar + warm canvas (docs/05 §3, §7
 * "≥1024px = sidebar-capable shell"). Composed only from `frontend/src/ui`
 * (§0.1 firewall) + local shell parts.
 *
 * Layout: role-filtered nav lives in the left rail (collapsible to an icon
 * rail, remembered per user — state-preservation §6). The top bar keeps the
 * masthead affordances one-click-from-anywhere (docs/05 §3): page context ·
 * ⌘K command palette · approvals badge · theme toggle · identity menu. On
 * mobile the rail becomes an off-canvas drawer. Skip-link rounds out a11y.
 */
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CheckCheck, Menu, Search } from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { hasAnyPermission } from '../lib/session';
import { cn, IconButton, ThemeToggle, Toaster, Tooltip } from '../ui';
import { isNavActive, navForUser } from './nav-config';
import { Sidebar } from './Sidebar';
import { AccountMenu } from './AccountMenu';
import { CommandPalette } from './CommandPalette';
import { useInboxCount } from './useInboxCount';

interface AppShellProps {
  user: SessionUser;
  onSignedOut: () => void;
}

const APPROVAL_PERMS = ['leave.approve', 'ar.approve', 'od.approve', 'ot.approve', 'claims.approve'] as const;

const COLLAPSE_KEY = 'rashmi.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell({ user, onSignedOut }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = navForUser(user);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const canApprove = hasAnyPermission(user, APPROVAL_PERMS);
  const inboxCount = useInboxCount(canApprove);

  // Page context for the top bar — the most specific active nav item wins so
  // /admin/settings reads "Settings", not the broader "Users & Roles".
  const activeItem = nav
    .filter((item) => isNavActive(location.pathname, item))
    .sort((a, b) => (b.match ?? b.to).length - (a.match ?? a.to).length)[0];
  const pageTitle = activeItem?.label ?? 'Rashmi HRMS';

  const toggleCollapsed = (): void => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* private mode / storage disabled — the rail simply won't persist. */
      }
      return next;
    });
  };

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

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll behind the mobile drawer + close it on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-hero focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-hero-ink"
      >
        Skip to content
      </a>

      {/* Desktop rail — sticky full-height; width snaps between rail/expanded
          (docs/05 §2.4: no width animation on a hot path). */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 lg:block',
          collapsed ? 'w-[4.75rem]' : 'w-64',
        )}
      >
        <Sidebar nav={nav} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line/60 bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="lg:hidden">
              <IconButton
                label="Open navigation"
                icon={<Menu />}
                onClick={() => {
                  setMobileOpen(true);
                }}
              />
            </div>

            <h1 className="truncate text-base font-semibold text-ink">{pageTitle}</h1>

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
              <AccountMenu user={user} onSignedOut={onSignedOut} />
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-8 sm:px-6 lg:py-10">
          <div className="mx-auto max-w-[1280px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile drawer — the rail as an off-canvas sheet (docs/05 §7 adaptive-nav). */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => {
              setMobileOpen(false);
            }}
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]"
          />
          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[82%]"
            style={{ animation: 'u-slide-in-left var(--motion-short) var(--ease-drawer)' }}
          >
            <Sidebar
              nav={nav}
              collapsed={false}
              onNavigate={() => {
                setMobileOpen(false);
              }}
            />
          </div>
        </div>
      )}

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
