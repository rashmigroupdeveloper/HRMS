/**
 * CMP-16 — the shared expiry state machine.
 *
 * One implementation, reused by every surface that renders a validity: licences
 * and registrations here, and in later stages documents, gate passes, medical
 * fitness certificates and training certifications. "Expiring" has to mean the
 * same thing in all of them or the colour language stops being trustworthy.
 *
 * Pure and clock-free by design: `today` is passed in so the boundary cases can
 * be tested exactly, and no caller can accidentally compare a date against a
 * timestamp with a time component.
 */

export type ExpiryState = 'perpetual' | 'valid' | 'expiring' | 'expired';

export interface ExpiryView {
  state: ExpiryState;
  /** Whole days from today to the expiry; negative once past. NULL if perpetual. */
  daysRemaining: number | null;
  /** The tightest alert stage crossed (7 is more urgent than 90). NULL if none. */
  stage: number | null;
}

const DEFAULT_STAGES = [90, 30, 15, 7] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The alert ladder is a settings string ('90,30,15,7'). Bad input degrades to
 * the default rather than throwing: a malformed setting must not be able to
 * take down the compliance board, which is exactly the screen you need working
 * on the day someone has fat-fingered a config value.
 */
export function parseAlertStages(raw: string): number[] {
  const parsed = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  const unique = [...new Set(parsed)].sort((a, b) => b - a);
  return unique.length > 0 ? unique : [...DEFAULT_STAGES];
}

/**
 * Midnight of the calendar day a Date falls on, in the SERVER's zone.
 *
 * Local getters, not UTC ones, and that distinction is load-bearing: node-postgres
 * materialises a `DATE` column as local midnight, so in IST (UTC+5:30) a licence
 * valid to 2026-09-23 arrives as 2026-09-22T18:30:00Z. Reading it with
 * `getUTCDate()` would report the 22nd and make every expiry a day early —
 * which, on the day a plant's licence actually lapses, is a day of production
 * blocked for nothing. The platform is IST throughout (docs/01 NFR-09).
 */
function atStartOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function expiryState(
  validTo: Date | null,
  today: Date,
  stages: readonly number[],
): ExpiryView {
  if (validTo === null) return { state: 'perpetual', daysRemaining: null, stage: null };

  const daysRemaining = Math.round((atStartOfDay(validTo) - atStartOfDay(today)) / MS_PER_DAY);

  // A licence valid THROUGH its last day is still usable on that day; it is
  // expired only once the day has passed. Getting this wrong would block a
  // plant on the morning of a renewal that is not actually late yet.
  if (daysRemaining < 0) return { state: 'expired', daysRemaining, stage: null };

  const ladder = [...stages].sort((a, b) => a - b); // tightest first
  const stage = ladder.find((threshold) => daysRemaining <= threshold);

  return stage === undefined
    ? { state: 'valid', daysRemaining, stage: null }
    : { state: 'expiring', daysRemaining, stage };
}

/** Sort key for a posture list: most urgent first, perpetual last. */
export function expiryUrgency(view: ExpiryView): number {
  if (view.state === 'expired') return -1;
  if (view.state === 'perpetual') return Number.MAX_SAFE_INTEGER;
  return view.daysRemaining ?? Number.MAX_SAFE_INTEGER;
}
