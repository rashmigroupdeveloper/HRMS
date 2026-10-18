import { cn } from './cn';

/**
 * StatusStrip — the Crextio header strip (docs/12 §7): one row of pill
 * segments whose widths are proportional to their share, each labelled above
 * and carrying its percentage inside. Four tones mirror KpiPillRow:
 * dark (settled), gold (the ONE number of the day), hatched (in progress),
 * outline (remainder). Zero-value segments drop out; an all-zero strip renders
 * a single quiet outline so the layout never jumps.
 */
export type StripTone = 'dark' | 'gold' | 'hatched' | 'outline';

export interface StripSegment {
  label: string;
  value: number;
  tone: StripTone;
}

const TONE: Record<StripTone, string> = {
  dark: 'bg-hero text-hero-ink',
  gold: 'bg-accent text-accent-ink',
  hatched: 'u-hatch-strong bg-surface-2 text-ink',
  outline: 'bg-transparent text-ink ring-1 ring-inset ring-[var(--line-strong)]',
};

export function StatusStrip({
  segments,
  label,
  className,
}: {
  segments: StripSegment[];
  /** Accessible name for the whole strip, e.g. "Team attendance today". */
  label: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  const shown = segments.filter((s) => s.value > 0);
  const pct = (v: number) => (total === 0 ? 0 : Math.round((v / total) * 100));

  return (
    <figure className={cn('w-full', className)} aria-label={label}>
      {total === 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-muted">{label}</span>
          <div className={cn('flex h-9 items-center rounded-full px-4 text-xs text-ink-muted', TONE.outline)}>
            Nothing recorded yet
          </div>
        </div>
      ) : (
        <ul className="flex w-full items-end gap-1.5">
          {shown.map((s) => {
            const p = pct(s.value);
            return (
              <li
                key={s.label}
                className="@container flex min-w-[4.5rem] flex-col gap-1.5"
                title={`${s.label}: ${s.value.toLocaleString('en-IN')} · ${String(p)}%`}
                style={{ flexGrow: Math.max(s.value, total * 0.06), flexBasis: 0 }}
              >
                <span className="truncate text-xs text-ink-muted">{s.label}</span>
                <span
                  className={cn(
                    'u-grow-x flex h-9 items-center overflow-hidden whitespace-nowrap rounded-full px-3.5 text-xs font-semibold tabular-nums',
                    TONE[s.tone],
                  )}
                >
                  <span className="sr-only">{s.label}: </span>
                  {s.value.toLocaleString('en-IN')}
                  {/* Narrow segments keep just the value; the % returns once there is room. */}
                  <span className="ml-1 hidden font-normal opacity-75 @[7.5rem]:inline">· {p}%</span>
                  <span className="sr-only @[7.5rem]:hidden"> ({p}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
