/**
 * CMP-16 — the expiry state machine, as a pure function.
 *
 * This is the one piece of Stage 5.7 that every other surface depends on: the
 * posture board, the alert ladder and the calendar all colour themselves from
 * it. It is also where off-by-one errors hide, so it is tested without a
 * database and without a clock.
 *
 * The colour language it produces is shared deliberately — documents, gate
 * passes, medical fitness and certifications reuse it in later stages, so
 * "expiring" must mean exactly the same thing everywhere.
 */
import { describe, expect, it } from 'vitest';
import { expiryState, parseAlertStages } from '../src/modules/compliance/expiry.js';
import { deriveStatus } from '../src/modules/compliance/calendar.service.js';

const STAGES = [90, 30, 15, 7];
// Local-midnight dates, matching how node-postgres materialises a DATE column.
// Constructing them with the numeric ctor keeps the test independent of the
// runner's timezone, which a `...Z` literal would not be.
const on = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const today = on('2026-09-03');

describe('parseAlertStages', () => {
  it('reads the settings string into a descending ladder', () => {
    expect(parseAlertStages('90,30,15,7')).toEqual([90, 30, 15, 7]);
  });

  it('sorts, de-duplicates and ignores rubbish rather than throwing', () => {
    expect(parseAlertStages('7, 30,90 ,30, ,x,-5')).toEqual([90, 30, 7]);
  });

  it('falls back to a sane ladder when the setting is empty', () => {
    expect(parseAlertStages('')).toEqual([90, 30, 15, 7]);
  });
});

describe('expiryState', () => {
  it('treats a NULL valid_to as perpetual — a PF code never expires', () => {
    expect(expiryState(null, today, STAGES)).toEqual({
      state: 'perpetual',
      daysRemaining: null,
      stage: null,
    });
  });

  it('is valid when the expiry is beyond the widest alert stage', () => {
    const result = expiryState(on('2026-12-31'), today, STAGES);
    expect(result.state).toBe('valid');
    expect(result.daysRemaining).toBe(119);
    expect(result.stage).toBeNull();
  });

  it('reports the TIGHTEST stage crossed, not the widest', () => {
    expect(expiryState(on('2026-11-15'), today, STAGES).stage).toBe(90); // 73 days
    expect(expiryState(on('2026-09-25'), today, STAGES).stage).toBe(30); // 22 days
    expect(expiryState(on('2026-09-15'), today, STAGES).stage).toBe(15); // 12 days
    expect(expiryState(on('2026-09-08'), today, STAGES).stage).toBe(7); //   5 days
  });

  it('crosses into expiring exactly ON the stage boundary, not a day late', () => {
    // 90 days out is the first day the T-90 alert should fire.
    const boundary = expiryState(on('2026-12-02'), today, STAGES);
    expect(boundary.daysRemaining).toBe(90);
    expect(boundary.state).toBe('expiring');
    expect(boundary.stage).toBe(90);

    const dayBefore = expiryState(on('2026-12-03'), today, STAGES);
    expect(dayBefore.daysRemaining).toBe(91);
    expect(dayBefore.state).toBe('valid');
  });

  it('is still valid on its LAST day — a licence expiring today is usable today', () => {
    const result = expiryState(on('2026-09-03'), today, STAGES);
    expect(result.daysRemaining).toBe(0);
    expect(result.state).toBe('expiring');
    expect(result.stage).toBe(7);
  });

  it('is expired only once the day has actually passed', () => {
    const result = expiryState(on('2026-09-02'), today, STAGES);
    expect(result.state).toBe('expired');
    expect(result.daysRemaining).toBe(-1);
  });

  it('ignores the time of day on both sides — dates, not instants', () => {
    const lateInDay = new Date(2026, 8, 3, 23, 59);
    expect(expiryState(on('2026-09-03'), lateInDay, STAGES).state).toBe('expiring');
    expect(expiryState(on('2026-09-02'), lateInDay, STAGES).state).toBe('expired');
  });

  it('degrades safely when no stages are configured', () => {
    const result = expiryState(on('2026-09-08'), today, []);
    expect(result.state).toBe('valid');
    expect(result.stage).toBeNull();
  });
});

/**
 * CMP-17 — `overdue` is DERIVED, never stored. That is the whole reason no
 * nightly job has to stay alive for the compliance board to tell the truth, so
 * the derivation itself is pinned here rather than only exercised end-to-end.
 */
describe('deriveStatus', () => {
  const today = on('2026-09-03');

  it('is due while the date has not passed', () => {
    expect(deriveStatus('due', on('2026-09-04'), today)).toBe('due');
  });

  it('is still due ON the due date — a filing due today is not late today', () => {
    expect(deriveStatus('due', on('2026-09-03'), today)).toBe('due');
  });

  it('becomes overdue the day after, with nothing written to the database', () => {
    expect(deriveStatus('due', on('2026-09-02'), today)).toBe('overdue');
  });

  it('treats filed and waived as terminal — a filing never becomes overdue later', () => {
    expect(deriveStatus('filed', on('2020-01-01'), today)).toBe('filed');
    expect(deriveStatus('waived', on('2020-01-01'), today)).toBe('waived');
  });
});
