import { useSyncExternalStore } from 'react';

/** Subscribe to a media query; `false` where matchMedia is unavailable (SSR/tests). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => {
        mql.removeEventListener('change', notify);
      };
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}
