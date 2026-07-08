import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import {
  WEEKDAYS_MIN,
  addMonths,
  formatDateIN,
  monthLabel,
  monthMatrix,
  todayISOIST,
} from './calendar';

/**
 * DatePicker — the one date-input vocabulary (docs/05 §5 FormField primitives;
 * §6 kill-list #9 "every date input uses the right widget"). Same field
 * doctrine as TextField: visible label, error below with `role="alert"`.
 * Value is exchanged as ISO `YYYY-MM-DD`; displayed as `DD MMM YYYY` (§10).
 *
 * Popover scales from the trigger (docs/05 §2.3), `--motion-short`. Keyboard:
 * arrows walk days (crossing month edges re-pages the view), Enter selects,
 * Escape closes and returns focus to the trigger.
 */

interface DatePickerProps {
  label: string;
  /** ISO `YYYY-MM-DD` or null when unset. */
  value: string | null;
  onChange: (iso: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  /** Inclusive ISO bounds — days outside are unpickable. */
  min?: string | undefined;
  max?: string | undefined;
  placeholder?: string;
  className?: string;
}

const TRIGGER_BASE =
  'flex h-11 w-full items-center gap-2.5 rounded-row bg-surface-2 px-3.5 text-left text-sm ' +
  'outline-none transition-[box-shadow,background-color] duration-[var(--motion-micro)] ease-[var(--ease-std)] ' +
  'ring-1 ring-inset ring-transparent ' +
  'hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-2))] ' +
  'focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const TRIGGER_ERROR =
  'ring-2 ring-negative bg-[color-mix(in_srgb,var(--negative)_7%,var(--surface-2))]';

function isoToParts(iso: string): { year: number; month: number } {
  const [y, m] = iso.split('-').map(Number);
  return { year: y ?? new Date().getFullYear(), month: m ?? 1 };
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  disabled,
  min,
  max,
  placeholder = 'Select date',
  className,
}: DatePickerProps) {
  const id = useId();
  const todayISO = todayISOIST();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [view, setView] = useState(() => isoToParts(value ?? todayISO));
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const outOfRange = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);

  const openPopover = () => {
    setView(isoToParts(value ?? todayISO));
    pendingFocus.current = value ?? todayISO;
    setOpen(true);
  };

  const close = (refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) document.getElementById(id)?.focus();
  };

  // Enter animation (mount → next-frame flip, the kit recipe).
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      setEntered(true);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [open]);

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // After open / month page, land focus on the intended day.
  useEffect(() => {
    if (!open || pendingFocus.current === null) return;
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-iso="${pendingFocus.current}"]`,
    );
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  });

  const moveFocus = (fromISO: string, deltaDays: number) => {
    const [y, m, d] = fromISO.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return;
    const next = new Date(Date.UTC(y, m - 1, d + deltaDays));
    const nextISO = next.toISOString().slice(0, 10);
    if (outOfRange(nextISO)) return;
    const target = {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
    };
    pendingFocus.current = nextISO;
    if (target.year !== view.year || target.month !== view.month) {
      setView(target);
    } else {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-iso="${nextISO}"]`)
        ?.focus();
      pendingFocus.current = null;
    }
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const iso = (document.activeElement as HTMLElement | null)?.dataset['iso'];
    if (iso === undefined) return;
    const step =
      e.key === 'ArrowRight' ? 1
      : e.key === 'ArrowLeft' ? -1
      : e.key === 'ArrowDown' ? 7
      : e.key === 'ArrowUp' ? -7
      : 0;
    if (step !== 0) {
      e.preventDefault();
      moveFocus(iso, step);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  };

  const weeks = monthMatrix(view.year, view.month);

  return (
    <div className={className} ref={rootRef}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-ink"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(id)?.focus();
        }}
      >
        {label}
        {required && (
          <span className="ml-0.5 text-negative" aria-hidden>
            *
          </span>
        )}
      </label>

      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => {
            if (open) close(false);
            else openPopover();
          }}
          className={cn(TRIGGER_BASE, error && TRIGGER_ERROR)}
        >
          <CalendarDays
            aria-hidden
            className="size-[1.1rem] shrink-0 text-ink-faint"
          />
          <span className={value !== null ? 'text-ink' : 'text-ink-faint'}>
            {value !== null ? formatDateIN(value) : placeholder}
          </span>
        </button>

        {open && (
          <div
            role="dialog"
            aria-label={`Choose ${label.toLowerCase()}`}
            className={cn(
              'absolute left-0 top-full z-30 mt-1.5 w-[19.5rem] origin-top',
              'rounded-tile bg-surface p-3 u-shadow-float',
              'transition-[opacity,transform] duration-[var(--motion-short)] ease-[var(--ease-out-strong)]',
              entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            )}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <IconButton
                label="Previous month"
                icon={<ChevronLeft />}
                size="sm"
                onClick={() => {
                  setView((v) => addMonths(v.year, v.month, -1));
                }}
              />
              <span className="text-sm font-semibold text-ink" aria-live="polite">
                {monthLabel(view.year, view.month)}
              </span>
              <IconButton
                label="Next month"
                icon={<ChevronRight />}
                size="sm"
                onClick={() => {
                  setView((v) => addMonths(v.year, v.month, 1));
                }}
              />
            </div>

            <div className="grid grid-cols-7" aria-hidden>
              {WEEKDAYS_MIN.map((wd) => (
                <span
                  key={wd}
                  className="grid h-7 place-items-center text-[11px] font-medium text-ink-faint"
                >
                  {wd}
                </span>
              ))}
            </div>

            <div
              ref={gridRef}
              role="grid"
              onKeyDown={onGridKeyDown}
              className="grid grid-cols-7 gap-y-0.5"
            >
              {weeks.flat().map((cell) => {
                const isSelected = cell.iso === value;
                const isToday = cell.iso === todayISO;
                const blocked = outOfRange(cell.iso);
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    data-iso={cell.iso}
                    tabIndex={-1}
                    disabled={blocked}
                    aria-label={formatDateIN(cell.iso)}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(cell.iso);
                      close(true);
                    }}
                    className={cn(
                      'u-press grid h-9 place-items-center rounded-[10px] text-sm tabular-nums',
                      'transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)]',
                      cell.inMonth ? 'text-ink' : 'text-ink-faint',
                      isSelected
                        ? 'bg-accent font-semibold text-accent-ink'
                        : 'hover:bg-surface-2',
                      isToday && !isSelected && 'ring-1 ring-inset ring-line-strong',
                      blocked && 'pointer-events-none opacity-35',
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs font-medium text-negative"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
