import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * PageHeader — the one page-title vocabulary (docs/05 §4 layout convention).
 * Eyebrow → Fraunces display title → description, with an optional right-aligned
 * actions slot. Standardises the header every screen was hand-rolling, so
 * typography, spacing and the editorial serif are identical everywhere.
 */
interface PageHeaderProps {
  /** Small quiet context line above the title (module · requirement id). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons / toggles aligned to the header's trailing edge. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-ink-muted">{eyebrow}</p>}
        <h1 className="mt-1 font-serif text-[2.1rem] font-light leading-[1.1] tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
