import { Toaster as SonnerToaster } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

/**
 * Toast — the one action-feedback vocabulary (docs/05 §5 "Toast (sonner)").
 *
 * Encodes the notification doctrine so no screen re-derives it:
 *   - Never steals focus (docs/05 §6 kill-list #10) — sonner announces via
 *     aria-live polite; keyboard users are informed, never interrupted.
 *   - Undo where reversible (kill-list #6): pass `action: { label: 'Undo', … }`.
 *   - Errors always carry a recovery path (kill-list #5): a description naming
 *     the cause plus a retry/contact action — never a bare "failed".
 *
 * Usage: mount `<Toaster />` ONCE at the app root, then `toast.success(...)`,
 * `toast.error(...)` etc. from anywhere. The `toast` re-export below is the
 * only sanctioned way to fire one (docs/05 §0.1 — compose from the kit).
 */

const TOAST_BASE =
  // Warm Editorial: surface card, tile radius, float shadow — no borders.
  'pointer-events-auto flex w-[356px] items-start gap-3 rounded-tile ' +
  'bg-surface p-4 u-shadow-float';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={10}
      visibleToasts={4}
      icons={{
        success: <CheckCircle2 className="text-positive" aria-hidden />,
        error: <XCircle className="text-negative" aria-hidden />,
        warning: <AlertTriangle className="text-warning" aria-hidden />,
        info: <Info className="text-info" aria-hidden />,
        loading: <Loader2 className="animate-spin text-ink-muted" aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        duration: 4500,
        classNames: {
          toast: TOAST_BASE,
          content: 'min-w-0 flex-1',
          title: 'text-sm font-semibold text-ink',
          description: 'mt-0.5 text-xs leading-relaxed text-ink-muted',
          icon: 'mt-0.5 shrink-0 [&_svg]:size-[1.1rem]',
          actionButton:
            'u-press ml-2 h-7 shrink-0 self-center whitespace-nowrap rounded-full ' +
            'bg-accent px-3 text-xs font-semibold text-accent-ink ' +
            'transition-[filter] duration-[var(--motion-micro)] hover:brightness-[0.96]',
          cancelButton:
            'u-press ml-2 h-7 shrink-0 self-center whitespace-nowrap rounded-full ' +
            'bg-surface-2 px-3 text-xs font-medium text-ink-muted hover:text-ink',
        },
      }}
    />
  );
}

/** The only sanctioned toast trigger — `toast.success / error / info / warning`. */
export { toast } from 'sonner';
