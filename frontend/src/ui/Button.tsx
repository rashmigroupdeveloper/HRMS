import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

/**
 * Button — the one button vocabulary for the whole product (docs/05 §7b:
 * "if the Save button looks different on two screens, one of them is wrong").
 *
 * Ships all seven states (docs/05 §7b): default, hover, focus, active,
 * disabled, loading, error is expressed by the `danger` variant + typed-confirm
 * flows, not a per-button error color.
 *
 * Variants:
 *   primary  — one gold CTA per view (§1 rule 2). accent fill, ink text.
 *   hero     — charcoal fill for the dark surfaces / the single hero action.
 *   secondary— surface-2 fill, quiet.
 *   ghost    — transparent until hover; toolbars.
 *   danger   — negative-tinted; destructive, always paired with confirm.
 */

type Variant = 'primary' | 'hero' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const BASE =
  'u-press inline-flex select-none items-center justify-center gap-2 rounded-full font-medium ' +
  'whitespace-nowrap transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)] ' +
  'disabled:pointer-events-none disabled:opacity-45';

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-[0.95rem]',
};

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:brightness-[0.96] active:brightness-95',
  hero: 'bg-hero text-hero-ink hover:brightness-125 active:brightness-110',
  secondary:
    'bg-surface-2 text-ink hover:bg-[color-mix(in_srgb,var(--ink)_7%,var(--surface-2))]',
  ghost:
    'bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger:
    'bg-[color-mix(in_srgb,var(--negative)_14%,var(--surface))] text-negative ' +
    'hover:bg-[color-mix(in_srgb,var(--negative)_22%,var(--surface))]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={(disabled ?? false) || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        leadingIcon
      )}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}
