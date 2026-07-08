import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Skeleton — the loading-shape primitive (docs/05 §6 kill-list #3: "no spinner
 * longer than 300ms without a skeleton; no skeleton that doesn't match the
 * final layout"). Compose these into the SHAPE of the content being awaited —
 * a skeleton that mismatches its final layout is a spec violation, not a style
 * choice (it causes the exact layout shift the rule exists to prevent).
 *
 * The shimmer is the `.u-shimmer` utility (index.css): a soft ink-tinted sweep
 * over `--surface-2`, token-derived so it reads in both themes. Under
 * `prefers-reduced-motion` the global rule freezes it to a calm static block.
 *
 * Put `aria-busy` on the region being loaded; each bone is `aria-hidden`.
 */

type SkeletonVariant = 'line' | 'block' | 'circle';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** line = text row · block = card/tile region · circle = avatar/icon. */
  variant?: SkeletonVariant;
}

const VARIANT_SHAPE: Record<SkeletonVariant, string> = {
  line: 'h-3.5 w-full rounded-full',
  block: 'h-24 w-full rounded-tile',
  circle: 'aspect-square rounded-full',
};

export function Skeleton({
  variant = 'line',
  className,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('u-shimmer bg-surface-2', VARIANT_SHAPE[variant], className)}
      {...rest}
    />
  );
}
