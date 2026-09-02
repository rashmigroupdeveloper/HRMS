/**
 * Like `useDashboardResource`, but it distinguishes "this backend does not
 * exist yet" (404/501 from an unbuilt phase) from "something went wrong".
 *
 * Without the distinction every unbuilt screen would show a red error, which
 * trains people to ignore errors — the opposite of what a compliance system
 * needs. `pending` means the endpoint isn't there yet; `error` means it is and
 * it failed, which is worth shouting about.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

interface ModuleResource<T> {
  data: T | null;
  /** The backend for this surface has not shipped yet. */
  pending: boolean;
  /** A real failure against an endpoint that DOES exist. */
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Statuses that mean "not built yet" rather than "broken". */
const NOT_BUILT = new Set([404, 501]);

export function useModuleResource<T>(path: string): ModuleResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(0);

  const reload = useCallback(() => {
    setRequest((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPending(false);

    void apiFetch<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && NOT_BUILT.has(cause.status)) {
          setPending(true);
          return;
        }
        setError(cause instanceof ApiError ? cause.message : 'This surface could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, request]);

  return { data, pending, error, loading, reload };
}
