/**
 * Mobile quick-action sheet — slides up from the thumb bar (docs/05 §7
 * `adaptive-navigation`: mobile = bottom-sheet patterns for ESS actions).
 * Big 56px rows, one gold primary, focus trapped to the sheet while open,
 * Esc / scrim / swipe-free close button. Safe-area padded.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '../ui';
import type { QuickAction } from './quick-actions';

interface QuickActionSheetProps {
  open: boolean;
  actions: QuickAction[];
  inboxCount: number;
  onClose: () => void;
}

export function QuickActionSheet({ open, actions, inboxCount, onClose }: QuickActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const items = [...sheetRef.current.querySelectorAll<HTMLElement>('a,button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-(--z-overlay) lg:hidden">
      <button type="button" aria-label="Close quick actions" className="u-fade absolute inset-0 bg-(--scrim)" onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-actions-title"
        className="u-sheet u-shadow-lift absolute inset-x-0 bottom-0 rounded-t-card bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]"
      >
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" />
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 id="quick-actions-title" className="text-lg font-semibold text-ink">
            What do you need?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="u-press u-tap grid size-10 place-items-center rounded-full bg-surface-2 text-ink-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <ul className="u-stagger space-y-2">
          {actions.map((action) => {
            const Icon = action.icon;
            const count = action.id === 'approve' && inboxCount > 0 ? inboxCount : null;
            return (
              <li key={action.id}>
                <Link
                  to={action.to}
                  onClick={onClose}
                  className={cn(
                    'u-press flex min-h-14 items-center gap-3.5 rounded-tile px-4 py-3',
                    action.primary ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-full',
                      action.primary ? 'bg-hero text-hero-ink' : 'bg-surface text-ink u-shadow-card',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] font-semibold">{action.label}</span>
                    <span className={cn('block truncate text-xs', action.primary ? 'text-accent-ink/75' : 'text-ink-muted')}>
                      {action.hint}
                    </span>
                  </span>
                  {count !== null ? (
                    <span className="rounded-full bg-hero px-2 py-0.5 text-xs font-bold text-hero-ink tabular-nums">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : (
                    <ChevronRight className="size-4 opacity-60" aria-hidden />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
