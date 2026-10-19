/** D4/NFR-03: canonical sign-in is retained; only a one-use authorization code leaves HRMS. */
import { useState } from 'react';
import { Button, Card } from '../../ui';
import { apiFetch } from '../../lib/api';
export function SsoAuthorizePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const query = new URLSearchParams(window.location.search);
      const result = await apiFetch<{ redirectUrl: string }>('/api/sso/authorize', {
        method: 'POST',
        body: JSON.stringify({
          clientId: query.get('clientId'),
          redirectUri: query.get('redirectUri'),
          challenge: query.get('challenge'),
          state: query.get('state'),
        }),
      });
      window.location.assign(result.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Connected sign-in could not be completed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <Card className="w-full max-w-lg p-7">
        <h1 className="text-2xl font-semibold text-balance">Continue to ATS</h1>
        <p className="mt-3 text-sm text-ink-muted text-pretty">
          Use your verified connected account. ATS keeps its own permissions; HRMS salary and
          payroll access will not be added.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-negative-ink">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <Button
            disabled={busy}
            onClick={() => {
              void connect();
            }}
          >
            {busy ? 'Connecting…' : 'Continue to ATS'}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              window.location.assign('/');
            }}
          >
            Return to HRMS
          </Button>
        </div>
      </Card>
    </main>
  );
}
