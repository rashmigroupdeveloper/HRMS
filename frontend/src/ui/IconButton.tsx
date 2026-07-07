import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * IconButton — the Crextio "white circle + soft shadow" icon button
 * (docs/05 §5), used pervasively (↗ open, chat, call, +, filter, ⋯).
 *
 * Accessibility: icon-only, so `label` is REQUIRED and becomes aria-label
 * (docs/05 §7 — every icon-only button carries aria-label).
 */

type Size = 'sm' | 'md' | 'lg';
type Tone = 'default' | 'accent' | 'hero';

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required accessible name — never rendered, always announced. */
  label: string;
  icon: ReactNode;
  size?: Size;
  tone?: Tone;
}

const SIZES: Record<Size, string> = {
  sm: 'size-8 [&_svg]:size-4',
  md: 'size-10 [&_svg]:size-[1.15rem]',
  lg: 'size-12 [&_svg]:size-5',
};

const TONES: Record<Tone, string> = {
  default: 'bg-surface text-ink-muted hover:text-ink',
  accent: 'bg-accent text-accent-ink',
  hero: 'bg-hero text-hero-ink',
};

export function IconButton({
  label,
  icon,
  size = 'md',
  tone = 'default',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'u-press u-shadow-card inline-grid place-items-center rounded-full',
        'transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)]',
        'disabled:pointer-events-none disabled:opacity-45',
        SIZES[size],
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
