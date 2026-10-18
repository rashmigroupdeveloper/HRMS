import { cn } from './cn';

/**
 * SuccessCheck — the one success micro-interaction: a positive disc pops in
 * and the tick strokes on (≈320ms total, transform/opacity + SVG stroke).
 * Used as the toast success icon, so "Leave applied", "Claim submitted" and
 * every other confirmation get the same small moment of delight.
 * Reduced motion: renders settled, no animation.
 */
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-[1.1rem]', className)}>
      <circle className="u-success-disc" cx="12" cy="12" r="11" fill="var(--positive)" />
      <path
        className="u-success-tick"
        pathLength={1}
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        stroke="var(--surface)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
