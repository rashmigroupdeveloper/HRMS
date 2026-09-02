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
            'mt-1 font-light leading-[1.08] tracking-tight text-ink',
            tone === 'greeting'
              ? 'font-serif text-[2.35rem] sm:text-5xl'
              : 'text-4xl sm:text-5xl',
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
