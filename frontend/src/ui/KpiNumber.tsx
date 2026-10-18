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
  /** decimal places; default: 0 for whole numbers, else up to 2 — a fractional value is never rounded away (12.9 must not read 13). */ precision?: number | undefined;
  /** ms; the rare 800ms count is reserved for payday/dashboard surfaces */
  duration?: number | undefined;
  /** ms before the count starts — the CEO dashboard staggers by 40ms/tile
   *  (docs/05 §6). Ignored under reduced motion. */
  delay?: number | undefined;
  /** Set false where a count-up would be noise rather than delight. */
  animateOnMount?: boolean | undefined;
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
  precision: precisionProp,
  duration = 800,
  delay = 0,
  animateOnMount = true,
  locale = 'en-IN',
  className,
}: KpiNumberProps) {
  const precision = precisionProp ?? inferPrecision(value);
  // Start at zero so the FIRST paint has somewhere to count up from. Seeding
  // `display` with `value` (as this did) made `from === to` on mount, so the
  // count-up never ran — the component animated only on later changes, which
  // is the opposite of the spec ("once on load and on real change", §2.5).
  const shouldCount = animateOnMount && !prefersReducedMotion() && duration > 0;
  const [display, setDisplay] = useState(shouldCount ? 0 : value);
  const fromRef = useRef(shouldCount ? 0 : value);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    if (prefersReducedMotion() || duration <= 0) {
      // Reduced motion snaps to the final value — the number is CONTENT, the
      // animation is decoration (docs/05 §2.3).
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const begin = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        setDisplay(from + (to - from) * easeOut(p));
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
        else fromRef.current = to;
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (delay > 0) timerRef.current = setTimeout(begin, delay);
    else begin();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [value, duration, delay]);

  const formatted = display.toLocaleString(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  return (
    // No aria-label: it is prohibited on a role-less <span> (ARIA 1.2, axe
    // "aria-prohibited-attr"). The count runs 800ms once, so AT reads the text.
    <span data-numeric className={cn('tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/** 0 for whole numbers; otherwise the decimals actually present, capped at 2. */
function inferPrecision(value: number): number {
  if (Number.isInteger(value)) return 0;
  return Math.round(value * 10) / 10 === value ? 1 : 2;
}
