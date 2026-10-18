/** LC-01: never reuse another company's master choices while a request is changing. */
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { ReferenceCatalog } from './onboarding-types';
interface Snapshot {
  path: string;
  data: ReferenceCatalog | null;
  error: string | null;
  loading: boolean;
}
export function useOnboardingReferences(companyId: string) {
  const path =
    '/api/lifecycle/onboarding-reference-data' + (companyId ? `?companyId=${companyId}` : '');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSnapshot({ path, data: null, error: null, loading: true });
    void apiFetch<ReferenceCatalog>(path)
      .then((data) => {
        if (!cancelled) setSnapshot({ path, data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setSnapshot({
            path,
            data: null,
            error: error instanceof Error ? error.message : 'Master choices could not be loaded',
            loading: false,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return snapshot?.path === path ? snapshot : { data: null, error: null, loading: true };
}
