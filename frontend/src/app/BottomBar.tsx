/**
 * Mobile daily bar (docs/05 §7): four thumb-zone actions + More.
 * Replaces the off-canvas reprint of the whole taxonomy.
 */
import { NavLink } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { cn } from '../ui';
import type { NavItem } from './nav-config';

interface BottomBarProps {
  tabs: NavItem[];
  moreOpen: boolean;
  moreActive: boolean;
  onToggleMore: () => void;
}

export function BottomBar({ tabs, moreOpen, moreActive, onToggleMore }: BottomBarProps) {
  return (
    <nav
      aria-label="Daily"
      className="fixed inset-x-0 bottom-0 z-30 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_-18px_color-mix(in_srgb,var(--ink)_22%,transparent)] lg:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${String(tabs.length + 1)}, minmax(0, 1fr))` }}
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'u-press flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium',
                    isActive ? 'text-ink' : 'text-ink-muted',
                  )
                }
              >
                {Icon ? <Icon className="size-5" aria-hidden /> : null}
                <span className="max-w-full truncate">{item.label.replace(/^My /, '')}</span>
              </NavLink>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={onToggleMore}
            className={cn(
              'u-press flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium',
              moreActive || moreOpen ? 'text-ink' : 'text-ink-muted',
            )}
          >
            <LayoutGrid className="size-5" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
