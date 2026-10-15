/**
 * Live count of items waiting on the signed-in user's approval — the masthead
 * approvals badge (docs/05 §3: "approvals inbox one click from anywhere, badge
 * count"). Polls quietly; failures are silent (a badge must never error).
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { WORKFLOW_CHANGED_EVENT } from '../lib/workflow-events';

export function useInboxCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let latestPoll = 0;
    const poll = (): void => {
      const pollId = ++latestPoll;
      apiFetch<unknown[]>('/api/workflows/inbox')
        .then((rows) => {
          if (!cancelled && pollId === latestPoll && Array.isArray(rows)) setCount(rows.length);
        })
        .catch(() => {
          /* a badge never surfaces an error */
        });
    };
    poll();
    const timer = window.setInterval(poll, 60_000);
    window.addEventListener(WORKFLOW_CHANGED_EVENT, poll);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(WORKFLOW_CHANGED_EVENT, poll);
    };
  }, [enabled]);

  return count;
}
