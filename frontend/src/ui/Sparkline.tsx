import { useId } from 'react';
import { cn } from './cn';

/**
 * Sparkline — a quiet trend line for KPI cards. Draws in once (u-draw), ends on
 * a dot at the latest value, and breaks at gaps (null = not measured, never 0).
 * Decorative: callers state the numbers in text; `label` summarises for AT.
 */
export function Sparkline({
  values,
  label,
  tone = 'ink',
  height = 44,
  className,
}: {
  values: readonly (number | null)[];
  label: string;
  tone?: 'ink' | 'gold' | 'light';
  height?: number;
  className?: string;
}) {
  const id = useId();
  const measured = values.filter((v): v is number => v !== null);
  if (measured.length < 2) return null;
  const min = Math.min(...measured);
  const max = Math.max(...measured);
  const span = max - min || 1;
  const W = 100;
  const H = 32;
  const step = W / (values.length - 1);
  const pts = values.map((v, i) =>
    v === null ? null : { x: i * step, y: H - 3 - ((v - min) / span) * (H - 6) },
  );
  let d = '';
  let pen = false;
  for (const p of pts) {
    if (p === null) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    pen = true;
  }
  const last = [...pts].reverse().find((p) => p !== null);
  const stroke =
    tone === 'gold' ? 'var(--accent)' : tone === 'light' ? 'var(--hero-ink)' : 'var(--ink)';
  const area = `${d}L${String(W)} ${String(H)}L0 ${String(H)}Z`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      preserveAspectRatio="none"
      className={cn('block w-full overflow-visible', className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.1" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {measured.length === values.length && (
        <path d={area} fill={`url(#${id}-g)`} className="u-fade-late" />
      )}
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="u-draw"
      />
      {last && (
        <circle
          cx={last.x}
          cy={last.y}
          r={2.6}
          fill={tone === 'light' ? 'var(--accent)' : stroke}
          vectorEffect="non-scaling-stroke"
          className="u-fade-late"
        />
      )}
    </svg>
  );
}
