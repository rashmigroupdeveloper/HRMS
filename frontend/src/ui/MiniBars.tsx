import { cn } from './cn';

export interface MiniBar {
  label: string;
  /** Primary series (gold). */
  value: number;
  /** Optional second series (charcoal), drawn beside the first. */
  compare?: number;
}

/**
 * MiniBars — compact vertical month bars (e.g. joiners vs exits). Bars grow up
 * once (u-grow-y); zero months keep a hairline stub so the rhythm of the year
 * stays visible. A visually hidden table carries the numbers for AT.
 */
export function MiniBars({
  bars,
  seriesLabel,
  compareLabel,
  height = 96,
  className,
}: {
  bars: readonly MiniBar[];
  seriesLabel: string;
  compareLabel?: string;
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...bars.flatMap((b) => [b.value, b.compare ?? 0]));
  const paired = bars.some((b) => b.compare !== undefined);
  const h = (v: number) => (v === 0 ? 2 : Math.max(4, (v / max) * height));
  return (
    <div className={className}>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }} aria-hidden="true">
        {bars.map((b, i) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
            <span
              className={cn('u-grow-y w-full max-w-3 rounded-full', b.value === 0 ? 'bg-[var(--line-strong)]' : 'bg-accent')}
              style={{ height: h(b.value), animationDelay: `${String(Math.min(i, 11) * 20)}ms` }}
              title={`${b.label}: ${String(b.value)}`}
            />
            {paired && (
              <span
                className={cn('u-grow-y w-full max-w-3 rounded-full', (b.compare ?? 0) === 0 ? 'bg-[var(--line-strong)]' : 'bg-hero')}
                style={{ height: h(b.compare ?? 0), animationDelay: `${String(Math.min(i, 11) * 20 + 10)}ms` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={b.label} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-ink-muted">
            {i % 2 === 0 || bars.length <= 6 ? b.label.slice(0, 3) : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{compareLabel ? `${seriesLabel} and ${compareLabel} by month` : `${seriesLabel} by month`}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">{seriesLabel}</th>
            {paired && <th scope="col">{compareLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>{b.value}</td>
              {paired && <td>{b.compare ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
