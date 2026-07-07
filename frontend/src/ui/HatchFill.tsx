import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * HatchFill — reusable diagonal-hatch texture for in-progress / remaining /
 * inactive / weekend states (docs/05 §5). Low-contrast and warm; the texture
 * itself is the `.u-hatch` utility (index.css) so no per-element hexes.
 *
 * Use as a background layer: give it a size via className, drop content inside,
 * or use standalone (e.g. a progress remainder segment).
 */

interface HatchFillProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  rounded?: boolean;
}

export function HatchFill({
  strong = false,
  rounded = false,
  className,
  children,
  ...rest
}: HatchFillProps) {
  return (
    <div
      className={cn(
        strong ? 'u-hatch-strong' : 'u-hatch',
        'bg-surface-2',
        rounded && 'rounded-tile',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
