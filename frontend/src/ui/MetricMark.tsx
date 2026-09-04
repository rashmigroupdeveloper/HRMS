import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';
import { KpiNumber } from './KpiNumber';

/**
 * Icon stat cluster (docs/12 §7) — the large serif number + quiet label that
 * sits beside Crextio's greeting. Distinct from KpiPillRow: pills carry the
 * 4-state fill language; these are counts with an icon, never a gold fill.
 */
export function MetricMark({
  value,
  label,
  icon,
  to,
}: {
  value: number;
  label: string;
  icon: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-muted u-shadow-card [&_svg]:size-4">
        {icon}
      </span>
      <span>
        <span className="block font-serif text-[1.85rem] font-light leading-none tabular-nums text-ink">
          <KpiNumber value={value} />
        </span>
        <span className="mt-1 block text-xs text-ink-muted">{label}</span>
      </span>
    </>
  );
  const className = cn('flex items-center gap-3');
  if (to !== undefined) {
    return (
      <Link to={to} className={cn(className, 'u-press')}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
