import type { ReactNode } from 'react';
import { cn } from './cn';
import { KpiNumber } from './KpiNumber';

/**
 * KpiPillRow — the signature Crextio dashboard header: a row of metric pills in
 * FOUR visual states (docs/05 §5, docs/12 §7):
 *
 *   filled  — black/charcoal fill  (the settled / primary metric)
 *   accent  — gold fill            (the ONE metric of the day — §1 rule 2)
 *   hatched — diagonal-hatch fill  (in-progress / pending)
 *   outline — ring only            (secondary / remaining)
 *
 * Exactly one `accent` pill should appear per row (gold-accent discipline).
 * Numbers use KpiNumber so they animate once and stay tabular.
 */

export type PillState = 'filled' | 'accent' | 'hatched' | 'outline';

export interface KpiPill {
  label: string;
  value: number;
  state: PillState;
  prefix?: string;
  suffix?: string;
  precision?: number;
  icon?: ReactNode;
}

const STATE_SHELL: Record<PillState, string> = {
  filled: 'bg-hero text-hero-ink u-shadow-card',
  accent: 'bg-accent text-accent-ink u-shadow-card',
  hatched: 'u-hatch-strong bg-surface-2 text-ink',
  outline:
    'bg-transparent text-ink ring-1 ring-inset ring-[var(--line-strong)]',
};

const STATE_LABEL: Record<PillState, string> = {
  filled: 'text-hero-muted',
  accent: 'text-[color-mix(in_srgb,var(--accent-ink)_65%,transparent)]',
  hatched: 'text-ink-muted',
  outline: 'text-ink-muted',
};

export function KpiPillRow({ pills }: { pills: KpiPill[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {pills.map((p) => (
        <div
          key={p.label}
          className={cn(
            'min-w-[9.5rem] flex-1 rounded-tile px-4 py-3.5',
            STATE_SHELL[p.state],
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-xs font-medium tracking-tight',
                STATE_LABEL[p.state],
              )}
            >
              {p.label}
            </span>
            {p.icon && <span className="[&_svg]:size-4">{p.icon}</span>}
          </div>
          <div className="mt-1.5 text-2xl font-semibold leading-none">
            <KpiNumber
              value={p.value}
              prefix={p.prefix}
              suffix={p.suffix}
              precision={p.precision ?? 0}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
