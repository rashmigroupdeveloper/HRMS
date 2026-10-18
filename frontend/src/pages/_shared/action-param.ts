/**
 * Deep-link actions from the mobile quick-action sheet and PWA shortcuts
 * (`/my/leave?action=apply`). Read once on mount, then stripped from the URL so
 * a refresh or back-navigation does not re-open the drawer.
 *
 * Idempotent within a tick: StrictMode calls state initializers twice, so the
 * first answer is remembered briefly instead of reading the stripped URL.
 */
const recent = new Map<string, boolean>();

export function takeActionParam(expected: string): boolean {
  if (typeof window === 'undefined') return false;
  const remembered = recent.get(expected);
  if (remembered !== undefined) return remembered;
  const url = new URL(window.location.href);
  const hit = url.searchParams.get('action') === expected;
  if (hit) {
    url.searchParams.delete('action');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  recent.set(expected, hit);
  setTimeout(() => recent.delete(expected), 0);
  return hit;
}
