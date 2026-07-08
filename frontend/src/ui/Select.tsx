import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';

/**
 * Select — the one dropdown vocabulary (docs/05 §5 FormField primitives;
 * §7b: same form controls on every screen). Same field doctrine as TextField:
 * visible label above, error below with `role="alert"`, tokens only.
 *
 * ARIA combobox/listbox pattern: focus stays on the trigger, the active option
 * is conveyed via `aria-activedescendant`. Keyboard: ArrowUp/Down, Home/End,
 * Enter/Space select, Escape closes, single-character typeahead cycles.
 *
 * Motion (docs/05 §2.3): the popover scales from its trigger (origin-top),
 * `--motion-short` + `--ease-out-strong`, enters from scale(0.95)+fade —
 * never from scale(0). Exit is instant (dropdown dismissal is a 100×/day
 * action — the frequency test says don't make the user watch it leave).
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Quiet second line (e.g. leave balance next to the leave type). */
  description?: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
}

const TRIGGER_BASE =
  'flex h-11 w-full items-center gap-2 rounded-row bg-surface-2 px-3.5 text-left text-sm ' +
  'outline-none transition-[box-shadow,background-color] duration-[var(--motion-micro)] ease-[var(--ease-std)] ' +
  'ring-1 ring-inset ring-transparent ' +
  'hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-2))] ' +
  'focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const TRIGGER_ERROR =
  'ring-2 ring-negative bg-[color-mix(in_srgb,var(--negative)_7%,var(--surface-2))]';

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  error,
  hint,
  required,
  disabled,
  leadingIcon,
  className,
}: SelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const openList = () => {
    const start = options.findIndex((o) => o.value === value);
    setActiveIndex(start >= 0 ? start : 0);
    setOpen(true);
  };

  const pick = (index: number) => {
    const opt = options[index];
    if (opt) onChange(opt.value);
    setOpen(false);
  };

  // Enter animation: mount → next frame flip (same recipe as Drawer).
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

  // Keep the active option in view while arrowing.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(`${id}-opt-${String(activeIndex)}`)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, id]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default: {
        // Single-character typeahead, cycling from the active option.
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const ch = e.key.toLowerCase();
          const from = activeIndex + 1;
          const order = [...options.keys()].map(
            (i) => (from + i) % options.length,
          );
          const hit = order.find((i) =>
            options[i]?.label.toLowerCase().startsWith(ch),
          );
          if (hit !== undefined) setActiveIndex(hit);
        }
      }
    }
  };

  return (
    <div className={className} ref={rootRef}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-ink"
        onClick={(e) => {
          e.preventDefault(); // label→button focus, don't toggle twice
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
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          aria-activedescendant={
            open ? `${id}-opt-${String(activeIndex)}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => {
            if (open) setOpen(false);
            else openList();
          }}
          onKeyDown={onTriggerKeyDown}
          className={cn(TRIGGER_BASE, error && TRIGGER_ERROR)}
        >
          {leadingIcon && (
            <span className="text-ink-faint [&_svg]:size-[1.1rem]" aria-hidden>
              {leadingIcon}
            </span>
          )}
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              selected ? 'text-ink' : 'text-ink-faint',
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-ink-faint transition-transform duration-[var(--motion-micro)] ease-[var(--ease-out-strong)]',
              open && 'rotate-180',
            )}
          />
        </button>

        {open && (
          <div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className={cn(
              'absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 origin-top overflow-auto',
              'rounded-tile bg-surface p-1.5 u-shadow-float',
              'transition-[opacity,transform] duration-[var(--motion-short)] ease-[var(--ease-out-strong)]',
              entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            )}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <div
                  key={opt.value}
                  id={`${id}-opt-${String(i)}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => {
                    setActiveIndex(i);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus on the trigger
                  }}
                  onClick={() => {
                    pick(i);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-sm',
                    isActive ? 'bg-surface-2 text-ink' : 'text-ink',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn('block truncate', isSelected && 'font-semibold')}
                    >
                      {opt.label}
                    </span>
                    {opt.description !== undefined && (
                      <span className="block truncate text-xs text-ink-muted">
                        {opt.description}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <Check aria-hidden className="size-4 shrink-0 text-ink" />
                  )}
                </div>
              );
            })}
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
