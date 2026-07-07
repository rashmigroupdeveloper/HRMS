/**
 * SegmentedProgress — the Crextio tri-segment bar (docs/05 §5): a single track
 * split into gold (primary filled) → charcoal (secondary filled) → hatched
 * remainder, with numeric labels above. Used for salary/allocation and budget
 * consumption views (e.g. claim vs budget by category).
 *
 * Values are absolute amounts; the bar normalizes them against `total`
 * (defaults to their sum). Anything past filled+secondary is the remainder.
 */

interface SegmentedProgressProps {
  label?: string;
  /** gold segment */ primary: number;
  /** charcoal segment */ secondary?: number;
  /** denominator; defaults to primary+secondary (i.e. no remainder) */
  total?: number;
  prefix?: string;
  locale?: string;
}

function fmt(n: number, locale: string, prefix?: string): string {
  return `${prefix ?? ''}${n.toLocaleString(locale)}`;
}

export function SegmentedProgress({
  label,
  primary,
  secondary = 0,
  total,
  prefix,
  locale = 'en-IN',
}: SegmentedProgressProps) {
  const denom = Math.max(total ?? primary + secondary, 1);
  const pPrimary = Math.min((primary / denom) * 100, 100);
  const pSecondary = Math.min((secondary / denom) * 100, 100 - pPrimary);
  const remainder = Math.max(denom - primary - secondary, 0);

  return (
    <div>
      {(label !== undefined || total !== undefined) && (
        <div className="mb-2 flex items-baseline justify-between">
          {label && (
            <span className="text-sm font-medium text-ink">{label}</span>
          )}
          <span
            data-numeric
            className="text-sm tabular-nums text-ink-muted"
          >
            {fmt(primary + secondary, locale, prefix)}
            <span className="text-ink-faint">
              {' / '}
              {fmt(denom, locale, prefix)}
            </span>
          </span>
        </div>
      )}
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(primary + secondary)}
        aria-valuemin={0}
        aria-valuemax={Math.round(denom)}
        aria-label={label}
      >
        <div
          className="h-full bg-accent transition-[width] duration-[var(--motion-medium)] ease-[var(--ease-out-strong)]"
          style={{ width: `${String(pPrimary)}%` }}
        />
        {pSecondary > 0 && (
          <div
            className="h-full bg-hero transition-[width] duration-[var(--motion-medium)] ease-[var(--ease-out-strong)]"
            style={{ width: `${String(pSecondary)}%` }}
          />
        )}
        {remainder > 0 && <div className="u-hatch h-full flex-1" />}
      </div>
    </div>
  );
}
