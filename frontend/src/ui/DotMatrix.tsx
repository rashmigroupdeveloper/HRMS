import type React from 'react';
import { cn } from './cn';

/**
 * DotMatrix — compact dot-grid heatmap (docs/05 §5): gold = present,
 * grey = absent, hatched-tone dot = weekend/holiday, faint = no-data.
 * The attendance mini-viz on ESS home and profile Attendance tab.
 *
 * Each cell carries a title (date + status) so the grid is inspectable without
 * a chart tooltip and remains accessible.
 */

export type DotState = 'present' | 'absent' | 'leave' | 'weekoff' | 'none';

export interface Dot {
  key: string;
  state: DotState;
  title?: string;
}

const DOT_STYLE: Record<DotState, string> = {
  present: 'bg-accent',
  absent: 'bg-negative',
  leave: 'bg-info',
  weekoff: 'bg-surface-2 ring-1 ring-inset ring-[var(--line-strong)]',
  none: 'bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]',
};

/** On a charcoal card (Crextio "Attendance report"): gold / cream / muted. */
const DOT_STYLE_DARK: Record<DotState, string> = {
  present: 'bg-accent',
  absent: 'bg-[color-mix(in_srgb,var(--negative)_80%,var(--hero))]',
  leave: 'bg-[color-mix(in_srgb,var(--hero-ink)_70%,transparent)]',
  weekoff: 'ring-1 ring-inset ring-[color-mix(in_srgb,var(--hero-ink)_25%,transparent)]',
  none: 'bg-[color-mix(in_srgb,var(--hero-ink)_14%,transparent)]',
};

export function DotMatrix({
  dots,
  columns = 7,
  size = 'md',
  tone = 'light',
  label,
  animate = false,
}: {
  dots: Dot[];
  columns?: number;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  /** Summary for screen readers; each cell keeps its own date/status name too. */
  label?: string;
  animate?: boolean;
}) {
  const dotSize = size === 'sm' ? 'size-2.5' : size === 'lg' ? 'size-4' : 'size-3.5';
  const styles = tone === 'dark' ? DOT_STYLE_DARK : DOT_STYLE;
  return (
    <div
      role="group"
      aria-label={label}
      className="grid w-max gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${String(columns)}, max-content)`,
      }}
    >
      {dots.map((d, i) => (
        <span
          key={d.key}
          role="img"
          title={d.title}
          aria-label={d.title ?? d.state}
          style={animate ? ({ '--i': Math.min(i, 60) } as React.CSSProperties) : undefined}
          className={cn('rounded-full', dotSize, styles[d.state], animate && 'u-dot-in')}
        />
      ))}
    </div>
  );
}
