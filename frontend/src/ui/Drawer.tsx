import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';

/**
 * Drawer — right-sliding detail panel (docs/05 §3: "drawers slide from right
 * for detail views; modals only for confirmations"). Uses `--ease-drawer`
 * (iOS-like) and `--motion-medium` (the UI ceiling). Exit runs faster than
 * enter (docs/05 §2.3). Scrim click + Esc close; body scroll locked while open;
 * focus moves in on open and is restored on close.
 *
 * Controlled: parent owns `open`. We keep the node mounted through the exit
 * animation, then unmount.
 */

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  width = 460,
  children,
}: DrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Mount → next frame flip `entered` so the CSS transition runs.
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      const id = requestAnimationFrame(() => { setEntered(true); });
      return () => { cancelAnimationFrame(id); };
    }
    setEntered(false);
    const t = setTimeout(() => { setMounted(false); }, 300); // matches --motion-medium
    return () => { clearTimeout(t); };
  }, [open]);

  // Esc to close + body scroll lock while mounted.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, onClose]);

  // Move focus into the panel on enter; restore on unmount.
  useEffect(() => {
    if (entered) panelRef.current?.focus();
    else restoreFocusRef.current?.focus();
  }, [entered]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]',
          'transition-opacity duration-[var(--motion-short)] ease-[var(--ease-std)]',
          entered ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'absolute right-0 top-0 flex h-full flex-col bg-surface outline-none',
          'shadow-[0_0_60px_-12px_color-mix(in_srgb,var(--ink)_40%,transparent)]',
          'transition-transform duration-[var(--motion-medium)] ease-[var(--ease-drawer)]',
          'will-change-transform',
        )}
        style={{
          width: `min(${String(width)}px, 100vw)`,
          transform: entered ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
            )}
          </div>
          <IconButton label="Close" icon={<X />} size="sm" onClick={onClose} />
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6">{children}</div>

        {footer && (
          <div className="border-t border-line bg-surface px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
