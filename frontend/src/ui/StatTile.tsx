import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';
import { KpiNumber } from './KpiNumber';

/**
 * StatTile — the one module-level KPI tile (docs/05 §4 "KPI tile row on top",
 * §5 KpiNumber, 12 §7). Replaces the per-page uppercase-eyebrow / side-stripe /
 * serif-number tiles the absorbed screens shipped with (§7b bans).
 *
 *   tone="default" — warm surface + soft shadow (most tiles)
 *   tone="accent"  — solid gold: the ONE figure that matters today (§1 rule 2)
 *   tone="hatched" — diagonal hatch: in progress / pending (12 §7 #2)
 *
 * Numbers count up once (KpiNumber, reduced-motion snaps). Non-numeric values
 * (dates, ₹ strings already formatted) pass through untouched.
 */
type Tone = 'default' | 'accent' | 'hatched';

interface StatTileProps {
  label: ReactNode;
  value: number | ReactNode;
  prefix?: string;
  suffix?: string;
  precision?: number;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** Makes the tile the link to the list behind the number (docs/05 §8). */
  to?: string;
  className?: string;
}

const SHELL: Record<Tone, string> = {
  default: 'bg-surface text-ink u-shadow-card',
  accent: 'bg-accent text-accent-ink u-shadow-card',
  hatched: 'u-hatch bg-surface-2 text-ink',
};

export function StatTile({ label, value, prefix, suffix, precision, hint, icon, tone = 'default', to, className }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('text-sm font-medium leading-5', tone === 'accent' ? 'text-accent-ink' : 'text-ink-muted')}>{label}</span>
        {icon ? (
          <span
            aria-hidden
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-[1.05rem]',
              tone === 'accent' ? 'bg-hero text-hero-ink' : 'bg-surface-2 text-ink',
              tone === 'hatched' && 'bg-surface',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-[1.75rem] font-light leading-none tracking-tight tabular-nums sm:text-[2rem]">
        {typeof value === 'number' ? <KpiNumber value={value} prefix={prefix} suffix={suffix} precision={precision ?? 0} /> : value}
      </div>
      {hint ? (
        <p className={cn('mt-2 text-xs leading-5', tone === 'accent' ? 'text-accent-ink' : 'text-ink-muted')}>{hint}</p>
      ) : null}
    </>
  );
  const shell = cn('block rounded-tile p-5', SHELL[tone], className);
  if (to !== undefined) {
    return (
      <Link to={to} className={cn(shell, 'u-lift')}>
        {body}
      </Link>
    );
  }
  return <div className={shell}>{body}</div>;
}

/** Responsive row for 2–4 StatTiles: 2-up on phones, 4-up from lg. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4', className)}>{children}</div>;
}
