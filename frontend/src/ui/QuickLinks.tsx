import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';

/**
 * QuickLinks — the role's daily shortcuts as Crextio circle icon buttons with
 * a label beneath (docs/12 §7 #6 "circle icon-buttons everywhere"). Every
 * daily action ≤ 2 clicks from home (docs/05 §6 kill-list #1).
 *
 * At most ONE link may be `primary` (gold) — the job of the day (§1 rule 2).
 * Desktop: a quiet horizontal rail. Phone: a 4-up grid of 64px targets.
 */
export interface QuickLink {
  to: string;
  label: string;
  icon: ReactNode;
  /** Small count badge (e.g. approvals waiting). */
  count?: number | undefined;
  primary?: boolean | undefined;
}

export function QuickLinks({
  links,
  label = 'Quick actions',
}: {
  links: QuickLink[];
  label?: string;
}) {
  if (links.length === 0) return null;
  return (
    <nav
      aria-label={label}
      className="u-stagger grid grid-cols-4 gap-x-2 gap-y-4 sm:flex sm:flex-wrap sm:gap-3"
    >
      {links.map((link) => (
        <Link
          key={link.to + link.label}
          to={link.to}
          aria-label={link.count ? `${link.label}, ${String(link.count)} waiting` : undefined}
          className={cn(
            'u-press group flex flex-col items-center gap-2 rounded-tile text-center sm:flex-row sm:gap-2.5 sm:rounded-full sm:py-1.5 sm:pl-1.5 sm:pr-4',
            link.primary ? 'sm:bg-accent sm:text-accent-ink' : 'sm:bg-surface sm:u-shadow-card',
            'transition-[box-shadow,background-color] duration-(--motion-micro) sm:hover:u-shadow-float',
          )}
        >
          <span
            className={cn(
              'relative grid size-14 place-items-center rounded-full sm:size-9 [&_svg]:size-5 sm:[&_svg]:size-4',
              link.primary
                ? 'bg-accent text-accent-ink sm:bg-hero sm:text-hero-ink'
                : 'bg-surface text-ink u-shadow-card sm:bg-surface-2 sm:shadow-none',
            )}
          >
            {link.icon}
            {link.count ? (
              <span className="absolute -right-1 -top-1 grid min-w-[20px] place-items-center rounded-full bg-hero px-1 text-[10px] font-bold text-hero-ink tabular-nums ring-2 ring-canvas sm:hidden">
                {link.count > 99 ? '99+' : link.count}
              </span>
            ) : null}
          </span>
          <span className="text-xs font-semibold leading-tight text-ink sm:text-sm sm:font-medium sm:text-inherit">
            {link.label}
            {link.count ? (
              <span className="ml-1.5 hidden rounded-full bg-hero px-1.5 py-0.5 text-[10px] font-bold text-hero-ink tabular-nums sm:inline">
                {link.count > 99 ? '99+' : link.count}
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </nav>
  );
}
