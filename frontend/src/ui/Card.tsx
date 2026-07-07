import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Card — the content surface. Separated from the cream canvas by surface color
 * + soft shadow + 24px radius, NEVER a 1px grey border (docs/05 §1 rule 1).
 *
 * `interactive` adds hover lift + press feedback for row/tile cards that open a
 * drawer. `padded` toggles the default 24px inset (off for tables/media).
 */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
  /** Use the quieter second neutral layer for rails/toolbars (docs/05 §7b). */
  rail?: boolean;
  children: ReactNode;
}

export function Card({
  interactive = false,
  padded = true,
  rail = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card',
        rail ? 'bg-surface-2' : 'bg-surface',
        'u-shadow-card',
        padded && 'p-6',
        interactive &&
          'u-press cursor-pointer transition-shadow duration-[var(--motion-short)] ease-[var(--ease-out-strong)] hover:u-shadow-float',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Optional header row for a Card — title left, actions right. */
export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
