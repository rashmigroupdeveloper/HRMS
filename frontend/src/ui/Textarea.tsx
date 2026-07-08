import { useId, useState } from 'react';
import type { TextareaHTMLAttributes, Ref } from 'react';
import { cn } from './cn';

/**
 * Textarea — multi-line sibling of TextField, same form doctrine (docs/05
 * §241, §284): label always visible above, error below naming the cause
 * (`role="alert"`), `aria-invalid`/`aria-describedby` wired, validation timing
 * owned by the caller. Optional live character counter for bounded fields
 * (leave reasons, remarks) — counts go warning-toned near the limit so the
 * user is never surprised by a hard stop.
 */

interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  /** Show a live `used / max` counter (requires `maxLength`). */
  showCount?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

const AREA_BASE =
  'w-full resize-y rounded-row bg-surface-2 px-3.5 py-2.5 text-sm text-ink ' +
  'placeholder:text-ink-faint outline-none transition-[box-shadow,background-color] ' +
  'duration-[var(--motion-micro)] ease-[var(--ease-std)] ' +
  'ring-1 ring-inset ring-transparent ' +
  'hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-2))] ' +
  'focus:bg-surface focus:ring-2 focus:ring-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const AREA_ERROR =
  'ring-2 ring-negative focus:ring-negative bg-[color-mix(in_srgb,var(--negative)_7%,var(--surface-2))]';

export function Textarea({
  label,
  error,
  hint,
  showCount = false,
  maxLength,
  defaultValue,
  value,
  onChange,
  rows = 4,
  className,
  disabled,
  required,
  ref,
  ...rest
}: TextareaProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  // Counter tracks length for uncontrolled usage too.
  const [innerLen, setInnerLen] = useState(
    () => String(defaultValue ?? '').length,
  );
  const usedLen = typeof value === 'string' ? value.length : innerLen;
  const nearLimit =
    maxLength !== undefined && usedLen >= Math.floor(maxLength * 0.9);

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-negative" aria-hidden>
              *
            </span>
          )}
        </label>
        {showCount && maxLength !== undefined && (
          <span
            className={cn(
              'text-xs tabular-nums',
              nearLimit ? 'font-medium text-warning' : 'text-ink-faint',
            )}
            aria-hidden
          >
            {String(usedLen)}/{String(maxLength)}
          </span>
        )}
      </div>

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        required={required}
        value={value}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          setInnerLen(e.currentTarget.value.length);
          onChange?.(e);
        }}
        className={cn(AREA_BASE, error && AREA_ERROR)}
        {...rest}
      />

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
