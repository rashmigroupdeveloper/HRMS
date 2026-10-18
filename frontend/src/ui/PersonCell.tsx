import { cn } from './cn';

/**
 * PersonCell — initials avatar + name (+ optional secondary line), the table
 * row identity used in the Crextio reference (docs/12 §7). The avatar tint is
 * derived from the name so a person keeps the same colour on every screen.
 */
const TINTS = [
  'bg-accent-soft text-ink',
  'bg-hero text-hero-ink',
  'bg-surface-2 text-ink ring-1 ring-inset ring-line',
] as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

function tintOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length] ?? TINTS[0];
}

export function PersonCell({
  name,
  sub,
  className,
}: {
  name: string;
  sub?: string | null;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <span
        aria-hidden
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
          tintOf(name),
        )}
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{name}</span>
        {sub ? <span className="block truncate text-xs text-ink-muted">{sub}</span> : null}
      </span>
    </span>
  );
}
