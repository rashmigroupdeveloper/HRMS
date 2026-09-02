/**
 * Chart primitives (docs/05 §7 "Charts", docs/06 §4/§5).
 *
 * Built as token-driven SVG rather than pulled from a charting library, because
 * the §0.1 firewall bans a second component library and every library ships its
 * own colour system, tooltip and focus behaviour that would immediately fight
 * the locked palette and the motion doctrine.
 *
 * The spec's chart rules, each enforced here rather than left to the caller:
 *   - **Two-series palette is LOCKED**: gold = the subject, charcoal/grey =
 *     the comparison. There is no colour prop; a third series is not offered
 *     because the spec does not permit one.
 *   - **Gridlines low-contrast**, data has no gradients or shadows — trend over
 *     decoration.
 *   - **Legend always visible**; tooltips give exact values.
 *   - **Keyboard reachable**: every point is a focusable stop, so a keyboard
 *     user gets the same tooltips as a mouse user (§7 "including charts").
 *   - **Never a blank axis frame**: an empty series renders an explanation, and
 *     the caller is required to supply a table alternative.
 *   - **INR lakh/crore grouping** on every axis and label via `en-IN`.
 */
import { useId, useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface ChartPoint {
  /** X label, already short enough for an axis ("Apr", "W12"). */
  label: string;
  /** Null means NOT MEASURED — the line breaks rather than dropping to zero. */
  value: number | null;
  /** Optional comparison value (the charcoal series). */
  compare?: number | null;
}

interface ChartProps {
  points: ChartPoint[];
  /** Series names for the legend — always rendered, never on hover. */
  seriesLabel: string;
  compareLabel?: string;
  /** Appended to every value in tooltips and the accessible summary. */
  unit?: string;
  precision?: number;
  height?: number;
  /** Required: §7 says every chart has a table/export alternative. */
  tableAlternative: ReactNode;
  emptyMessage?: string;
  className?: string;
}

const CHART_LOCALE = 'en-IN';

function formatValue(value: number, unit: string | undefined, precision: number): string {
  const n = value.toLocaleString(CHART_LOCALE, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return unit === undefined ? n : `${n}${unit}`;
}

/** Nice round axis ceiling so gridlines land on readable numbers. */
function axisMax(values: number[]): number {
  const peak = Math.max(...values, 0);
  if (peak === 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / magnitude) * magnitude;
}

/**
 * Line/area trend. Used for absenteeism %, OT hours, attrition — anything with
 * a time axis (docs/06 §4).
 */
export function TrendChart({
  points,
  seriesLabel,
  compareLabel,
  unit,
  precision = 0,
  height = 200,
  tableAlternative,
  emptyMessage = 'No data for this period yet.',
  className,
}: ChartProps) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const measured = points.filter((p) => p.value !== null);
  // Never a blank axis frame (§7 `empty-data-state`).
  if (measured.length === 0) {
    return (
      <div className={cn('rounded-row bg-surface-2 p-6 text-center', className)}>
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
        <div className="mt-4">{tableAlternative}</div>
      </div>
    );
  }

  const all = points.flatMap((p) => [p.value, p.compare ?? null]).filter((v): v is number => v !== null);
  const max = axisMax(all);
  const W = 100;
  const H = 100;
  const step = points.length > 1 ? W / (points.length - 1) : 0;

  const coords = (key: 'value' | 'compare') =>
    points.map((p, i) => {
      const raw = key === 'value' ? p.value : (p.compare ?? null);
      return raw === null ? null : { x: i * step, y: H - (raw / max) * H, raw, i };
    });

  /** Break the path at gaps — a missing month must not be drawn as zero. */
  const pathFor = (key: 'value' | 'compare'): string =>
    coords(key)
      .reduce<string[]>((acc, c) => {
        if (c === null) return [...acc, ''];
        const last = acc.at(-1);
        const cmd = last === undefined || last === '' ? 'M' : 'L';
        return [...acc, `${cmd}${c.x.toFixed(2)} ${c.y.toFixed(2)}`];
      }, [])
      .filter((s) => s !== '')
      .join(' ');

  const hasCompare = points.some((p) => p.compare !== null && p.compare !== undefined);
  const activePoint = active === null ? undefined : points[active];

  const summary = `${seriesLabel}: ${measured
    .map((p) => `${p.label} ${formatValue(p.value ?? 0, unit, precision)}`)
    .join(', ')}`;

  return (
    <div className={className}>
      {/* Legend is ALWAYS visible (§7 `legend-visible`) — never hover-only. */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-ink">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-accent" />
          {seriesLabel}
        </span>
        {hasCompare && compareLabel !== undefined && (
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-ink-faint" />
            {compareLabel}
          </span>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          preserveAspectRatio="none"
          style={{ height }}
          className="w-full overflow-visible"
          // role="group", NOT "img": the points inside are focusable, and an
          // image may not contain interactive descendants (axe:
          // nested-interactive). A group keeps the summary label while still
          // letting a keyboard user step through the data (§7).
          role="group"
          aria-label={summary}
        >
          {/* Low-contrast gridlines (§7 `gridline-subtle`). */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={H * t}
              y2={H * t}
              stroke="var(--line)"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Comparison first, so the gold subject sits on top. */}
          {hasCompare && (
            <path
              d={pathFor('compare')}
              fill="none"
              stroke="var(--ink-faint)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
          )}
          <path
            d={pathFor('value')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Every point is a keyboard stop (§7 — tooltips keyboard-reachable). */}
          {coords('value').map((c) =>
            c === null ? null : (
              <circle
                key={c.i}
                cx={c.x}
                cy={c.y}
                r={active === c.i ? 3 : 2}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                role="button"
                aria-label={`${points[c.i]?.label ?? ''}: ${formatValue(c.raw, unit, precision)}`}
                aria-describedby={`${id}-tip`}
                onMouseEnter={() => {
                  setActive(c.i);
                }}
                onMouseLeave={() => {
                  setActive(null);
                }}
                onFocus={() => {
                  setActive(c.i);
                }}
                onBlur={() => {
                  setActive(null);
                }}
                className="cursor-pointer outline-none focus-visible:stroke-[var(--ink)]"
              />
            ),
          )}
        </svg>

        {/* Tooltip shows EXACT values (§7 `direct-labeling`). */}
        <div
          id={`${id}-tip`}
          role="status"
          aria-live="polite"
          className={cn(
            'pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-row bg-hero px-3 py-1.5 text-xs text-hero-ink u-shadow-float',
            'transition-opacity duration-[var(--motion-micro)]',
            activePoint === undefined ? 'opacity-0' : 'opacity-100',
          )}
        >
          {activePoint === undefined
            ? ''
            : `${activePoint.label} · ${activePoint.value === null ? 'not measured' : formatValue(activePoint.value, unit, precision)}`}
        </div>
      </div>

      {/* X axis */}
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-ink-muted">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>

      {/* §7: every chart has a table alternative — not a nicety, a requirement. */}
      <div className="mt-3">
        <button
          type="button"
          className="u-press text-xs font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
          onClick={() => {
            setShowTable((v) => !v);
          }}
        >
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
        {showTable && <div className="mt-3">{tableAlternative}</div>}
      </div>
    </div>
  );
}

/**
 * Horizontal bars for categorical comparison (headcount by category, tickets by
 * category). Horizontal because category names are words, and words fit on the
 * left of a bar without rotating the label 45°.
 */
export function BarChart({
  points,
  seriesLabel,
  unit,
  precision = 0,
  tableAlternative,
  emptyMessage = 'Nothing to compare yet.',
  className,
}: Omit<ChartProps, 'height' | 'compareLabel'>) {
  const measured = points.filter((p) => p.value !== null);
  if (measured.length === 0) {
    return (
      <div className={cn('rounded-row bg-surface-2 p-6 text-center', className)}>
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
        <div className="mt-4">{tableAlternative}</div>
      </div>
    );
  }

  const max = axisMax(measured.map((p) => p.value ?? 0));

  return (
    <div className={className}>
      <p className="mb-3 text-xs text-ink-muted">{seriesLabel}</p>
      <ul className="space-y-2">
        {points.map((p) => {
          const pct = p.value === null ? 0 : (p.value / max) * 100;
          return (
            <li key={p.label} className="grid grid-cols-[minmax(90px,auto)_1fr_auto] items-center gap-3">
              <span className="truncate text-xs text-ink-muted">{p.label}</span>
              <span
                className="h-2.5 rounded-full bg-surface-2"
                role="img"
                aria-label={`${p.label}: ${p.value === null ? 'not measured' : formatValue(p.value, unit, precision)}`}
              >
                <span
                  className="block h-full rounded-full bg-accent transition-[width] duration-[var(--motion-medium)] ease-[var(--ease-out-strong)]"
                  style={{ width: `${String(Math.max(pct, p.value === null ? 0 : 2))}%` }}
                />
              </span>
              <span className="text-xs tabular-nums text-ink">
                {p.value === null ? '—' : formatValue(p.value, unit, precision)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">{tableAlternative}</div>
    </div>
  );
}
