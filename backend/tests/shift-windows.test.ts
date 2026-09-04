/**
 * SHF-01/02/03 — overlap, midnight-crossing, hours, rest, late slabs.
 * Hand-derived windows; the processor is not the source of expected values.
 */
import { describe, expect, it } from 'vitest';
import {
  anyIntervalsOverlap,
  applyAttendanceSlabs,
  matchingSlab,
  mondayOf,
  parseTimeSlabs,
  plannedMinutes,
  quarterKey,
  restHoursBetween,
  shiftIntervals,
  type ShiftTiming,
} from '../src/modules/attendance/shift-windows.js';

const gen: ShiftTiming = {
  code: 'GEN',
  startTime: '09:00',
  endTime: '18:00',
  crossesMidnight: false,
  breakMinutes: 60,
  breakPaid: false,
  session2Start: null,
  session2End: null,
};

const night: ShiftTiming = {
  code: 'NIGHT',
  startTime: '21:00',
  endTime: '06:00',
  crossesMidnight: true,
  breakMinutes: 30,
  breakPaid: false,
  session2Start: null,
  session2End: null,
};

const early: ShiftTiming = {
  code: 'EARLY',
  startTime: '05:00',
  endTime: '13:00',
  crossesMidnight: false,
  breakMinutes: 0,
  breakPaid: true,
  session2Start: null,
  session2End: null,
};

describe('shift windows (SHF-02)', () => {
  it('does not treat a night shift ending 06:00 as overlapping GEN 09:00 the next day', () => {
    const left = shiftIntervals('2026-09-01', night);
    const right = shiftIntervals('2026-09-02', gen);
    expect(anyIntervalsOverlap(left, right)).toBe(false);
  });

  it('blocks night 21:00–06:00 against EARLY 05:00–13:00 the next morning', () => {
    const left = shiftIntervals('2026-09-01', night);
    const right = shiftIntervals('2026-09-02', early);
    expect(anyIntervalsOverlap(left, right)).toBe(true);
  });

  it('treats abutting windows as non-overlapping (half-open)', () => {
    const a: ShiftTiming = { ...gen, startTime: '06:00', endTime: '14:00' };
    const b: ShiftTiming = { ...gen, startTime: '14:00', endTime: '22:00' };
    expect(anyIntervalsOverlap(shiftIntervals('2026-09-01', a), shiftIntervals('2026-09-01', b))).toBe(
      false,
    );
  });
});

describe('planned hours (SHF-03)', () => {
  it('deducts an unpaid break and not a paid one', () => {
    expect(plannedMinutes(gen)).toBe(8 * 60); // 09:00–18:00 minus 60
    expect(plannedMinutes({ ...gen, breakPaid: true })).toBe(9 * 60);
  });

  it('counts a night window as 9 hours minus unpaid break', () => {
    expect(plannedMinutes(night)).toBe(9 * 60 - 30);
  });
});

describe('rest between shifts', () => {
  it('measures 3h from night-end 06:00 to GEN 09:00', () => {
    expect(restHoursBetween('2026-09-01', night, '2026-09-02', gen)).toBe(3);
  });

  it('is negative when the next window starts before the previous ends', () => {
    expect(restHoursBetween('2026-09-01', night, '2026-09-02', early)).toBeLessThan(0);
  });
});

describe('calendar keys', () => {
  it('mondayOf is ISO-week Monday', () => {
    expect(mondayOf('2026-09-02')).toBe('2026-08-31'); // Wed → Mon
    expect(mondayOf('2026-08-31')).toBe('2026-08-31');
  });

  it('quarterKey is calendar quarter', () => {
    expect(quarterKey('2026-09-02')).toBe('2026-Q3');
    expect(quarterKey('2026-01-01')).toBe('2026-Q1');
  });
});

describe('late / early slabs (SHF-01)', () => {
  const slabs = parseTimeSlabs(
    '[{"fromMin":0,"toMin":15,"effect":"none"},{"fromMin":16,"toMin":30,"effect":"late"},{"fromMin":31,"toMin":null,"effect":"half_day"}]',
  );

  it('parses the documented 0–15 / 16–30 / >30 ladder', () => {
    expect(matchingSlab(10, slabs)?.effect).toBe('none');
    expect(matchingSlab(16, slabs)?.effect).toBe('late');
    expect(matchingSlab(31, slabs)?.effect).toBe('half_day');
    expect(matchingSlab(90, slabs)?.effect).toBe('half_day');
  });

  it('forces HD when a half-day slab matches, never invents Present from Absent', () => {
    expect(applyAttendanceSlabs('P', 40, 0, slabs, [])).toBe('HD');
    expect(applyAttendanceSlabs('A', 40, 0, slabs, [])).toBe('A');
    expect(applyAttendanceSlabs('P', 10, 0, slabs, [])).toBe('P');
  });
});
