import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { toHaveNoViolations } from './axe';

expect.extend({ toHaveNoViolations });

afterEach(() => {
  cleanup();
});

/*
 * jsdom shims. Each of these is a jsdom GAP, not a component defect — the
 * components use standard browser APIs that jsdom does not implement.
 */

// matchMedia: components query reduced-motion and hover capability.
window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

// Components enter via requestAnimationFrame (docs/05 §2.3 — never animate
// from scale(0)). Left async, that callback lands OUTSIDE React's act() scope
// and produces both a warning and a real ordering flake. Running it
// synchronously makes entrance state deterministic without changing
// production behaviour.
// The timestamp is advanced far past any animation duration so a rAF-driven
// tween reaches its final frame immediately and does NOT schedule another —
// a synchronous shim that passed the real clock would recurse forever, because
// `performance.now()` never moves inside a synchronous call stack.
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  cb(performance.now() + 1_000_000);
  return 0;
};
globalThis.cancelAnimationFrame = (): void => undefined;

// Select keeps the active option in view with scrollIntoView.
Element.prototype.scrollIntoView = function scrollIntoView(): void {
  /* no-op in jsdom */
};

// This jsdom build exposes sessionStorage but not localStorage; the theme
// hook persists the user's explicit light/dark choice there.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- typed as always present, but this jsdom build leaves it undefined at runtime
if (window.localStorage === undefined) {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string): string | null => store.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        store.set(key, value);
      },
      removeItem: (key: string): void => {
        store.delete(key);
      },
      clear: (): void => {
        store.clear();
      },
      key: (index: number): string | null => [...store.keys()][index] ?? null,
      get length(): number {
        return store.size;
      },
    },
  });
}

// Virtualized DataTable observes its scroll container.
globalThis.ResizeObserver = class ResizeObserver {
  observe(): void {
    /* no-op */
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
};
