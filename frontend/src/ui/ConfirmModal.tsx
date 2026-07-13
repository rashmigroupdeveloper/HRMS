import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { Button } from './Button';

/**
 * ConfirmModal — the ONLY sanctioned modal use: confirmation (docs/05 §7b,
 * §8 — "modals only confirm"). Centered (the modal exception to
 * scale-from-trigger, docs/05 §2.3), enters from scale(0.95)+opacity.
 *
 * `typedConfirmation` gates destructive/irreversible actions (payroll finalize,
 * month lock, exit conversion — docs/05 §4.5, §8): the confirm button stays
 * disabled until the user types the exact phrase.
 */

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** if set, the user must type this exact string to enable confirm */
  typedConfirmation?: string;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  typedConfirmation,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) {
      setTyped('');
      setMounted(true);
      const id = requestAnimationFrame(() => {
        setEntered(true);
      });
      return () => {
        cancelAnimationFrame(id);
      };
    }
    setEntered(false);
    const t = setTimeout(() => {
      setMounted(false);
    }, 200);
    return () => {
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const confirmDisabled = typedConfirmation !== undefined && typed !== typedConfirmation;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]',
          'transition-opacity duration-[var(--motion-short)]',
          entered ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cn(
          'relative w-full max-w-md rounded-card bg-surface p-6 u-shadow-float',
          'transition-[transform,opacity] duration-[var(--motion-short)] ease-[var(--ease-out-strong)]',
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
      >
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-ink">
          {title}
        </h2>
        {description && <div className="mt-2 text-sm text-ink-muted">{description}</div>}

        {typedConfirmation !== undefined && (
          <div className="mt-4">
            <label
              htmlFor="confirm-phrase"
              className="mb-1.5 block text-xs font-medium text-ink-muted"
            >
              Type <span className="font-semibold text-ink">{typedConfirmation}</span> to confirm
            </label>
            <input
              id="confirm-phrase"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
              }}
              autoComplete="off"
              autoFocus
              className={cn(
                'w-full rounded-row bg-surface-2 px-3 py-2 text-sm text-ink outline-none',
                'ring-1 ring-inset ring-[var(--line-strong)] focus:ring-2 focus:ring-accent',
              )}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
