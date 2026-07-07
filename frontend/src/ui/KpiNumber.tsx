import { useEffect, useRef, useState } from 'react';
import { cn } from './cn';

/**
 * KpiNumber — a metric that counts up ONCE on mount and on real value change,
 * never on polls (docs/05 §2.5, §6). Always tabular (docs/05 §1 rule 5).
 * Respects prefers-reduced-motion: snaps to the final value (docs/05 §2.3).
 *
 * Formatting is locale-aware with Indian grouping by default (lakh/crore) so
 * axes and KPIs read the way finance expects (docs/05 §7 number-formatting).
 */

interface KpiNumberProps {
  value: number;
  /** e.g. '₹' */ prefix?: string | undefined;
  /** e.g. '%' or ' days' */ suffix?: string | undefined;
  /** decimal places */ precision?: number | undefined;
  /** ms; the rare 800ms count is reserved for payday/dashboard surfaces */
  duration?: number | undefined;
  locale?: string | undefined;
  className?: string | undefined;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// easeOutExpo — matches --ease-out-strong feel; decelerates into the final value.
function easeOut(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function KpiNumber({
  value,
  prefix,
  suffix,
  precision = 0,
  duration = 800,
  locale = 'en-IN',
  className,
}: KpiNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    if (prefersReducedMotion() || duration <= 0) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setDisplay(from + (to - from) * easeOut(p));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = display.toLocaleString(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  return (
    <span
      data-numeric
      className={cn('tabular-nums', className)}
      aria-label={`${prefix ?? ''}${value.toLocaleString(locale)}${suffix ?? ''}`}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
