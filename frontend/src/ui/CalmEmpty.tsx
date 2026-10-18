import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * CalmEmpty — the premium "nothing to do" state for dashboard cards. A soft
 * ringed icon, one plain sentence and an optional hint. Reads as reassurance,
 * not as a missing feature.
 */
export function CalmEmpty({
  icon,
  title,
  hint,
  tone = 'light',
  className,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div className={cn('u-fade flex items-center gap-4 py-2', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'relative grid size-12 shrink-0 place-items-center rounded-full [&>svg]:size-5',
          dark ? 'bg-[color-mix(in_srgb,var(--surface)_10%,transparent)] text-hero-ink' : 'bg-surface-2 text-ink',
        )}
      >
        <span
          className={cn(
            'absolute -inset-1.5 rounded-full ring-1',
            dark ? 'ring-[color-mix(in_srgb,var(--surface)_14%,transparent)]' : 'ring-[var(--line)]',
          )}
        />
        {icon}
      </span>
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', dark ? 'text-hero-ink' : 'text-ink')}>{title}</p>
        {hint && (
          <p className={cn('mt-0.5 text-xs leading-5', dark ? 'text-hero-muted' : 'text-ink-muted')}>{hint}</p>
        )}
      </div>
    </div>
  );
}
