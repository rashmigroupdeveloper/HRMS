import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Switch — on/off toggle for settings that take effect immediately (use
 * Checkbox inside forms that are submitted). Driven by a real checkbox input
 * (`role="switch"`), thumb slides with `--motion-micro` + `--ease-out-strong`
 * on `transform` only (docs/05 §2.4). On-state = gold track — the Crextio
 * toggle signature (docs/12 §7.15) — with the thumb picking up ink so the
 * state survives a grayscale view (color never the only signal, §1 rule 6).
 */

interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'role'> {
  label: string;
  description?: string | undefined;
}

export function Switch({
  label,
  description,
  className,
  disabled,
  ...rest
}: SwitchProps) {
  const id = useId();
  const descId = description !== undefined ? `${id}-desc` : undefined;

  return (
    <label
      htmlFor={id}
      className={cn(
        'group flex items-start justify-between gap-4',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description !== undefined && (
          <span id={descId} className="mt-0.5 block text-xs text-ink-muted">
            {description}
          </span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        disabled={disabled}
        aria-describedby={descId}
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden
        className={cn(
          'relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-line-strong',
          'transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)]',
          'group-hover:bg-ink-faint',
          'peer-checked:bg-accent peer-checked:group-hover:bg-accent',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          // Thumb: transform-only slide; ink thumb when on (non-color signal).
          '[&>i]:absolute [&>i]:left-0.5 [&>i]:top-0.5 [&>i]:block [&>i]:size-5 [&>i]:rounded-full',
          '[&>i]:bg-surface [&>i]:shadow-[0_1px_3px_color-mix(in_srgb,var(--ink)_25%,transparent)]',
          '[&>i]:transition-transform [&>i]:duration-[var(--motion-micro)] [&>i]:ease-[var(--ease-out-strong)]',
          'peer-checked:[&>i]:translate-x-4 peer-checked:[&>i]:bg-accent-ink',
        )}
      >
        <i />
      </span>
    </label>
  );
}
