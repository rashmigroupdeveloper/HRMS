import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from './cn';

/**
 * CardLink — the round ↗ button in a card's top-right corner (Crextio
 * reference, docs/12 §7). Icon-only on screen; `label` is its accessible name
 * and tooltip, so "Open queue" still reads as "Open queue".
 */
export function CardLink({ to, label, tone = 'light' }: { to: string; label: string; tone?: 'light' | 'dark' }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={cn(
        'u-press group grid size-9 place-items-center rounded-full transition-colors duration-(--motion-micro) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        tone === 'dark'
          ? 'bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] text-hero-ink hover:bg-[color-mix(in_srgb,var(--surface)_20%,transparent)]'
          : 'bg-surface-2 text-ink ring-1 ring-inset ring-line hover:bg-surface',
      )}
    >
      <ArrowUpRight
        className="size-4 transition-transform duration-(--motion-micro) ease-(--ease-out-strong) group-hover:-translate-y-px group-hover:translate-x-px"
        aria-hidden
      />
    </Link>
  );
}
