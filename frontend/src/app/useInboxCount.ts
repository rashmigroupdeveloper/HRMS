/**
 * Live count of items waiting on the signed-in user's approval — the masthead
 * approvals badge (docs/05 §3: "approvals inbox one click from anywhere, badge
 * count"). Polls quietly; failures are silent (a badge must never error).
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export function useInboxCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poll = (): void => {
      apiFetch<unknown[]>('/api/workflows/inbox')
        .then((rows) => {
          if (!cancelled && Array.isArray(rows)) setCount(rows.length);
        })
        .catch(() => {
          /* a badge never surfaces an error */
        });
    };
    poll();
    const timer = window.setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return count;
}
