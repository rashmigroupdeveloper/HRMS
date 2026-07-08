import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

/**
 * Checkbox — the one checkbox vocabulary (docs/05 §7b: same form controls on
 * every screen). A real `<input type="checkbox">` drives state and a11y
 * (sr-only, peer); the visible box is drawn from tokens. Checked = gold fill
 * with an ink check (the Crextio accent used as *state*, not decoration).
 *
 * Label is ALWAYS visible and part of the hit area (docs/05 §7 touch targets);
 * `description` adds quiet secondary context under the label.
 */

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: string;
  description?: string | undefined;
}

export function Checkbox({
  label,
  description,
  className,
  disabled,
  ...rest
}: CheckboxProps) {
  const id = useId();
  const descId = description !== undefined ? `${id}-desc` : undefined;

  return (
    <label
      htmlFor={id}
      className={cn(
        'group flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        aria-describedby={descId}
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden
        className={cn(
          'u-press mt-0.5 grid size-5 shrink-0 place-items-center rounded-md',
          'bg-surface text-transparent ring-1 ring-inset ring-line-strong',
          'transition-[background-color,box-shadow,color] duration-[var(--motion-micro)] ease-[var(--ease-std)]',
          'group-hover:ring-ink-faint',
          'peer-checked:bg-accent peer-checked:text-accent-ink peer-checked:ring-accent',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
        )}
      >
        <Check strokeWidth={3.5} className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description !== undefined && (
          <span id={descId} className="mt-0.5 block text-xs text-ink-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
