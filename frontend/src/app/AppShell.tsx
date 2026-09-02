/**
 * App shell — Crextio masthead + center pill nav (docs/05 §3, 12 §7).
 * Wordmark left, dark-active pills center, ⌘K / approvals / identity right.
 * Mobile uses a four-action bottom bar, not an off-canvas reprint of the catalog.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CheckCheck, Search, Settings } from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { hasAnyPermission, hasPermission } from '../lib/session';
import { IconButton, ThemeToggle, Toaster, Tooltip } from '../ui';
import { isNavActive, mobileTabs, navForUser, splitNav } from './nav-config';
import { AccountMenu } from './AccountMenu';
import { BottomBar } from './BottomBar';
import { CommandPalette } from './CommandPalette';
import { NavMoreList } from './NavMoreList';
import { PillNav } from './PillNav';
import { useInboxCount } from './useInboxCount';

interface AppShellProps {
  user: SessionUser;
  onSignedOut: () => void;
}

const APPROVAL_PERMS = ['leave.approve', 'ar.approve', 'od.approve', 'ot.approve', 'claims.approve'] as const;

export function AppShell({ user, onSignedOut }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const catalog = useMemo(() => navForUser(user), [user]);
  const { pills, more } = useMemo(() => splitNav(catalog), [catalog]);
  const tabs = useMemo(() => mobileTabs(pills), [pills]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );
  const moreRef = useRef<HTMLDivElement>(null);
  const canApprove = hasAnyPermission(user, APPROVAL_PERMS);
  const inboxCount = useInboxCount(canApprove);
  const moreActive = more.some((item) => isNavActive(location.pathname, item));

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = (): void => {
      setCompact(mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
    };
  }, []);

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

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    if (compact) {
      return () => {
        document.removeEventListener('keydown', onKey);
      };
    }
    const onDoc = (event: MouseEvent): void => {
      if (moreRef.current?.contains(event.target as Node)) return;
      setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [moreOpen, compact]);

  const closeMore = (): void => {
    setMoreOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-hero focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-hero-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <Link
            to={pills[0]?.to ?? '/'}
            aria-label="Rashmi HRMS — home"
            className="u-press flex shrink-0 items-center gap-2.5"
          >
            <span className="grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
              R
            </span>
            <span className="hidden text-[15px] font-semibold tracking-wide text-ink sm:inline">
              Rashmi
            </span>
          </Link>

          {!compact ? (
            <div ref={moreRef} className="relative flex min-w-0 flex-1 justify-center">
              <PillNav
                pills={pills}
                moreCount={more.length}
                moreOpen={moreOpen}
                moreActive={moreActive}
                onToggleMore={() => {
                  setMoreOpen((value) => !value);
                }}
              />
              {moreOpen && more.length > 0 ? (
                <div role="menu" className="u-pop-in u-shadow-float absolute top-full z-40 mt-2 w-72 overflow-hidden rounded-tile bg-surface">
                  <NavMoreList items={more} pathname={location.pathname} onNavigate={closeMore} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {hasPermission(user, 'admin.settings') ? (
              <Link
                to="/admin/settings"
                className="u-press u-shadow-card hidden items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-ink lg:inline-flex"
              >
                <Settings className="size-4" aria-hidden />
                Settings
              </Link>
            ) : null}

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
                  className="u-press u-shadow-card relative grid size-10 place-items-center rounded-full bg-surface text-ink-muted transition-colors hover:text-ink"
                >
                  <CheckCheck className="size-[1.15rem]" aria-hidden />
                  {inboxCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink tabular-nums ring-2 ring-canvas">
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

      <main
        id="main"
        className={compact ? 'flex-1 px-4 pb-24 pt-6 sm:px-6' : 'flex-1 px-6 pb-12 pt-6 lg:px-8 lg:pt-8'}
      >
        <div className="mx-auto max-w-[1280px]">
          <Outlet />
        </div>
      </main>

      {compact ? (
        <BottomBar
          tabs={tabs}
          moreOpen={moreOpen}
          moreActive={moreActive}
          onToggleMore={() => {
            setMoreOpen((value) => !value);
          }}
        />
      ) : null}

      {compact && moreOpen && more.length > 0 ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]"
            onClick={closeMore}
          />
          <div
            className="u-shadow-float absolute inset-x-0 bottom-14 max-h-[70vh] overflow-y-auto rounded-t-card bg-surface pb-[env(safe-area-inset-bottom)]"
            style={{ animation: 'u-slide-in-up var(--motion-short) var(--ease-drawer)' }}
          >
            <NavMoreList items={more} pathname={location.pathname} onNavigate={closeMore} />
          </div>
        </div>
      ) : null}

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
