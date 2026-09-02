/**
 * Minimal axe-core ↔ vitest bridge.
 *
 * `jest-axe` targets Jest's matcher API and drags in its own expect; wiring
 * axe-core directly is a dozen lines and keeps the dependency surface small
 * (the repo already bans a second component library for the same reason).
 */
import axe, { type AxeResults, type ElementContext, type RunOptions } from 'axe-core';

/** Run axe against a container and return the raw results. */
export async function runAxe(container: ElementContext, options?: RunOptions): Promise<AxeResults> {
  return axe.run(container, {
    // Colour-contrast needs real layout+paint, which jsdom does not do; it is
    // asserted in the token tests and by design review instead of faked here.
    rules: { 'color-contrast': { enabled: false } },
    ...options,
  });
}

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

export function toHaveNoViolations(results: AxeResults): MatcherResult {
  const { violations } = results;
  if (violations.length === 0) {
    return { pass: true, message: () => 'expected accessibility violations, found none' };
  }
  const detail = violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => `      ${node.html}`).join('\n');
      return `  [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n${nodes}`;
    })
    .join('\n\n');
  return {
    pass: false,
    message: () => `expected no accessibility violations, found ${String(violations.length)}:\n\n${detail}`,
  };
}
