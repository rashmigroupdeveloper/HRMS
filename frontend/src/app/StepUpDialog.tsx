/**
 * SEC-04 — the step-up challenge.
 *
 * Three deliberate choices, each from docs/05 §6 (the micro-frustration
 * kill-list) rather than from security folklore:
 *
 *  1. It is a MODAL, not a page. The user keeps the screen, the filters and the
 *     half-typed form they were working in. Navigating away to re-authenticate
 *     and losing that is the exact frustration the kill-list bans.
 *  2. It SAYS WHY. "Confirm it's you to view unmasked PAN for 3 employees" —
 *     friction the user understands is friction they accept. A bare password
 *     box reads as a bug.
 *  3. It RETRIES the original action itself. The caller passes what it was
 *     doing; on success the dialog runs it. The user does not have to remember
 *     and repeat the click that was interrupted.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Button, TextField } from '../ui';

export interface StepUpRequest {
  /** Shown in the dialog: what the elevation is FOR, in the user's words. */
  reason: string;
  /** Re-run after a successful step-up. */
  retry: () => void | Promise<void>;
}

interface StepUpDialogProps {
  request: StepUpRequest | null;
  onClose: () => void;
  onElevated: (steppedUpUntil: string) => void;
  /** Whether this account has a second factor, so we ask for the code too. */
  mfaEnrolled: boolean;
}

export function StepUpDialog({ request, onClose, onElevated, mfaEnrolled }: StepUpDialogProps) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const open = request !== null;

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setPassword('');
    setCode('');
    setError(null);
    const frame = requestAnimationFrame(() => {
      setEntered(true);
      passwordRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ steppedUpUntil: string }>('/api/security/step-up', {
        method: 'POST',
        body: JSON.stringify(mfaEnrolled ? { password, code } : { password }),
      });
      onElevated(result.steppedUpUntil);
      // The whole point: finish what the user started.
      await request.retry();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not confirm it is you');
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-title"
    >
      <div
        className={[
          'absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] backdrop-blur-[2px] transition-opacity duration-200',
          entered ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />
      <div
        className={[
          'relative w-full max-w-md rounded-2xl border border-line bg-surface-1 p-6 shadow-[0_24px_60px_-24px_color-mix(in_srgb,var(--ink)_45%,transparent)]',
          'transition-[opacity,transform] duration-200 ease-out',
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="step-up-title" className="text-lg font-medium text-ink">
              Confirm it&rsquo;s you
            </h2>
            {/* Rule 2: the friction explains itself. */}
            <p className="mt-1 text-sm text-ink-muted">{request.reason}</p>
          </div>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextField
            ref={passwordRef}
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
          />
          {mfaEnrolled ? (
            <TextField
              label="Code from your authenticator app"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              required
            />
          ) : null}

          {error === null ? null : (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || password === ''}>
              {busy ? 'Confirming…' : 'Confirm'}
            </Button>
          </div>
        </form>

        <p className="mt-4 flex items-start gap-2 text-xs text-ink-muted">
          <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          This keeps you confirmed for a few minutes, then asks again.
        </p>
      </div>
    </div>,
    document.body,
  );
}
