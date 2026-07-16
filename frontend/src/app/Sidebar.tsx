/**
 * Sidebar rail (docs/05 §3 shell + §7 "≥1024px = sidebar-capable shell").
 * Warm Editorial only (§0.1 firewall): `--surface-2` rail, charcoal active row
 * (the "dark active segment", §3), gold focus ring — no side-stripe accents,
 * no glassmorphism, no blue (§7b bans).
 *
 * Renders the inner rail column; the shell (AppShell) owns positioning so the
 * same component serves both the sticky desktop rail and the mobile drawer.
 * Composed only from `frontend/src/ui` primitives + local nav config.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../ui';
import { isNavActive, type NavItem } from './nav-config';

interface SidebarProps {
  nav: NavItem[];
  /** Icon-only rail when true (desktop toggle). Always false in the mobile drawer. */
  collapsed: boolean;
  /** Present only on desktop — the collapse/expand control. */
  onToggleCollapse?: () => void;
  /** Close the mobile drawer after a navigation (state-preservation, §6). */
  onNavigate?: () => void;
}

export function Sidebar({ nav, collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const location = useLocation();
  const primary = nav.filter((item) => item.section !== 'secondary');
  const secondary = nav.filter((item) => item.section === 'secondary');

  const renderRow = (item: NavItem) => {
    const active = isNavActive(location.pathname, item);
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        onClick={onNavigate}
        // Collapsed rows hide their label — keep the accessible name + hover hint.
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'u-press flex items-center gap-3 rounded-row px-3 py-2.5 text-sm font-medium',
          'transition-colors duration-(--motion-micro)',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-hero text-hero-ink shadow-sm'
            : 'text-ink-muted hover:bg-surface hover:text-ink',
        )}
      >
        {Icon && <Icon className="size-[1.15rem] shrink-0" aria-hidden />}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <div className="flex h-full flex-col border-r border-line/60 bg-surface-2">
      {/* Brand */}
      <div className={cn('flex items-center py-4', collapsed ? 'justify-center px-3' : 'px-5')}>
        <NavLink
          to="/"
          end
          onClick={onNavigate}
          aria-label="Rashmi HRMS — home"
          className="u-press flex items-center gap-2.5"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
            R
          </span>
          {!collapsed && <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>}
        </NavLink>
      </div>

      {/* Nav — one scrollable list (primary + secondary) that owns the full rail
          height. Scrollbar hidden (same idiom the pill-nav used); Settings/Gallery
          flow with the list rather than sitting in a fixed footer block. */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Primary"
      >
        {primary.map(renderRow)}
        {secondary.length > 0 && (
          <div className="mt-1 space-y-1 border-t border-line/60 pt-2">
            {secondary.map(renderRow)}
          </div>
        )}
      </nav>

      {/* Footer — only the collapse control (desktop), kept compact so the list
          above keeps the space. */}
      {onToggleCollapse && (
        <div className="border-t border-line/60 px-3 py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'u-press flex w-full items-center gap-3 rounded-row px-3 py-2.5 text-sm font-medium',
              'text-ink-muted transition-colors hover:bg-surface hover:text-ink',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[1.15rem] shrink-0" aria-hidden />
            ) : (
              <PanelLeftClose className="size-[1.15rem] shrink-0" aria-hidden />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  );
}
