/**
 * Overflow destinations under More — grouped the way ops rails used to be,
 * without a left column (docs/05 §3 masthead, 08 §3).
 */
import { NavLink } from 'react-router-dom';
import { cn } from '../ui';
import { isNavActive, type NavItem } from './nav-config';

interface NavMoreListProps {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}

function clusters(items: NavItem[]): { label: string | undefined; items: NavItem[] }[] {
  const groups: { label: string | undefined; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.label === item.group) last.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }
  return groups;
}

export function NavMoreList({ items, pathname, onNavigate }: NavMoreListProps) {
  return (
    <div className="py-1">
      {clusters(items).map((cluster) => (
        <div key={cluster.label ?? cluster.items[0]?.to} className="px-1.5">
          {cluster.label ? (
            <p className="px-3 pb-1 pt-2 text-xs text-ink-muted">{cluster.label}</p>
          ) : null}
          {cluster.items.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                role="menuitem"
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'u-press flex items-center gap-2.5 rounded-row px-3 py-2 text-sm font-medium',
                  active ? 'bg-hero text-hero-ink' : 'text-ink hover:bg-surface-2',
                )}
              >
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
                {item.label}
              </NavLink>
            );
          })}
        </div>
      ))}
    </div>
  );
}
