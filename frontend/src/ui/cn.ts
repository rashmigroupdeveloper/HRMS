/**
 * Minimal className joiner — no dependency. Falsy values are dropped so callers
 * can write `cn('base', active && 'is-active')`. Deliberately not clsx: the UI
 * kit stays dependency-light (docs/05 — one design system, no incidental deps).
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
