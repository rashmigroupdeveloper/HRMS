/**
 * Pure day-status math — SHF-01 slabs must not swallow late_minutes, and
 * unpaid-break / OT-offset stay data-driven (hand-computed vs G5 09:00–18:00).
 */
import { describe, expect, it } from 'vitest';
import type { Selectable } from 'kysely';
import type { AttShiftsTable } from '../src/core/db/types.js';
import { computeDayStatus, type AttendancePolicy } from '../src/modules/attendance/day-status.service.js';

const IST_OFFSET_MS = 5.5 * 3600_000;
function ist(isoDate: string, time: string): Date {
  return new Date(new Date(`${isoDate}T${time}:00Z`).getTime() - IST_OFFSET_MS);
}

const policy: AttendancePolicy = {
  earlyMarginMs: 4 * 3600_000,
  lateMarginMs: 8 * 3600_000,
  sessionPresentFraction: 0.5,
  otMinMinutes: 30,
  otDecisionHours: 48,
};

function g5(overrides: Partial<Selectable<AttShiftsTable>> = {}): Selectable<AttShiftsTable> {
  const epoch = new Date('2026-01-01T00:00:00Z');
  return {
    id: 1,
    code: 'G5',
    name: 'G5 two-session',
    start_time: '09:00:00',
    end_time: '18:00:00',
    crosses_midnight: false,
    session_split: '13:30:00',
    grace_in_minutes: 10,
    grace_out_minutes: 10,
    min_half_day_hours: '4.0',
    min_full_day_hours: '7.0',
    break_minutes: 30,
    break_paid: false,
    ot_start_offset_minutes: 0,
    late_slabs: [],
    early_exit_slabs: [],
    allowance_component_code: null,
    session2_start: null,
    session2_end: null,
    is_active: true,
    created_at: epoch,
    updated_at: epoch,
    ...overrides,
  } as Selectable<AttShiftsTable>;
}

describe('computeDayStatus (SHF-01)', () => {
  const d = '2031-03-04'; // Tuesday
  const resolved = { shift: g5(), isWeekOff: false, isHoliday: false };

  it('distinguishes no-swipe UAB from short-hours A', () => {
    const noSwipes = computeDayStatus(resolved, d, [], policy);
    expect(noSwipes.status).toBe('UAB');
    expect(noSwipes.sessionStatuses).toEqual([
      { session: 1, status: 'A' },
      { session: 2, status: 'A' },
    ]);
    expect(computeDayStatus(resolved, d, [ist(d, '09:00'), ist(d, '10:00')], policy).status).toBe('A');
  });

  it('fails closed when a working day has no resolvable shift', () => {
    expect(() =>
      computeDayStatus(
        { shift: null, isWeekOff: false, isHoliday: false },
        d,
        [],
        policy,
      ),
    ).toThrow(/No active shift/);
  });

  it('TUE 09:25–18:00 is P with 15 late minutes after the 10-minute grace', () => {
    const r = computeDayStatus(resolved, d, [ist(d, '09:25'), ist(d, '18:00')], policy);
    expect(r.status).toBe('P');
    expect(r.lateMinutes).toBe(15);
    expect(r.earlyExitMinutes).toBe(0);
  });

  it('empty late slabs never rewrite a Present as half-day', () => {
    const r = computeDayStatus(resolved, d, [ist(d, '09:25'), ist(d, '18:00')], policy);
    expect(r.status).toBe('P');
  });

  it('a >30 half-day slab forces HD but still records the raw late minutes', () => {
    const shift = g5({
      late_slabs: [
        { fromMin: 0, toMin: 15, effect: 'none' },
        { fromMin: 16, toMin: 30, effect: 'late' },
        { fromMin: 31, toMin: null, effect: 'half_day' },
      ],
    });
    const r = computeDayStatus({ shift, isWeekOff: false, isHoliday: false }, d, [ist(d, '09:41'), ist(d, '18:00')], policy);
    expect(r.lateMinutes).toBe(31);
    expect(r.status).toBe('HD');
  });

  it('paid break does not deduct from worked minutes', () => {
    const shift = g5({ break_paid: true, session_split: null });
    const r = computeDayStatus(
      { shift, isWeekOff: false, isHoliday: false },
      d,
      [ist(d, '09:00'), ist(d, '18:00')],
      policy,
    );
    expect(r.workedMinutes).toBe(540);
  });

  it('OT starts after end + ot_start_offset_minutes', () => {
    const shift = g5({ session_split: null, ot_start_offset_minutes: 30 });
    const r = computeDayStatus(
      { shift, isWeekOff: false, isHoliday: false },
      d,
      [ist(d, '09:00'), ist(d, '18:45')],
      policy,
    );
    expect(r.otMinutes).toBe(15);
  });

  it('uses explicit IN/OUT directions instead of a stray boundary swipe for FILO', () => {
    const shift = g5({ session_split: null });
    const r = computeDayStatus(
      { shift, isWeekOff: false, isHoliday: false },
      d,
      [
        { swipeTs: ist(d, '08:40'), direction: 'out' },
        { swipeTs: ist(d, '09:00'), direction: 'in' },
        { swipeTs: ist(d, '18:00'), direction: 'out' },
        { swipeTs: ist(d, '18:30'), direction: 'in' },
      ],
      policy,
    );
    expect(r.firstIn).toEqual(ist(d, '09:00'));
    expect(r.lastOut).toEqual(ist(d, '18:00'));
    expect(r.workedMinutes).toBe(510);
    expect(r.otMinutes).toBe(0);
  });

  it('computes a discontinuous split shift from both scheduled sessions, excluding the gap', () => {
    const shift = g5({
      start_time: '06:00:00',
      end_time: '10:00:00',
      session_split: null,
      session2_start: '16:00:00',
      session2_end: '20:00:00',
      min_half_day_hours: '4.0',
      min_full_day_hours: '8.0',
      break_minutes: 0,
    });
    const r = computeDayStatus(
      { shift, isWeekOff: false, isHoliday: false },
      d,
      [ist(d, '06:00'), ist(d, '20:00')],
      policy,
    );
    expect(r.status).toBe('P');
    expect(r.workedMinutes).toBe(480);
    expect(r.earlyExitMinutes).toBe(0);
    expect(r.sessionStatuses).toEqual([
      { session: 1, status: 'P' },
      { session: 2, status: 'P' },
    ]);
  });

  it('identifies attendance in only the second half of G5', () => {
    const r = computeDayStatus(
      resolved,
      d,
      [ist(d, '13:31'), ist(d, '18:00')],
      policy,
    );
    expect(r.status).toBe('HD');
    expect(r.sessionStatuses).toEqual([
      { session: 1, status: 'A' },
      { session: 2, status: 'P' },
    ]);
  });
});

describe('computeDayStatus — punch at a different shift timing', () => {
  const d = '2031-03-04';
  const next = '2031-03-05';
  const gen = {
    shift: g5({
      code: 'GEN',
      name: 'General',
      session_split: null,
      min_full_day_hours: '8',
      min_half_day_hours: '4',
    }),
    isWeekOff: false,
    isHoliday: false,
  };
  const night = {
    shift: g5({
      code: 'NIGHT',
      name: 'Night',
      start_time: '21:00:00',
      end_time: '06:00:00',
      crosses_midnight: true,
      session_split: null,
      min_full_day_hours: '8',
      min_half_day_hours: '4',
    }),
    isWeekOff: false,
    isHoliday: false,
  };

  it('does not mark Present when a GEN person works a night window (swipes outside GEN capture)', () => {
    // GEN capture = 05:00–02:00 next. 06:00 next-day OUT is outside; only 21:00 IN counts.
    const r = computeDayStatus(gen, d, [ist(d, '21:00'), ist(next, '06:00')], policy);
    expect(r.status).toBe('A');
    expect(r.workedMinutes).toBe(0);
  });

  it('late-evening punches still inside GEN +8h are short-hours Absent, not a night Present', () => {
    // 21:00–23:00 is inside 18:00+8h. Worked = 120 − 30 unpaid break = 90 min < 4h half.
    const r = computeDayStatus(gen, d, [ist(d, '21:00'), ist(d, '23:00')], policy);
    expect(r.status).toBe('A');
    expect(r.workedMinutes).toBe(90);
  });

  it('does not mark a night-rostered person Present from a daytime GEN punch pair', () => {
    // Night capture = 17:00–14:00 next. 09:00 is outside; 18:00 is only the early margin.
    const r = computeDayStatus(night, d, [ist(d, '09:00'), ist(d, '18:00')], policy);
    expect(r.status).toBe('A');
    expect(r.workedMinutes).toBe(0);
  });

  it('night roster + night punches is Present against the night thresholds', () => {
    const r = computeDayStatus(night, d, [ist(d, '21:00'), ist(next, '06:00')], policy);
    expect(r.status).toBe('P');
    expect(r.workedMinutes).toBe(510); // 9h − 30 min unpaid break
  });

  it('no swipe in the rostered window is UAB, not silent Present', () => {
    expect(computeDayStatus(gen, d, [], policy).status).toBe('UAB');
    expect(computeDayStatus(night, d, [], policy).status).toBe('UAB');
  });
});
