/**
 * Center pill cluster — Crextio's dark-active segment (docs/05 §3, 12 §7).
 * A charcoal thumb slides under the active item. Gold is reserved for today's
 * job, never for "you are here".
 *
 * Priority+ overflow: Windows laptops at 125–150% scaling give the masthead
 * only ~1090–1280 CSS px. Pills that do not fit move into More (in order)
 * instead of wrapping or clipping — measured from an invisible ruler row with
 * a ResizeObserver, never a scroll/resize listener (docs/05 §2.4).
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../ui';
import type { NavItem } from './nav-config';
import { isNavActive } from './nav-config';

interface PillNavProps {
  pills: NavItem[];
  /** Items always in More (secondary + beyond the cap). */
  moreCount: number;
  moreOpen: boolean;
  moreActive: boolean;
  onToggleMore: () => void;
  /** Reports pills that did not fit so the shell can list them under More. */
  onOverflow: (items: NavItem[]) => void;
}

const PILL = 'relative z-10 u-press whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium';

export function PillNav({ pills, moreCount, moreOpen, moreActive, onToggleMore, onOverflow }: PillNavProps) {
  const location = useLocation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(pills.length);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });
  const overflow = pills.slice(fit);
  const hasMore = moreCount + overflow.length > 0;
  const overflowActive = overflow.some((item) => isNavActive(location.pathname, item));
  const thumbOnMore = moreActive || moreOpen || overflowActive;

  // How many pills fit in the space the masthead gives us?
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const ruler = rulerRef.current;
    if (!wrap || !ruler) return;
    const measure = (): void => {
      if (wrap.clientWidth === 0) {
        setFit(pills.length); // not laid out (jsdom / hidden) — show everything
        return;
      }
      const widths = [...ruler.children].map((child) => (child as HTMLElement).offsetWidth);
      const moreWidth = widths.pop() ?? 80;
      const available = wrap.clientWidth - 12; // nav padding
      let used = 0;
      let count = 0;
      for (const [index, width] of widths.entries()) {
        const needsMore = moreCount > 0 || index < widths.length - 1;
        if (used + width + (needsMore ? moreWidth : 0) > available) break;
        used += width;
        count += 1;
      }
      setFit(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    if ('fonts' in document) void document.fonts.ready.then(measure);
    return () => {
      observer.disconnect();
    };
  }, [pills, moreCount]);

  const overflowKey = overflow.map((item) => item.to).join('|');
  useLayoutEffect(() => {
    onOverflow(pills.slice(fit));
    // Keyed by overflowKey on purpose: report only when the overflow set changes.
  }, [overflowKey]);

  // Slide the charcoal thumb under the active pill (or More).
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = (): void => {
      const target = thumbOnMore
        ? nav.querySelector('[data-more]')
        : nav.querySelector('[aria-current="page"]');
      if (!(target instanceof HTMLElement)) {
        setThumb({ x: 0, w: 0 });
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      setThumb({ x: box.left - navBox.left, w: box.width });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => {
      observer.disconnect();
    };
  }, [location.pathname, fit, thumbOnMore]);

  return (
    <div ref={wrapRef} className="relative flex min-w-0 flex-1 justify-center">
      {/* Invisible ruler: natural width of every pill + More. */}
      <div ref={rulerRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex" inert>
        {pills.map((item) => (
          <span key={item.to} className={PILL}>
            {item.label}
          </span>
        ))}
        <span className={cn(PILL, 'inline-flex items-center gap-1')}>
          More <ChevronDown className="size-3.5" />
        </span>
      </div>

      <nav ref={navRef} aria-label="Primary" className="relative flex items-center rounded-full bg-surface p-1.5 u-shadow-float">
        <span
          aria-hidden
          data-pill-thumb
          className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full bg-hero"
          style={{
            width: thumb.w,
            opacity: thumb.w > 0 ? 1 : 0,
            transform: `translateX(${String(thumb.x)}px)`,
            transition:
              thumb.w > 0
                ? 'transform var(--motion-short) var(--ease-out-strong), width var(--motion-short) var(--ease-out-strong), opacity var(--motion-micro) var(--ease-std)'
                : undefined,
          }}
        />
        {pills.slice(0, fit).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(PILL, 'transition-colors duration-(--motion-micro)', isActive ? 'text-hero-ink' : 'text-ink-muted hover:text-ink')
            }
          >
            {item.label}
          </NavLink>
        ))}
        {hasMore ? (
          <button
            type="button"
            data-more
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={onToggleMore}
            className={cn(
              PILL,
              'inline-flex items-center gap-1 transition-colors duration-(--motion-micro)',
              thumbOnMore ? 'text-hero-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            More
            <ChevronDown className={cn('size-3.5 transition-transform duration-(--motion-micro)', moreOpen && 'rotate-180')} aria-hidden />
          </button>
        ) : null}
      </nav>
    </div>
  );
}
