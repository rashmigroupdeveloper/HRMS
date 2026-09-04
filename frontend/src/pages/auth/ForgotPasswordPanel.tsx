/**
 * ESS-01 — inline forgot-password panel on LoginPage (same page, not a route).
 * Always-ok response from the server; we never tell the visitor whether the
 * identifier existed.
 */
import { useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { IdCard } from 'lucide-react';
import { Button, StatusBadge, TextField } from '../../ui';

interface ForgotPasswordPanelProps {
  initialIdentifier: string;
  validateIdentifier: (value: string) => string | undefined;
  onBack: () => void;
}

export function ForgotPasswordPanel({
  initialIdentifier,
  validateIdentifier,
  onBack,
}: ForgotPasswordPanelProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setFormError(null);
    const nextError = validateIdentifier(identifier);
    if (nextError) {
      setFieldError(nextError);
      idRef.current?.focus();
      return;
    }
    setFieldError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (!res.ok) {
        setFormError('We could not send a reset just now. Try again in a moment.');
        return;
      }
      setSent(true);
    } catch {
      setFormError('Can’t reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 space-y-3" role="status">
        <StatusBadge tone="positive">If that account exists we sent a reset.</StatusBadge>
        <p className="text-sm text-ink-muted">
          Check your work email for a one-time link. It expires shortly and works only once.
        </p>
        <button
          type="button"
          className="rounded text-sm font-medium text-ink underline-offset-4 hover:underline"
          onClick={onBack}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form
      aria-label="Forgot password"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      noValidate
      className="mt-8 space-y-4"
    >
      <p className="text-sm text-ink-muted">
        Enter your employee ID or email. We will send a reset link if the account is active.
      </p>
      {formError && (
        <div role="alert">
          <StatusBadge tone="negative">{formError}</StatusBadge>
        </div>
      )}
      <TextField
        ref={idRef}
        label="Employee ID or email"
        type="text"
        name="forgotIdentifier"
        autoComplete="username"
        spellCheck={false}
        placeholder="e.g. RML035384"
        leadingIcon={<IdCard />}
        value={identifier}
        onChange={(e) => {
          const v = e.target.value;
          setIdentifier(v.includes('@') ? v : v.toUpperCase());
        }}
        error={fieldError}
        required
        autoFocus
      />
      <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
        {submitting ? 'Sending…' : 'Send reset link'}
      </Button>
      <button
        type="button"
        className="rounded text-sm font-medium text-ink underline-offset-4 hover:underline"
        onClick={onBack}
      >
        Back to sign in
      </button>
    </form>
  );
}
