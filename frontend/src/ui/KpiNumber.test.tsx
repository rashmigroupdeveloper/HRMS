/**
 * KpiNumber (docs/05 §2.5, §6).
 *
 * The rule: a KPI counts up ONCE on load and on a real change — never on a
 * poll — and under reduced motion it SNAPS, because the number is content and
 * the animation is decoration.
 *
 * Regression guard: this component seeded `display` with `value`, so on mount
 * `from === to` and the count-up returned immediately. It animated only on
 * later changes — the exact opposite of the spec — which made the CEO
 * dashboard's "counters roll in on first paint" impossible to build.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { KpiNumber } from './KpiNumber';
import { renderThemed } from '../test/render';

function stubReducedMotion(reduced: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe('KpiNumber', () => {
  it('counts UP from zero on mount rather than starting at the final value', () => {
    stubReducedMotion(false);

    // Drive frames by hand: the global test shim runs rAF synchronously, which
    // would recurse forever here because performance.now() never advances.
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const t0 = performance.now();
    vi.spyOn(performance, 'now').mockReturnValue(t0);

    renderThemed(<KpiNumber value={1000} duration={800} />);

    // Frame 0: the mount value must be BELOW the target — proof it counts up
    // from zero rather than being seeded with the final number.
    // textContent is typed non-null for a found element.
    const first = Number(screen.getByText(/[\d,]+/).textContent.replace(/,/g, ''));
    expect(first).toBeLessThan(1000);

    // Advance to the end of the animation and run the pending frame.
    vi.spyOn(performance, 'now').mockReturnValue(t0 + 900);
    const next = frames.at(-1);
    expect(next).toBeDefined();
    if (next) act(() => { next(t0 + 900); });

    expect(screen.getByText('1,000')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('snaps straight to the value under reduced motion', () => {
    stubReducedMotion(true);
    renderThemed(<KpiNumber value={2412} />);
    expect(screen.getByText('2,412')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders the exact value when animation is disabled', () => {
    stubReducedMotion(false);
    renderThemed(<KpiNumber value={2412} duration={0} />);
    expect(screen.getByText('2,412')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('honours animateOnMount=false for surfaces where a count-up is noise', () => {
    stubReducedMotion(false);
    renderThemed(<KpiNumber value={87} animateOnMount={false} />);
    expect(screen.getByText('87')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('groups with Indian lakh/crore separators', () => {
    stubReducedMotion(true);
    renderThemed(<KpiNumber value={12345678} />);
    expect(screen.getByText('1,23,45,678')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('supports prefix, suffix and precision for money and percentages', () => {
    stubReducedMotion(true);
    const { container } = renderThemed(
      <KpiNumber value={97.5} precision={1} prefix="₹" suffix="%" />,
    );
    expect(container.textContent).toContain('₹');
    expect(container.textContent).toContain('97.5');
    expect(container.textContent).toContain('%');
    vi.restoreAllMocks();
  });

  it('accepts a stagger delay without changing the final value', () => {
    stubReducedMotion(true);
    renderThemed(<KpiNumber value={500} delay={120} />);
    // Reduced motion ignores the delay and snaps — a staggered entrance must
    // never withhold the number from someone who asked for less motion.
    expect(screen.getByText('500')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
