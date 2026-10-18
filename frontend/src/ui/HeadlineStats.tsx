import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';
import { KpiNumber } from './KpiNumber';

/**
 * HeadlineStats — the big-numeral header row from the Crextio reference
 * (docs/12 §7): unboxed, light-weight display numerals with a small icon and
 * label beside each. Calmer than a row of pills when a page header carries
 * three or four counts. `emphasis` marks the ONE number that is today's job
 * with a gold dot — the gold-accent discipline still holds (docs/05 §1).
 */
export interface HeadlineStat {
  label: string;
  value: number;
  icon?: ReactNode;
  suffix?: string;
  precision?: number;
  emphasis?: boolean;
  /** The list behind the number (docs/05 §8). */
  to?: string;
}

function StatBody({ s }: { s: HeadlineStat }) {
  return (
    <>
      <span className="flex flex-col items-start gap-1 pb-1.5 text-xs leading-tight text-ink-muted">
        {s.icon ? (
          <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-ink [&_svg]:size-3.5" aria-hidden>
            {s.icon}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {s.emphasis ? <span className="size-1.5 rounded-full bg-accent" aria-hidden /> : null}
          {s.label}
        </span>
      </span>
      <span className="text-4xl font-light leading-none tracking-tight text-ink sm:text-5xl lg:text-6xl">
        <KpiNumber value={s.value} suffix={s.suffix} precision={s.precision ?? 0} />
      </span>
    </>
  );
}

export function HeadlineStats({ stats, className }: { stats: HeadlineStat[]; className?: string }) {
  return (
    <ul className={cn('grid grid-cols-2 items-end gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8', className)}>
      {stats.map((s) => {
        const shell = 'flex items-end gap-2.5 rounded-tile';
        return (
          <li key={s.label}>
            {s.to !== undefined ? (
              <Link
                to={s.to}
                className={cn(
                  shell,
                  'u-press -m-1.5 p-1.5 transition-colors duration-(--motion-micro) hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
              >
                <StatBody s={s} />
              </Link>
            ) : (
              <div className={shell}>
                <StatBody s={s} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
