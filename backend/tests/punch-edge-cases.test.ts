/**
 * Punch in/out EDGE CASES (ATT-03/05/18, docs/04 §1.1-1.2, 09 §4).
 *
 * The happy paths live in day-status-compute.test.ts. This file is only the
 * boundaries and the malformed-reality cases: exact-second grace and threshold
 * ties, midnight crossings, the two-session split seam, capture-window edges,
 * and the shapes a real Kent feed actually delivers — duplicate reads, a lone
 * punch, reversed IN/OUT, unordered batches.
 *
 * Every expected value is hand-computed from the shift definition, never taken
 * from a previous run of the code.
 */
import { describe, expect, it } from 'vitest';
import type { Selectable } from 'kysely';
import type { AttShiftsTable } from '../src/core/db/types.js';
import { computeDayStatus, type AttendancePolicy } from '../src/modules/attendance/day-status.service.js';

const IST_OFFSET_MS = 5.5 * 3600_000;
/** A wall-clock IST instant. `sec` lets a test sit one second either side of a boundary. */
function ist(isoDate: string, time: string, sec = 0): Date {
  return new Date(new Date(`${isoDate}T${time}:00Z`).getTime() - IST_OFFSET_MS + sec * 1000);
}
function punch(at: Date, direction: 'in' | 'out'): { swipeTs: Date; direction: string } {
  return { swipeTs: at, direction };
}

const policy: AttendancePolicy = {
  earlyMarginMs: 4 * 3600_000,
  lateMarginMs: 8 * 3600_000,
  sessionPresentFraction: 0.5,
  otMinMinutes: 30,
  otDecisionHours: 48,
};

function shift(overrides: Partial<Selectable<AttShiftsTable>> = {}): Selectable<AttShiftsTable> {
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

const day = (s: Selectable<AttShiftsTable>) => ({ shift: s, isWeekOff: false, isHoliday: false });

const TUE = '2031-03-04';
const WED = '2031-03-05';

// A single-interval general shift: status comes from hours, not session coverage.
const gen = day(shift({ code: 'GEN', session_split: null, min_full_day_hours: '8', min_half_day_hours: '4' }));

describe('grace boundary — the exact second', () => {
  it('arriving exactly on the grace edge (09:10:00) is not late', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:10'), ist(TUE, '18:00')], policy);
    expect(r.lateMinutes).toBe(0);
  });

  it('one second past the grace edge is late, but rounds down to 0 whole minutes', () => {
    // Policy is minute-granular: 1s over grace is "late" in kind, 0 in magnitude.
    // Documented so nobody "fixes" this into a 1-minute penalty by rounding up.
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:10', 1), ist(TUE, '18:00')], policy);
    expect(r.lateMinutes).toBe(0);
  });

  it('a full minute past grace is exactly 1 late minute', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:11'), ist(TUE, '18:00')], policy);
    expect(r.lateMinutes).toBe(1);
  });

  it('leaving exactly on the early-exit grace edge (17:50) is not an early exit', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '17:50')], policy);
    expect(r.earlyExitMinutes).toBe(0);
  });

  it('one minute inside the early-exit grace is exactly 1 minute', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '17:49')], policy);
    expect(r.earlyExitMinutes).toBe(1);
  });
});

describe('half/full-day thresholds — the exact tie', () => {
  it('worked minutes exactly equal to the full-day threshold is Present, not half', () => {
    // 8h full. 09:00–17:30 = 510 raw − 30 unpaid break = 480 = exactly 8h.
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '17:30')], policy);
    expect(r.workedMinutes).toBe(480);
    expect(r.status).toBe('P');
  });

  it('one minute short of full-day falls to half-day', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '17:29')], policy);
    expect(r.workedMinutes).toBe(479);
    expect(r.status).toBe('HD');
  });

  it('worked minutes exactly equal to the half-day threshold is HD, not Absent', () => {
    // 09:00–13:30 = 270 raw − 30 break = 240 = exactly 4h.
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '13:30')], policy);
    expect(r.workedMinutes).toBe(240);
    expect(r.status).toBe('HD');
  });

  it('one minute short of half-day is Absent despite a real punch pair', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '13:29')], policy);
    expect(r.workedMinutes).toBe(239);
    expect(r.status).toBe('A');
  });

  it('an unpaid break is what pushes a borderline day under the line', () => {
    // Same punches, break_paid flipped: 240 vs 270 minutes across the 4h line.
    const paid = day(shift({ code: 'GEN', session_split: null, min_full_day_hours: '8', min_half_day_hours: '4.5', break_paid: true }));
    const unpaid = day(shift({ code: 'GEN', session_split: null, min_full_day_hours: '8', min_half_day_hours: '4.5', break_paid: false }));
    const swipes = [ist(TUE, '09:00'), ist(TUE, '13:30')];
    expect(computeDayStatus(paid, TUE, swipes, policy).status).toBe('HD'); // 270 ≥ 270
    expect(computeDayStatus(unpaid, TUE, swipes, policy).status).toBe('A'); // 240 < 270
  });
});

describe('capture-window boundaries', () => {
  it('a punch exactly on the early window edge is captured', () => {
    // early margin 4h → window opens 05:00.
    const r = computeDayStatus(gen, TUE, [ist(TUE, '05:00'), ist(TUE, '18:00')], policy);
    expect(r.firstIn).toEqual(ist(TUE, '05:00'));
  });

  it('one second before the early window edge is not captured', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '05:00', -1), ist(TUE, '18:00')], policy);
    expect(r.firstIn).toEqual(ist(TUE, '18:00'));
  });

  it('a punch exactly on the late window edge is captured', () => {
    // late margin 8h → window closes 02:00 next day.
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(WED, '02:00')], policy);
    expect(r.lastOut).toEqual(ist(WED, '02:00'));
  });

  it('one second past the late window edge is dropped', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(WED, '02:00', 1)], policy);
    expect(r.lastOut).toBeNull();
  });

  it('every punch outside the window is UAB, not Absent — nobody was seen', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '03:00'), ist(WED, '05:00')], policy);
    expect(r.status).toBe('UAB');
    expect(r.firstIn).toBeNull();
  });
});

describe('malformed real-world feeds', () => {
  it('a lone IN with no OUT yields no lastOut and does not fabricate hours', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00')], policy);
    expect(r.firstIn).toEqual(ist(TUE, '09:00'));
    expect(r.lastOut).toBeNull();
    expect(r.workedMinutes).toBe(0);
    expect(r.status).toBe('A');
  });

  it('duplicate reads at the identical instant are not a zero-length day of work', () => {
    // Kent double-reads happen. Same ms twice must not become lastOut = firstIn.
    const at = ist(TUE, '09:00');
    const r = computeDayStatus(gen, TUE, [at, new Date(at.getTime())], policy);
    expect(r.lastOut).toBeNull();
    expect(r.workedMinutes).toBe(0);
  });

  it('an OUT recorded before the IN does not produce negative worked minutes', () => {
    const r = computeDayStatus(
      gen,
      TUE,
      [punch(ist(TUE, '18:00'), 'out'), punch(ist(TUE, '09:00'), 'in')],
      policy,
    );
    expect(r.workedMinutes).toBeGreaterThanOrEqual(0);
  });

  it('a day of only OUT punches still brackets FILO instead of losing the day', () => {
    const r = computeDayStatus(
      gen,
      TUE,
      [punch(ist(TUE, '09:00'), 'out'), punch(ist(TUE, '18:00'), 'out')],
      policy,
    );
    expect(r.firstIn).toEqual(ist(TUE, '09:00'));
    expect(r.lastOut).toEqual(ist(TUE, '18:00'));
  });

  it('an unordered batch gives the same answer as a sorted one', () => {
    const [a, b, c, e] = [ist(TUE, '09:00'), ist(TUE, '13:00'), ist(TUE, '14:00'), ist(TUE, '18:00')];
    expect(computeDayStatus(gen, TUE, [c, a, e, b], policy)).toEqual(
      computeDayStatus(gen, TUE, [a, b, c, e], policy),
    );
  });

  it('mid-day exit and re-entry is still FILO, not the sum of the pieces', () => {
    // 09:00 in, 12:00 out (bank run), 14:00 in, 18:00 out → FILO span, not 7h.
    const r = computeDayStatus(gen, TUE, [
      punch(ist(TUE, '09:00'), 'in'),
      punch(ist(TUE, '12:00'), 'out'),
      punch(ist(TUE, '14:00'), 'in'),
      punch(ist(TUE, '18:00'), 'out'),
    ], policy);
    expect(r.firstIn).toEqual(ist(TUE, '09:00'));
    expect(r.lastOut).toEqual(ist(TUE, '18:00'));
    expect(r.workedMinutes).toBe(510); // 9h − 30 unpaid break
  });
});

describe('two-session split seam (G5, 09 §4)', () => {
  const g5 = day(shift());

  it('leaving exactly at the split covers session 1 only', () => {
    const r = computeDayStatus(g5, TUE, [ist(TUE, '09:00'), ist(TUE, '13:30')], policy);
    expect(r.sessionStatuses).toEqual([
      { session: 1, status: 'P' },
      { session: 2, status: 'A' },
    ]);
    expect(r.status).toBe('HD');
  });

  it('arriving exactly at the split start covers session 2 only', () => {
    const r = computeDayStatus(g5, TUE, [ist(TUE, '13:31'), ist(TUE, '18:00')], policy);
    expect(r.sessionStatuses).toEqual([
      { session: 1, status: 'A' },
      { session: 2, status: 'P' },
    ]);
    expect(r.status).toBe('HD');
  });

  it('coverage exactly at the 50% fraction counts the session Present', () => {
    // Session 1 = 09:00–13:30 (270 min); need = 135 → out at 11:15 is exactly half.
    const r = computeDayStatus(g5, TUE, [ist(TUE, '09:00'), ist(TUE, '11:15')], policy);
    expect(r.sessionStatuses?.[0]).toEqual({ session: 1, status: 'P' });
  });

  it('one minute under the fraction drops the session to Absent', () => {
    const r = computeDayStatus(g5, TUE, [ist(TUE, '09:00'), ist(TUE, '11:14')], policy);
    expect(r.sessionStatuses?.[0]).toEqual({ session: 1, status: 'A' });
    expect(r.status).toBe('A');
  });

  it('a day spanning both sessions is Present even when the gap is unworked', () => {
    const r = computeDayStatus(g5, TUE, [ist(TUE, '09:00'), ist(TUE, '18:00')], policy);
    expect(r.status).toBe('P');
  });
});

describe('midnight-crossing night shift', () => {
  const night = day(shift({
    code: 'NIGHT',
    start_time: '21:00:00',
    end_time: '06:00:00',
    crosses_midnight: true,
    session_split: null,
    min_full_day_hours: '8',
    min_half_day_hours: '4',
  }));

  it('punches either side of midnight belong to the shift start date', () => {
    const r = computeDayStatus(night, TUE, [ist(TUE, '21:00'), ist(WED, '06:00')], policy);
    expect(r.status).toBe('P');
    expect(r.workedMinutes).toBe(510); // 9h − 30 break
    expect(r.lateMinutes).toBe(0);
    expect(r.earlyExitMinutes).toBe(0);
  });

  it('leaving one minute after midnight is a real early exit, not a next-day problem', () => {
    // End 06:00 next day, grace 10 → leaving 00:01 is 349 min early.
    const r = computeDayStatus(night, TUE, [ist(TUE, '21:00'), ist(WED, '00:01')], policy);
    expect(r.earlyExitMinutes).toBe(349);
  });

  it('arriving after midnight is late by the full elapsed time', () => {
    // Start 21:00, grace 10 → arriving 00:30 next day is 3h30m (210) − 10 = 200 min late.
    const r = computeDayStatus(night, TUE, [ist(WED, '00:30'), ist(WED, '06:00')], policy);
    expect(r.lateMinutes).toBe(200);
  });

  it('working past the night shift end produces OT past midnight', () => {
    const r = computeDayStatus(night, TUE, [ist(TUE, '21:00'), ist(WED, '08:00')], policy);
    expect(r.otMinutes).toBe(120);
  });
});

describe('overtime detection boundaries', () => {
  it('leaving exactly at shift end is zero OT', () => {
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '18:00')], policy);
    expect(r.otMinutes).toBe(0);
  });

  it('OT starts only after the configured offset, not at shift end', () => {
    const withOffset = day(shift({ code: 'GEN', session_split: null, ot_start_offset_minutes: 30 }));
    // Out at 18:20 — inside the 30-min offset → no OT.
    expect(computeDayStatus(withOffset, TUE, [ist(TUE, '09:00'), ist(TUE, '18:20')], policy).otMinutes).toBe(0);
    // Out at 19:00 — 30 min past the offset.
    expect(computeDayStatus(withOffset, TUE, [ist(TUE, '09:00'), ist(TUE, '19:00')], policy).otMinutes).toBe(30);
  });

  it('grace-out does not shave detected OT minutes', () => {
    // OT is an entitlement concept; grace is a penalty one. They must not net off.
    const r = computeDayStatus(gen, TUE, [ist(TUE, '09:00'), ist(TUE, '19:00')], policy);
    expect(r.otMinutes).toBe(60);
  });
});

describe('week-off and holiday punches (docs/04 §1.4)', () => {
  it('working a week-off keeps status WO and books every minute as OT', () => {
    const wo = { shift: null, isWeekOff: true, isHoliday: false };
    const r = computeDayStatus(wo, TUE, [ist(TUE, '09:00'), ist(TUE, '17:00')], policy);
    expect(r.status).toBe('WO');
    expect(r.otMinutes).toBe(480);
    expect(r.workedMinutes).toBe(480);
  });

  it('a holiday with no punches books no OT', () => {
    const h = { shift: null, isWeekOff: false, isHoliday: true };
    const r = computeDayStatus(h, TUE, [], policy);
    expect(r.status).toBe('H');
    expect(r.otMinutes).toBe(0);
  });

  it('week-off work is not clipped by a capture window it has no shift for', () => {
    // No shift → no window. A 04:00 start on a week-off still counts in full.
    const wo = { shift: null, isWeekOff: true, isHoliday: false };
    const r = computeDayStatus(wo, TUE, [ist(TUE, '04:00'), ist(TUE, '08:00')], policy);
    expect(r.otMinutes).toBe(240);
  });
});
