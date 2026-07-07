import { useCallback, useEffect, useState } from 'react';

/**
 * Theme management (docs/05 §1 rule 7 — dark mode is first-class).
 *
 * The `.dark` class on <html> flips every semantic token. Resolution order:
 *   1. explicit user choice persisted in localStorage
 *   2. otherwise the OS `prefers-color-scheme`
 * A `system` mode tracks the OS live until the user makes an explicit choice.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hrms-theme';

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function applyResolved(mode: ThemeMode): void {
  const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);

  // Reflect the resolved mode onto <html> whenever the choice changes.
  useEffect(() => {
    applyResolved(mode);
    if (mode === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // While in `system` mode, follow the OS if it changes live.
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyResolved('system');
    };
    mql.addEventListener('change', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, [mode]);

  const isDark =
    mode === 'dark' || (mode === 'system' && systemPrefersDark());

  const toggle = useCallback(() => {
    setMode((prev) => {
      const currentlyDark =
        prev === 'dark' || (prev === 'system' && systemPrefersDark());
      return currentlyDark ? 'light' : 'dark';
    });
  }, []);

  return { mode, isDark, setMode, toggle };
}
