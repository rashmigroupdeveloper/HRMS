/**
 * Group company scope — the masthead company switcher (docs/08 §3: hr_head,
 * super_admin and the CEO cell work across all 14 entities).
 *
 * Presentation-only: it reuses the remembered company that Muster, Month-lock,
 * Team, Assets and the supporting reports already read
 * (`hrms.reportCompanyId`, report-utils). `null` = consolidated (all
 * companies). Changing scope notifies subscribers; the shell remounts the
 * current page so every screen re-reads its default company.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'hrms.reportCompanyId';
const EVENT = 'hrms:company-scope';

function read(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function setCompanyScope(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(id));
  } catch {
    /* storage unavailable (private mode) — scope stays in-memory default */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Current company scope (`null` = all companies / consolidated). */
export function useCompanyScope(): number | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
