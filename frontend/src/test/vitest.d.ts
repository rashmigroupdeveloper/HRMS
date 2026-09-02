/**
 * Type declaration for the custom axe matcher registered in `setup.ts`.
 * Without it the repo's max-strict typecheck rejects `toHaveNoViolations`.
 */
import type { AxeResults } from 'axe-core';

interface AxeMatchers<R = unknown> {
  /** Asserts axe-core found no accessibility violations. */
  toHaveNoViolations: () => R;
}

declare module 'vitest' {
  interface Matchers<T = unknown> extends AxeMatchers<T> {
    _axeResults?: AxeResults;
  }
}

export {};
