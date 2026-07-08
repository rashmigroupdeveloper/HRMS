import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Tooltip — the small charcoal pill (docs/12 §7: "tooltips are small black
 * pills"). Motion doctrine (docs/05 §2.3): the FIRST tooltip is delayed to
 * prevent accidental fire; while one was just open, adjacent tooltips appear
 * INSTANTLY with no animation — this is what makes a toolbar or a muster grid
 * feel fast. Keyboard-reachable: shows on focus, hides on blur/Escape (§7
 * "tooltips keyboard-reachable").
 *
 * Wraps a single element child and wires `aria-describedby` to it. Content is
 * supplementary only — never put load-bearing text exclusively in a tooltip.
 */

const OPEN_DELAY_MS = 350;
/** After any tooltip hides, siblings shown within this window skip the delay. */
const WARM_WINDOW_MS = 450;

// Module-level warmth: shared across every Tooltip instance by design, so
// sweeping the cursor along a toolbar feels instantaneous after the first.
let warmUntil = 0;

type Side = 'top' | 'bottom';

interface TooltipProps {
  label: ReactNode;
  side?: Side;
  /** Exactly one element (button, cell, icon…) that anchors the tooltip. */
  children: ReactElement<{ 'aria-describedby'?: string | undefined }>;
}

const SIDE_POS: Record<Side, string> = {
  top: 'bottom-full mb-1.5 origin-bottom',
  bottom: 'top-full mt-1.5 origin-top',
};

export function Tooltip({ label, side = 'top', children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (Date.now() < warmUntil) {
      setInstant(true);
      setOpen(true);
      return;
    }
    setInstant(false);
    showTimer.current = setTimeout(() => {
      setOpen(true);
    }, OPEN_DELAY_MS);
  };

  const hide = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    setOpen((was) => {
      if (was) warmUntil = Date.now() + WARM_WINDOW_MS;
      return false;
    });
  };

  // Escape dismisses without moving focus (docs/05 §7 keyboard support).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    },
    [],
  );

  const anchor = isValidElement(children)
    ? cloneElement(children, { 'aria-describedby': open ? id : undefined })
    : children;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {anchor}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-40 -translate-x-1/2',
            'whitespace-nowrap rounded-full bg-hero px-2.5 py-1',
            'text-xs font-medium text-hero-ink u-shadow-float',
            SIDE_POS[side],
            // Adjacent tooltips render with NO animation (docs/05 §2.3).
            !instant && 'motion-safe:animate-[u-pop_150ms_var(--ease-out-strong)]',
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
