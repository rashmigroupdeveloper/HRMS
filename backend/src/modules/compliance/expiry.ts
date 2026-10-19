/**
 * CMP-16 — the shared expiry state machine.
 *
 * One pure, clock-free implementation for validity and alert ladders across
 * licences, registrations, and statutory documents.
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
 * the default rather than throwing.
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
 * Midnight of the calendar day a Date falls on, in the server's local zone.
 * Node-postgres materializes a `DATE` column as local midnight.
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

  // A licence valid through its last day is still usable on that day; it is
  // expired only once the day has passed.
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
