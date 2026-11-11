import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Camera, MessageSquare, Upload } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { Button, Drawer, Textarea, toast } from '../../ui';
import { captureScreenshot, readScreenshot, type Screenshot } from './screenshot';
interface Reporter {
  name: string;
  ecode: string | null;
  roles: string[];
  maxScreenshotBytes: number;
}
export function BetaFeedback({ user }: { user: SessionUser }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [reporter, setReporter] = useState<Reporter | null>(null);
  const [page, setPage] = useState<{ path: string; title: string } | null>(null);
  const [body, setBody] = useState('');
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [contextError, setContextError] = useState('');
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);
  const file = useRef<HTMLInputElement>(null);
  const canSubmit = user.permissions.includes('beta.feedback.submit');
  const canReview = user.permissions.includes('beta.feedback.review');
  useEffect(() => {
    if (!open || reporter || !canSubmit) return;
    let cancelled = false;
    void apiFetch<Reporter>('/api/beta-feedback/context')
      .then((value) => {
        if (!cancelled) {
          setReporter(value);
          setContextError('');
        }
      })
      .catch(() => {
        if (!cancelled)
          setContextError('Could not load your report details. Close and reopen to retry.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, reporter, canSubmit]);
  if (!canSubmit) return null;
  const show = () => {
    if (!page) setPage({ path: location.pathname, title: document.title });
    setOpen(true);
  };
  const attach = async (image: Promise<Screenshot>) => {
    setError('');
    try {
      const value = await image;
      if (!reporter || value.base64.length * 0.75 > reporter.maxScreenshotBytes)
        throw new Error('Screenshot is too large. Upload a smaller image.');
      setScreenshot(value);
      requestId.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Screenshot could not be attached.');
    }
  };
  const capture = async () => {
    setCapturing(true);
    try {
      await attach(captureScreenshot());
    } finally {
      setCapturing(false);
    }
  };
  const submit = async () => {
    if (sending.current) return;
    if (!body.trim()) {
      setError('Describe what happened or what you would improve.');
      return;
    }
    if (!page || !reporter) return;
    sending.current = true;
    setBusy(true);
    setError('');
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await apiFetch<{ id: number }>('/api/beta-feedback', {
        method: 'POST',
        body: JSON.stringify({
          requestId: requestId.current,
          pagePath: page.path,
          pageTitle: page.title.slice(0, 250),
          body: body.trim(),
          ...(screenshot ? { screenshot } : {}),
        }),
      });
      toast.success(`Feedback #${String(result.id)} received. Thank you.`);
      setBody('');
      setScreenshot(null);
      setPage(null);
      requestId.current = null;
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not send feedback. Your draft is still here.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {!open && !capturing && (
        <Button
          onClick={show}
          aria-expanded={false}
          aria-label="Open beta feedback"
          leadingIcon={<MessageSquare className="size-4" aria-hidden />}
          className="fixed right-0 top-1/2 z-30 rounded-r-none bg-hero text-hero-ink shadow-sm [writing-mode:vertical-rl] h-auto py-4 px-2.5"
        >
          Beta feedback
        </Button>
      )}
      <Drawer
        open={open && !capturing}
        onClose={() => {
          if (!busy && !capturing) setOpen(false);
        }}
        title="Beta feedback"
        subtitle="Help us improve Rashmi One."
        width={460}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setOpen(false);
              }}
              disabled={busy}
            >
              Close
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!reporter}
              onClick={() => void submit()}
            >
              Send feedback
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {contextError && (
            <p role="alert" className="text-sm text-negative-ink">
              {contextError}
            </p>
          )}
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-ink-muted">Reporting page</dt>
              <dd className="break-all font-medium">{page?.path}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Submitted as</dt>
              <dd>
                {reporter
                  ? `${reporter.name}${reporter.ecode ? ` · ${reporter.ecode}` : ''}`
                  : 'Loading your details…'}
              </dd>
              <dd className="text-ink-muted">{reporter?.roles.join(', ').replaceAll('_', ' ')}</dd>
            </div>
          </dl>
          {page && page.path !== location.pathname && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setPage({ path: location.pathname, title: document.title });
                setScreenshot(null);
                requestId.current = null;
              }}
            >
              Report the current page instead
            </Button>
          )}
          <Textarea
            label="Your feedback"
            required
            value={body}
            maxLength={5000}
            showCount
            rows={6}
            disabled={busy}
            placeholder="What happened? What did you expect?"
            onChange={(event) => {
              setBody(event.target.value);
              requestId.current = null;
            }}
          />
          <section aria-label="Screenshot" className="space-y-3">
            <p className="text-sm font-medium">
              Screenshot <span className="font-normal text-ink-muted">(optional)</span>
            </p>
            <p className="text-xs text-ink-muted">
              Choose this browser tab when prompted. Review the image before sending; remove it if
              it includes details you do not want to share.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!reporter || busy}
                leadingIcon={<Camera className="size-4" aria-hidden />}
                onClick={() => void capture()}
              >
                Capture this page
              </Button>
              <Button
                size="sm"
                disabled={!reporter || busy}
                leadingIcon={<Upload className="size-4" aria-hidden />}
                onClick={() => file.current?.click()}
              >
                Upload screenshot
              </Button>
            </div>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg"
              aria-label="Upload screenshot file"
              className="sr-only"
              disabled={!reporter || busy}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected && reporter)
                  void attach(readScreenshot(selected, reporter.maxScreenshotBytes));
                event.target.value = '';
              }}
            />
            {screenshot && (
              <div className="space-y-2">
                <img
                  src={`data:${screenshot.mime};base64,${screenshot.base64}`}
                  alt="Screenshot attached to your feedback"
                  className="max-h-64 w-full rounded-row object-contain bg-surface-2"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setScreenshot(null);
                    requestId.current = null;
                  }}
                >
                  Remove screenshot
                </Button>
              </div>
            )}
          </section>
          {error && (
            <p role="alert" className="text-sm text-negative-ink">
              {error}
            </p>
          )}
          <p className="text-xs text-ink-muted">
            Your page, name and role are included automatically. Feedback goes to the development
            team’s private inbox and email.
          </p>
          {canReview && (
            <Link
              to="/admin/beta-feedback"
              className="text-sm underline underline-offset-4"
              onClick={() => {
                setOpen(false);
              }}
            >
              Open feedback inbox
            </Link>
          )}
        </div>
      </Drawer>
    </>
  );
}
