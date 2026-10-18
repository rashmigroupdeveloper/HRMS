/**
 * Kent time parsing (KENT_RESEARCH §5.5). Kent documents its webhook `time` only as a
 * "timestamp", and the greytHR/Astra export uses "16 Jun 2025 15:03:40". Accepted:
 *  - numbers / digit strings: epoch SECONDS when < 1e12, otherwise epoch MILLISECONDS;
 *  - ISO 8601 (with or without zone; "T" or space);
 *  - "DD MMM YYYY HH:mm[:ss]" and "DD-MM-YYYY HH:mm[:ss]" / "DD/MM/YYYY ...";
 * Zone-less values get `defaultOffset` (IST "+05:30" unless Kent confirms otherwise).
 */
export class KentTimeError extends Error {}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
const pad = (n: string) => n.padStart(2, '0');

export function parseKentTime(v: unknown, defaultOffset = '+05:30'): Date {
  if (v instanceof Date) { if (Number.isNaN(v.getTime())) throw new KentTimeError('Invalid date'); return v; }
  if (typeof v === 'number' || (typeof v === 'string' && /^\d{9,14}(\.\d+)?$/.test(v.trim()))) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new KentTimeError(`Unreadable Kent time: ${String(v)}`);
    return new Date(n < 1e12 ? Math.round(n * 1000) : Math.round(n));
  }
  if (typeof v !== 'string' || !v.trim()) throw new KentTimeError(`Unreadable Kent time: ${String(v)}`);
  let s = v.trim();
  let m = /^(\d{1,2})[ -]([A-Za-z]{3})[A-Za-z]*[ ,-]+(\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  const mon = m?.[2] ? MONTHS[m[2].toLowerCase()] : undefined;
  if (m && mon) s = `${m[3] ?? ''}-${mon}-${pad(m[1] ?? '')}T${pad(m[4] ?? '')}:${m[5] ?? ''}:${m[6] ?? '00'}`;
  else if ((m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s))) s = `${m[3] ?? ''}-${pad(m[2] ?? '')}-${pad(m[1] ?? '')}T${pad(m[4] ?? '')}:${m[5] ?? ''}:${m[6] ?? '00'}`;
  else s = s.replace(' ', 'T');
  const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}${defaultOffset}`;
  const d = new Date(withZone);
  if (Number.isNaN(d.getTime())) throw new KentTimeError(`Unreadable Kent time: ${v}`);
  return d;
}
