/**
 * Persistence + export helpers for DataTable (docs/05 §5 "workhorse grid").
 * Everything is per-browser localStorage keyed by a stable `tableId`; nothing
 * leaves the device and nothing is sent to the API.
 */

export interface TableView {
  name: string;
  search: string;
  sort: { key: string; dir: 'asc' | 'desc' } | null;
  hidden: string[];
}

const KEY = (tableId: string, part: string): string => `hrms.table.${tableId}.${part}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota — the table still works, it just forgets.
  }
}

export const loadHidden = (tableId: string): string[] => read<string[]>(KEY(tableId, 'hidden'), []);
export const saveHidden = (tableId: string, hidden: string[]): void => {
  write(KEY(tableId, 'hidden'), hidden);
};
export const loadViews = (tableId: string): TableView[] =>
  read<TableView[]>(KEY(tableId, 'views'), []);
export const saveViews = (tableId: string, views: TableView[]): void => {
  write(KEY(tableId, 'views'), views);
};

/** RFC 4180 CSV with a UTF-8 BOM so Excel on Windows keeps ₹ and Indic names intact. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null): string => {
    const raw = v === null ? '' : String(v);
    // CSV/formula-injection guard: text a spreadsheet would execute gets a leading apostrophe.
    const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(raw) && !/^[+-]?[\d\s().]+$/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${[header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}`;
}

export function downloadCsv(fileName: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
