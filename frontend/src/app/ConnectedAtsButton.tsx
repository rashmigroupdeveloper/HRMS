/** Only explicitly linked accounts get the app switch; no inferred identity matching. */
import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { apiFetch } from '../lib/api';
export function ConnectedAtsButton({ userId }: { userId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ configured: boolean; linked: boolean; startUrl: string | null }>(
      '/api/sso/status',
    )
      .then((result) => {
        if (!cancelled) setUrl(result.configured && result.linked ? result.startUrl : null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return url ? (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        window.location.assign(url);
      }}
    >
      ATS
    </Button>
  ) : null;
}
