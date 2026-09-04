/**
 * ESS-01 — public password-reset page. Lives outside AppShell so a logged-out
 * (or never-logged-in) visitor can follow the email link at /reset-password?token=.
 * Composed from `frontend/src/ui` only (docs/05 §0.1 firewall).
 */
import { useRef, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, StatusBadge, TextField, ThemeToggle } from '../../ui';

function enterDelay(ms: number): CSSProperties {
  return { '--enter-delay': `${String(ms)}ms` } as CSSProperties;
}

function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter a new password.';
  if (value.length < 10) return 'Use at least 10 characters.';
  return undefined;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setFormError(null);

    if (!token) {
      setFormError('This reset link is missing its token. Request a new one from sign-in.');
      return;
    }

    const nextPasswordError = validatePassword(password);
    const nextConfirmError =
      confirm !== password ? 'Passwords do not match.' : validatePassword(confirm);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);

    if (nextPasswordError) {
      passwordRef.current?.focus();
      return;
    }
    if (nextConfirmError) {
      confirmRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setFormError(body?.message ?? 'We could not reset that password. Request a new link.');
        return;
      }
      setDone(true);
    } catch {
      setFormError('Can’t reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="u-grain relative hidden flex-col justify-between overflow-hidden bg-hero px-12 py-14 text-hero-ink lg:flex">
        <div className="u-enter flex items-center gap-2.5" style={enterDelay(0)}>
          <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
            R
          </span>
          <span className="text-sm font-semibold">Rashmi HRMS</span>
        </div>

        <div className="u-enter max-w-lg" style={enterDelay(50)}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--hero-ink)_78%,var(--hero-muted))]">
            Account recovery
          </p>
          <h1 className="mt-5 text-5xl font-light leading-[1.12] tracking-tight">
            Choose a new password
            <span className="relative mt-2 inline-block pb-1">
              you have not used before.
              <span className="u-gold-sweep absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-accent" aria-hidden />
            </span>
          </h1>
        </div>

        <div
          className="u-enter flex items-center gap-2 text-xs text-[color-mix(in_srgb,var(--hero-ink)_72%,var(--hero-muted))]"
          style={enterDelay(110)}
        >
          <ShieldCheck className="size-4" aria-hidden />
          This link works once and expires shortly.
        </div>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>

        <div
          className="u-enter u-shadow-float w-full max-w-md rounded-card bg-surface p-8 sm:p-10"
          style={enterDelay(40)}
        >
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
              R
            </span>
            <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Password reset
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Set a new password
          </h2>

          {done ? (
            <div className="mt-8 space-y-4" role="status">
              <StatusBadge tone="positive">Your password has been updated.</StatusBadge>
              <p className="text-sm text-ink-muted">
                Sign in with your new password. Any other open sessions were signed out.
              </p>
              <Link
                to="/"
                className="inline-flex rounded text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form
              aria-label="Reset password"
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              noValidate
              className="mt-8 space-y-4"
            >
              {formError && (
                <div role="alert">
                  <StatusBadge tone="negative">{formError}</StatusBadge>
                </div>
              )}

              <TextField
                ref={passwordRef}
                label="New password"
                type="password"
                name="newPassword"
                autoComplete="new-password"
                leadingIcon={<Lock />}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                error={passwordError}
                required
                autoFocus
              />

              <TextField
                ref={confirmRef}
                label="Confirm password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                leadingIcon={<Lock />}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                }}
                error={confirmError}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                className="w-full"
              >
                {submitting ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          )}

          {!done && (
            <p className="mt-8 text-xs leading-relaxed text-ink-muted">
              Link expired?{' '}
              <Link to="/" className="font-medium text-ink underline-offset-4 hover:underline">
                Request a new one from sign-in
              </Link>
              .
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
