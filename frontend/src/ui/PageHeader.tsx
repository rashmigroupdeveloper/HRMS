import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * PageHeader — the one page-title vocabulary (docs/05 §4, 12 §7).
 * Geometric sans, light and large — Crextio's "People" / "Salary" titles.
 * `tone="greeting"` is the only serif exception (ESS "Hello {name}").
 */
interface PageHeaderProps {
  /** Small quiet context line above the title (module · requirement id). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons / toggles aligned to the header's trailing edge. */
  actions?: ReactNode;
  className?: string;
  tone?: 'page' | 'greeting';
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  tone = 'page',
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-6', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-ink-muted">{eyebrow}</p>}
        <h1
          className={cn(
            'mt-1 font-light leading-[1.08] tracking-tight text-ink [overflow-wrap:anywhere] hyphens-auto',
            tone === 'greeting'
              ? 'font-serif text-[2.35rem] sm:text-5xl'
              : 'text-[2rem] min-[400px]:text-4xl sm:text-5xl',
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>}
      </div>
      {actions && (
        // Page-supplied action rows often arrive as a nowrap flex <div>; on a
        // 360px phone they must wrap, and segmented tab groups scroll instead
        // of pushing the whole layout sideways.
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>div]:max-w-full [&>div]:flex-wrap [&_div.flex.rounded-full]:max-w-full [&_div.flex.rounded-full]:overflow-x-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
