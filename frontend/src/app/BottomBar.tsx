/**
 * Mobile thumb bar (docs/05 §7, docs/12 §6 mobile parity): role-aware tabs, a
 * charcoal active capsule (the pill-nav signature, shrunk to the thumb zone),
 * a centre gold quick-action button and More. 64px + safe-area inset; every
 * target ≥ 44×44 (WCAG 2.5.8).
 */
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Plus } from 'lucide-react';
import { cn } from '../ui';
import type { NavItem } from './nav-config';
import { tabLabel } from './bottom-tabs';

interface BottomBarProps {
  tabs: NavItem[];
  moreOpen: boolean;
  moreActive: boolean;
  onToggleMore: () => void;
  /** Centre quick-action button; omitted when the role has < 2 actions. */
  onQuickActions?: (() => void) | undefined;
  quickOpen?: boolean;
  inboxCount?: number;
}

const ITEM =
  'u-press group flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-semibold leading-none';

export function BottomBar({
  tabs,
  moreOpen,
  moreActive,
  onToggleMore,
  onQuickActions,
  quickOpen = false,
  inboxCount = 0,
}: BottomBarProps) {
  const split = onQuickActions ? Math.ceil(tabs.length / 2) : tabs.length;
  const renderTab = (item: NavItem) => {
    const Icon = item.icon;
    const badge = item.to === '/approvals' && inboxCount > 0 ? inboxCount : null;
    return (
      <li key={item.to}>
        <NavLink
          to={item.to}
          end={item.to === '/'}
          aria-label={badge !== null ? `${tabLabel(item)}, ${String(badge)} waiting` : undefined}
          className={({ isActive }) => cn(ITEM, isActive ? 'text-ink' : 'text-ink-muted')}
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'relative grid h-8 w-12 min-[380px]:w-14 place-items-center rounded-full transition-colors duration-(--motion-micro)',
                  isActive ? 'bg-hero text-hero-ink' : 'bg-transparent',
                )}
              >
                {Icon ? <Icon className="size-[1.15rem]" aria-hidden /> : null}
                {badge !== null ? (
                  <span className="absolute -top-1 right-1.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink tabular-nums ring-2 ring-surface">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{tabLabel(item)}</span>
            </>
          )}
        </NavLink>
      </li>
    );
  };

  const columns = tabs.length + 1 + (onQuickActions ? 1 : 0);

  return (
    <nav
      aria-label="Daily"
      className="pb-safe fixed inset-x-0 bottom-0 z-(--z-nav) bg-surface shadow-[0_-10px_28px_-18px_color-mix(in_srgb,var(--ink)_28%,transparent)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl px-1 [&>li]:min-w-0" style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))` }}>
        {tabs.slice(0, split).map(renderTab)}
        {onQuickActions ? (
          <li className="grid place-items-center">
            <button
              type="button"
              onClick={onQuickActions}
              aria-haspopup="dialog"
              aria-expanded={quickOpen}
              aria-label="Quick actions"
              className={cn(
                'u-press grid size-12 -translate-y-2 place-items-center rounded-full bg-accent text-accent-ink u-shadow-float ring-4 ring-surface',
                'transition-transform duration-(--motion-short) ease-(--ease-out-strong)',
              )}
            >
              <Plus className={cn('size-6 transition-transform duration-(--motion-short)', quickOpen && 'rotate-45')} aria-hidden />
            </button>
          </li>
        ) : null}
        {tabs.slice(split).map(renderTab)}
        <li>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={onToggleMore}
            className={cn(ITEM, moreActive || moreOpen ? 'text-ink' : 'text-ink-muted')}
          >
            <span
              className={cn(
                'grid h-8 w-12 min-[380px]:w-14 place-items-center rounded-full transition-colors duration-(--motion-micro)',
                moreActive || moreOpen ? 'bg-hero text-hero-ink' : 'bg-transparent',
              )}
            >
              <LayoutGrid className="size-[1.15rem]" aria-hidden />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
