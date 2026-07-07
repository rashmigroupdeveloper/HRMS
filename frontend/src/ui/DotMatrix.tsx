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

export function DotMatrix({
  dots,
  columns = 7,
  size = 'md',
}: {
  dots: Dot[];
  columns?: number;
  size?: 'sm' | 'md';
}) {
  const dotSize = size === 'sm' ? 'size-2.5' : 'size-3.5';
  return (
    <div
      className="grid gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
      }}
    >
      {dots.map((d) => (
        <span
          key={d.key}
          title={d.title}
          aria-label={d.title ?? d.state}
          className={cn('rounded-[4px]', dotSize, DOT_STYLE[d.state])}
        />
      ))}
    </div>
  );
}
