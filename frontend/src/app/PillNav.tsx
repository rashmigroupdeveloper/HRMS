/**
 * Center pill cluster — Crextio's dark-active segment (docs/05 §3, 12 §7).
 * A charcoal thumb slides under the active item. Gold is reserved for today's
 * job, never for "you are here".
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../ui';
import type { NavItem } from './nav-config';

interface PillNavProps {
  pills: NavItem[];
  moreCount: number;
  moreOpen: boolean;
  moreActive: boolean;
  onToggleMore: () => void;
}

export function PillNav({ pills, moreCount, moreOpen, moreActive, onToggleMore }: PillNavProps) {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });
  const thumbOnMore = moreActive || moreOpen;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = (): void => {
      const target = thumbOnMore
        ? nav.querySelector('button')
        : nav.querySelector('[aria-current="page"]');
      if (!(target instanceof HTMLElement)) return;
      const navBox = nav.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      setThumb({ x: box.left - navBox.left, w: box.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => {
      observer.disconnect();
    };
  }, [location.pathname, pills, thumbOnMore]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className="relative flex items-center rounded-full bg-surface p-1.5 u-shadow-float"
    >
      <span
        data-pill-thumb
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-hero"
        style={{
          width: thumb.w,
          opacity: thumb.w > 0 ? 1 : 0,
          transform: `translateX(${String(thumb.x)}px)`,
          transition:
            thumb.w > 0
              ? 'transform var(--motion-micro) var(--ease-out-strong), width var(--motion-micro) var(--ease-out-strong), opacity var(--motion-micro) var(--ease-std)'
              : undefined,
        }}
      />
      {pills.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'relative z-10 u-press rounded-full px-4 py-2 text-sm font-medium',
              'transition-colors duration-(--motion-micro)',
              isActive ? 'text-hero-ink' : 'text-ink-muted hover:text-ink',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
      {moreCount > 0 ? (
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={onToggleMore}
          className={cn(
            'relative z-10 u-press rounded-full px-4 py-2 text-sm font-medium',
            'transition-colors duration-(--motion-micro)',
            thumbOnMore ? 'text-hero-ink' : 'text-ink-muted hover:text-ink',
          )}
        >
          More
        </button>
      ) : null}
    </nav>
  );
}
