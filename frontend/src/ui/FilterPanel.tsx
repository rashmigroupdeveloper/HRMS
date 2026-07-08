import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { Pill } from './StatusBadge';
import { Skeleton } from './Skeleton';

/**
 * FilterPanel — the accordion filter rail every list screen shares (docs/05
 * §5: "FilterPanel (accordion, async)"). Lives inside a Drawer on desktop
 * directories and musters.
 *
 * Doctrine encoded here:
 *   - Active-filter count is always visible + one-tap "Clear all" (docs/05 §8
 *     "empty states offer clear filters" — the escape hatch lives at the top).
 *   - Sections expand/collapse INSTANTLY (frequency test §2.1: HR ops toggles
 *     these tens of times a day — only the chevron turns, content never
 *     animates in their way).
 *   - `loading` renders skeleton lines shaped like the option list (async
 *     facets — entity/department counts arrive from the API).
 *
 * Persisting chosen filters per user (kill-list #2) is the SCREEN's job —
 * this component is controlled and stateless about values.
 */

interface FilterPanelProps {
  /** Number of filters currently applied — drives the count pill + Clear all. */
  activeCount?: number;
  onClearAll?: () => void;
  children: ReactNode;
  className?: string;
}

export function FilterPanel({
  activeCount = 0,
  onClearAll,
  children,
  className,
}: FilterPanelProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 pb-1">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          Filters
          {activeCount > 0 && <Pill accent>{activeCount}</Pill>}
        </span>
        {onClearAll !== undefined && activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="u-press rounded-full px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-[var(--motion-micro)] hover:text-ink"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  /** Selected-in-this-section count shown beside the title. */
  count?: number;
  defaultOpen?: boolean;
  /** Async facet still loading — renders layout-matching skeleton lines. */
  loading?: boolean;
  children: ReactNode;
}

export function FilterSection({
  title,
  count = 0,
  defaultOpen = true,
  loading = false,
  children,
}: FilterSectionProps) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="py-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-row px-1 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          {title}
          {count > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold tabular-nums text-accent-ink">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 text-ink-faint transition-transform duration-[var(--motion-micro)] ease-[var(--ease-out-strong)]',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div id={`${id}-body`} className="space-y-3 px-1 pb-3 pt-1">
          {loading ? (
            <div aria-busy className="space-y-3">
              <Skeleton className="w-3/4" />
              <Skeleton className="w-2/3" />
              <Skeleton className="w-4/5" />
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}
