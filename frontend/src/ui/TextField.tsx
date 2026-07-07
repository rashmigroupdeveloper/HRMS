import { useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from './cn';

/**
 * TextField — the one text-input vocabulary for the whole product
 * (docs/05 §0.1 firewall: compose from the kit, never invent a primitive).
 *
 * Encodes the form doctrine (docs/05 §241, §284) so no screen has to re-derive it:
 *   - Label is ALWAYS visible, above the field — never placeholder-as-label (§284).
 *   - Error shows BELOW the field, names the cause, and is announced (`role="alert"`).
 *   - `aria-invalid` + `aria-describedby` wire the field to its error / hint for SR.
 *   - Validation timing (blur, not keystroke) is the caller's job — this component
 *     only renders the `error` it is given (§241 "inline validation on blur").
 *
 * Ships the seven states (docs/05 §7b): default, hover, focus, filled, disabled,
 * error, plus a password-reveal affordance. Zero hardcoded hex — tokens only.
 */

interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Validation message; when present the field enters its error state. */
  error?: string | undefined;
  /** Helper text shown below when there is no error. */
  hint?: string | undefined;
  /** Icon rendered inside the field, leading edge (Lucide only, §7). */
  leadingIcon?: ReactNode;
  /** Forwarded to the underlying input (e.g. focus-first-invalid on submit). */
  ref?: Ref<HTMLInputElement>;
}

const FIELD_BASE =
  'peer h-11 w-full rounded-row bg-surface-2 text-sm text-ink ' +
  'placeholder:text-ink-faint outline-none transition-[box-shadow,background-color] ' +
  'duration-[var(--motion-micro)] ease-[var(--ease-std)] ' +
  'ring-1 ring-inset ring-transparent ' +
  'hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-2))] ' +
  'focus:bg-surface focus:ring-2 focus:ring-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const FIELD_ERROR =
  'ring-2 ring-negative focus:ring-negative bg-[color-mix(in_srgb,var(--negative)_7%,var(--surface-2))]';

export function TextField({
  label,
  error,
  hint,
  leadingIcon,
  type = 'text',
  className,
  disabled,
  required,
  ref,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const resolvedType = isPassword && revealed ? 'text' : type;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-ink"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-negative" aria-hidden>
            *
          </span>
        )}
      </label>

      <div className="relative">
        {leadingIcon && (
          <span
            className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-faint peer-focus:text-ink-muted [&_svg]:size-[1.1rem]"
            aria-hidden
          >
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={resolvedType}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            FIELD_BASE,
            leadingIcon ? 'pl-10' : 'pl-3.5',
            isPassword ? 'pr-11' : 'pr-3.5',
            error && FIELD_ERROR,
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => {
              setRevealed((v) => !v);
            }}
            disabled={disabled}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="u-press absolute inset-y-0 right-1 grid w-9 place-items-center rounded-row text-ink-faint hover:text-ink [&_svg]:size-[1.1rem]"
          >
            {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
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
