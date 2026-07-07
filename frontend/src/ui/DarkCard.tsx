import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * DarkCard — the charcoal "hero" feature card. At most ONE per screen
 * (docs/05 §1 rule 3). Carries the faint fibrous grain texture (`u-grain`,
 * docs/12 §7). Text uses hero-ink / hero-muted so it stays legible on charcoal
 * in both themes (the hero token darkens further in dark mode).
 */

interface DarkCardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  children: ReactNode;
}

export function DarkCard({
  padded = true,
  className,
  children,
  ...rest
}: DarkCardProps) {
  return (
    <div
      className={cn(
        'u-grain u-shadow-float rounded-card bg-hero text-hero-ink',
        padded && 'p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
