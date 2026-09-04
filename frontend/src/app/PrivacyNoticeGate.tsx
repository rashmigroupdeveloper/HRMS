/**
 * First-login / version-change privacy notice (PRV-01).
 *
 * Blocking interstitial — not a footer link. Composed from Card + Button
 * (docs/05 §7b: modals only confirm; this is a mandatory acknowledgement, so
 * Escape and a cancel path are deliberately absent). If notice-status 404s
 * (backend not yet registered), the gate is a no-op.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, apiFetch } from '../lib/api';
import { Button, Card } from '../ui';

interface NoticePayload {
  id: number;
  version: number;
  title: string;
  body: string;
  principalClass?: string;
  effectiveFrom?: string;
}

interface NoticeStatus {
  required: boolean;
  notice?: NoticePayload | null;
}

interface PrivacyNoticeGateProps {
  /** Re-run after acknowledgement so /auth/me or shell state can refresh. */
  onAcknowledged?: () => void;
}

export function PrivacyNoticeGate({ onAcknowledged }: PrivacyNoticeGateProps) {
  const [notice, setNotice] = useState<NoticePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<NoticeStatus>('/api/privacy/notice-status')
      .then((status) => {
        if (cancelled) return;
        if (status.required && status.notice !== null && status.notice !== undefined) {
          setNotice(status.notice);
        }
      })
      .catch((caught: unknown) => {
        // Backend not wired yet, or the caller is not in scope — never block the app.
        if (caught instanceof ApiError && caught.status === 404) return;
        // Other failures: still skip silently so a flaky privacy service cannot
        // lock every signed-in person out of the product.
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledge = useCallback(async (): Promise<void> => {
    if (notice === null) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/privacy/notice/ack', {
        method: 'POST',
        body: JSON.stringify({ noticeId: notice.id }),
      });
      setNotice(null);
      onAcknowledged?.();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not record your acknowledgement',
      );
    } finally {
      setBusy(false);
    }
  }, [notice, onAcknowledged]);

  if (!checked || notice === null) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-notice-title"
    >
      <div
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]"
        aria-hidden="true"
      />
      <Card className="relative z-10 max-h-[min(90vh,40rem)] w-full max-w-lg overflow-hidden u-shadow-float">
        <div className="border-b border-line/60 px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Privacy notice · v{String(notice.version)}
          </p>
          <h2 id="privacy-notice-title" className="mt-1 text-lg font-semibold text-ink">
            {notice.title}
          </h2>
        </div>
        <div className="max-h-[min(50vh,24rem)] overflow-y-auto px-6 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{notice.body}</p>
        </div>
        <div className="flex flex-col gap-3 border-t border-line/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {error === null ? (
            <p className="text-xs text-ink-muted">
              You need to acknowledge this notice before continuing.
            </p>
          ) : (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <Button
            disabled={busy}
            onClick={() => {
              void acknowledge();
            }}
          >
            {busy ? 'Saving…' : 'I acknowledge'}
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  );
}
