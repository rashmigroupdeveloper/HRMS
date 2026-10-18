/**
 * App shell — Crextio masthead + center pill nav (docs/05 §3, 12 §7).
 * Wordmark (+ company scope for group roles) left, dark-active pills center,
 * ⌘K / approvals / identity right. Phones get a role-aware thumb bar with a
 * gold quick-action button and bottom sheets, not an off-canvas reprint of the
 * catalog (docs/05 §7 adaptive-navigation).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CheckCheck, Search, Settings, X } from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { hasAnyPermission, hasPermission, hasRole } from '../lib/session';
import { IconButton, ThemeToggle, Toaster, Tooltip, cn } from '../ui';
import type { NavItem } from './nav-config';
import { isNavActive, navForUser, splitNav } from './nav-config';
import { AccountMenu } from './AccountMenu';
import { BottomBar } from './BottomBar';
import { bottomTabs } from './bottom-tabs';
import { CommandPalette } from './CommandPalette';
import { CompanySwitcher } from './CompanySwitcher';
import { useCompanyScope } from './company-scope';
import { NavMoreList } from './NavMoreList';
import { PillNav } from './PillNav';
import { QuickActionSheet } from './QuickActionSheet';
import { quickActionsFor } from './quick-actions';
import { RouteFrame } from './RouteFrame';
import { useInboxCount } from './useInboxCount';

interface AppShellProps {
  user: SessionUser;
  onSignedOut: () => void;
}

const APPROVAL_PERMS = ['leave.approve', 'ar.approve', 'od.approve', 'ot.approve', 'claims.approve'] as const;
const COMPACT_QUERY = '(max-width: 1023px)';

function useCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const sync = (): void => {
      setCompact(mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
    };
  }, []);
  return compact;
}

/** True once content has scrolled under the masthead (IntersectionObserver). */
function useScrolled(): [RefObject<HTMLDivElement | null>, boolean] {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(entry ? !entry.isIntersecting : false);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [sentinel, scrolled];
}

export function AppShell({ user, onSignedOut }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const compact = useCompact();
  const [sentinel, scrolled] = useScrolled();
  const scope = useCompanyScope();
  const catalog = useMemo(() => navForUser(user), [user]);
  const { pills, more } = useMemo(() => splitNav(catalog), [catalog]);
  const [overflow, setOverflow] = useState<NavItem[]>([]);
  const moreItems = useMemo(() => (compact ? more : [...overflow, ...more]), [compact, overflow, more]);
  const actions = useMemo(() => quickActionsFor(user), [user]);
  const showQuick = actions.length >= 2;
  const tabs = useMemo(() => bottomTabs(catalog, 4), [catalog]);
  const mobileMore = useMemo(
    () => catalog.filter((item) => !tabs.some((tab) => tab.to === item.to)),
    [catalog, tabs],
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const canApprove = hasAnyPermission(user, APPROVAL_PERMS);
  const inboxCount = useInboxCount(canApprove);
  const groupScope = hasRole(user, 'hr_head') || hasRole(user, 'super_admin');
  const sheetItems = compact ? mobileMore : moreItems;
  const moreActive = sheetItems.some((item) => isNavActive(location.pathname, item));
  const approvalsTab = tabs.some((tab) => tab.to === '/approvals');
  const onOverflow = useCallback((items: NavItem[]) => {
    setOverflow(items);
  }, []);
  const closeQuick = useCallback(() => {
    setQuickOpen(false);
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

  // New route: close menus, move focus to the page (screen readers hear the
  // change) and start at the top — except on back/forward, where the browser
  // restores the scroll position (docs/05 §6 kill-list #2).
  const firstRender = useRef(true);
  useEffect(() => {
    setMoreOpen(false);
    setQuickOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-toast) focus:rounded-full focus:bg-hero focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-hero-ink"
      >
        Skip to content
      </a>
      <div ref={sentinel} aria-hidden className="h-px w-full" />

      <header
        data-scrolled={scrolled}
        className="u-masthead pt-safe sticky top-0 z-(--z-sticky) -mt-px"
      >
        <div className="px-safe mx-auto flex max-w-(--shell-max) items-center gap-2 py-3 sm:gap-3 lg:py-4">
          <Link
            to={catalog[0]?.to ?? '/'}
            className="u-press flex shrink-0 items-center gap-2.5 rounded-full"
          >
            <span aria-hidden className="relative grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
              R
              <span aria-hidden className="absolute bottom-1.5 right-1.5 size-1.5 rounded-full bg-accent" />
            </span>
            <span className="sr-only xl:not-sr-only xl:text-[15px] xl:font-semibold xl:tracking-tight xl:text-ink">
              Rashmi
            </span>
            <span className="sr-only"> HRMS home</span>
          </Link>

          {groupScope ? <CompanySwitcher compact={compact} /> : null}

          {!compact ? (
            <div ref={moreRef} className="relative flex min-w-0 flex-1 justify-center">
              <PillNav
                pills={pills}
                moreCount={more.length}
                moreOpen={moreOpen}
                moreActive={moreItems.some((item) => isNavActive(location.pathname, item))}
                onToggleMore={() => {
                  setMoreOpen((value) => !value);
                }}
                onOverflow={onOverflow}
              />
              {moreOpen && moreItems.length > 0 ? (
                <div
                  role="menu"
                  aria-label="More destinations"
                  className="u-pop-in u-shadow-float absolute right-0 top-full z-(--z-popover) mt-2 max-h-[calc(100vh-6rem)] w-72 overflow-auto rounded-tile bg-surface xl:right-auto"
                  style={{ transformOrigin: 'top center' }}
                >
                  <NavMoreList items={moreItems} pathname={location.pathname} onNavigate={closeMore} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {hasPermission(user, 'admin.settings') ? (
              <Link
                to="/admin/settings"
                className="u-press u-shadow-card hidden h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink 2xl:inline-flex"
              >
                <Settings className="size-4" aria-hidden />
                Settings
              </Link>
            ) : null}

            <Tooltip label="Search · Ctrl K" side="bottom">
              <IconButton
                label="Search people and pages (Ctrl+K)"
                icon={<Search />}
                className="u-tap"
                onClick={() => {
                  setPaletteOpen(true);
                }}
              />
            </Tooltip>

            {canApprove && !(compact && approvalsTab) ? (
              <Tooltip label="Approvals" side="bottom">
                <button
                  type="button"
                  onClick={() => {
                    void navigate('/approvals');
                  }}
                  aria-label={`Approvals${inboxCount > 0 ? ` — ${String(inboxCount)} waiting` : ''}`}
                  className="u-press u-tap u-shadow-card relative grid size-10 place-items-center rounded-full bg-surface text-ink-muted transition-colors hover:text-ink"
                >
                  <CheckCheck className="size-[1.15rem]" aria-hidden />
                  {inboxCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink tabular-nums ring-2 ring-canvas">
                      {inboxCount > 99 ? '99+' : inboxCount}
                    </span>
                  ) : null}
                </button>
              </Tooltip>
            ) : null}

            <span className="hidden sm:contents">
              <ThemeToggle />
            </span>
            <AccountMenu user={user} onSignedOut={onSignedOut} />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'px-safe flex-1 outline-none',
          compact ? 'pb-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom,0px)+24px)] pt-3' : 'pb-16 pt-4 lg:pt-6',
        )}
      >
        <div className="mx-auto max-w-(--content-max)">
          <RouteFrame routeKey={`${location.pathname}#${String(scope)}`}>
            <Outlet />
          </RouteFrame>
        </div>
      </main>

      {compact ? (
        <BottomBar
          tabs={tabs}
          moreOpen={moreOpen}
          moreActive={moreActive}
          onToggleMore={() => {
            setQuickOpen(false);
            setMoreOpen((value) => !value);
          }}
          onQuickActions={
            showQuick
              ? () => {
                  setMoreOpen(false);
                  setQuickOpen((value) => !value);
                }
              : undefined
          }
          quickOpen={quickOpen}
          inboxCount={inboxCount}
        />
      ) : null}

      {compact && moreOpen && mobileMore.length > 0 ? (
        <div className="fixed inset-0 z-(--z-popover)">
          <button type="button" aria-label="Close menu" className="u-fade absolute inset-0 bg-(--scrim)" onClick={closeMore} />
          <div
            role="menu"
            aria-label="All destinations"
            className="u-sheet u-shadow-lift absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-card bg-surface pb-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom,0px)+8px)] pt-3"
          >
            <div aria-hidden className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between px-5 pb-1 pt-1">
              <p className="text-lg font-semibold text-ink">Everything else</p>
              <button
                type="button"
                onClick={closeMore}
                aria-label="Close"
                className="u-press u-tap grid size-10 place-items-center rounded-full bg-surface-2 text-ink-muted"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavMoreList items={mobileMore} pathname={location.pathname} onNavigate={closeMore} />
            <div className="flex items-center justify-between px-5 pt-2 sm:hidden">
              <span className="text-sm text-ink-muted">Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : null}

      <QuickActionSheet open={compact && quickOpen} actions={actions} inboxCount={inboxCount} onClose={closeQuick} />

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
