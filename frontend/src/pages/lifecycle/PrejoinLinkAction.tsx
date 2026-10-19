/** LC-01: visible request state and local failure when HR rotates an unsubmitted link. */
import { useState } from 'react';
import { Button } from '../../ui';
import type { CandidateItem } from './onboarding-types';
export function PrejoinLinkAction({
  candidate,
  issue,
}: {
  candidate: CandidateItem;
  issue: (candidate: CandidateItem) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      await issue(candidate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the prejoin link');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => {
          void run();
        }}
      >
        {busy ? 'Creating link…' : 'Create prejoin link'}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-negative-ink">
          {error}
        </p>
      )}
    </div>
  );
}
