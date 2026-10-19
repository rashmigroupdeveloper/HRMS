/** ATT-04/05/18 + SHF-01: hand-computed timing recovery, no policy/rate changes. */
import { describe, expect, it } from 'vitest';
import { scheduledShiftIntervals, shiftSessions } from '../src/modules/attendance/shift-windows.js';
import {
  computeDayStatus,
  type AttendancePolicy,
  type ResolvedShift,
} from '../src/modules/attendance/day-status.service.js';
const date = '2026-10-05';
const at = (time: string) => new Date(`${date}T${time}:00+05:30`);
const policy: AttendancePolicy = {
  earlyMarginMs: 4 * 3600000,
  lateMarginMs: 8 * 3600000,
  sessionPresentFraction: 0.5,
  otMinMinutes: 30,
  otDecisionHours: 48,
};
function day(overrides: Partial<NonNullable<ResolvedShift['shift']>> = {}): ResolvedShift {
  return {
    isHoliday: false,
    isWeekOff: false,
    shift: {
      id: 1,
      code: 'SYN',
      name: 'Synthetic shift',
      start_time: '09:00',
      end_time: '13:00',
      crosses_midnight: false,
      session_split: null,
      session2_start: '14:00',
      session2_end: '18:00',
      min_half_day_hours: '4',
      min_full_day_hours: '8',
      grace_in_minutes: 0,
      grace_out_minutes: 0,
      break_minutes: 0,
      break_paid: false,
      ot_start_offset_minutes: 0,
      late_slabs: [],
      early_exit_slabs: [],
      allowance_component_code: null,
      is_active: true,
      created_at: new Date(0),
      updated_at: new Date(0),
      ...overrides,
    },
  };
}
describe('SHF-01 recovered shift facts', () => {
  it('counts 09–13 plus 14–18 as eight hours, excluding the gap', () => {
    const result = computeDayStatus(day(), date, [at('09:00'), at('18:00')], policy);
    expect(result).toMatchObject({
      status: 'P',
      workedMinutes: 480,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      otMinutes: 0,
    });
    expect(result.sessionStatuses?.map((s) => s.status)).toEqual(['P', 'P']);
  });
  it.each([
    [
      ['09:00', '13:00'],
      ['P', 'A'],
    ],
    [
      ['14:00', '18:00'],
      ['A', 'P'],
    ],
    [[], ['A', 'A']],
  ] as const)('retains both split-session facts for %j', (times, sessions) => {
    const result = computeDayStatus(day(), date, times.map(at), policy);
    expect(result.status).toBe(times.length ? 'HD' : 'A');
    expect(result.sessionStatuses?.map((s) => s.status)).toEqual(sessions);
  });
  it('does not subtract a paid break from the single-span worked time', () => {
    const result = computeDayStatus(
      day({
        end_time: '18:00',
        session2_start: null,
        session2_end: null,
        break_minutes: 60,
        break_paid: true,
      }),
      date,
      [at('09:00'), at('18:00')],
      policy,
    );
    expect(result.workedMinutes).toBe(540);
  });
  it('uses explicit IN/OUT and excludes wrong-direction boundary swipes', () => {
    const result = computeDayStatus(
      day({ end_time: '18:00', session2_start: null, session2_end: null }),
      date,
      [
        { swipeTs: at('08:00'), direction: 'OUT' },
        { swipeTs: at('09:00'), direction: 'IN' },
        { swipeTs: at('18:00'), direction: 'out' },
        { swipeTs: at('19:00'), direction: 'in' },
      ],
      policy,
    );
    expect(result).toMatchObject({
      firstIn: at('09:00'),
      lastOut: at('18:00'),
      workedMinutes: 540,
      otMinutes: 0,
    });
  });
  it.each(['in', 'out'])('does not turn two known %s punches into a worked day', (direction) => {
    const result = computeDayStatus(
      day(),
      date,
      [
        { swipeTs: at('09:00'), direction },
        { swipeTs: at('18:00'), direction },
      ],
      policy,
    );
    expect(result.status).toBe('A');
    expect(result.workedMinutes).toBe(0);
  });
  it('uses unknown direction only when the matching explicit boundary is missing', () => {
    const result = computeDayStatus(
      day(),
      date,
      [
        { swipeTs: at('09:00'), direction: 'in' },
        { swipeTs: at('18:00'), direction: null },
      ],
      policy,
    );
    expect(result).toMatchObject({ status: 'P', workedMinutes: 480 });
  });
  it('shares separate half boundaries without covering the between-session gap', () => {
    const shift = day().shift;
    if (!shift) throw new Error('Missing synthetic shift');
    expect(shiftSessions(shift, date)).toEqual([
      { start: at('09:00').getTime(), end: at('13:00').getTime() },
      { start: at('14:00').getTime(), end: at('18:00').getTime() },
    ]);
    expect(() => scheduledShiftIntervals({ ...shift, session2_start: '12:00' }, date)).toThrow(
      /overlap/,
    );
    expect(() => scheduledShiftIntervals({ ...shift, session2_end: null }, date)).toThrow(
      /Incomplete/,
    );
  });
  it('starts detected OT after the configured offset from the last session end', () => {
    const result = computeDayStatus(
      day({ ot_start_offset_minutes: 30 }),
      date,
      [at('09:00'), at('18:50')],
      policy,
    );
    expect(result.otMinutes).toBe(20);
  });
  it('deducts grace from late/early duration without changing actual half presence', () => {
    const result = computeDayStatus(
      day({
        end_time: '18:00',
        session2_start: null,
        session2_end: null,
        session_split: '13:30',
        grace_in_minutes: 10,
        grace_out_minutes: 10,
      }),
      date,
      [at('09:25'), at('17:30')],
      policy,
    );
    expect(result.lateMinutes).toBe(15);
    expect(result.earlyExitMinutes).toBe(20);
    expect(result.sessionStatuses?.map((session) => session.status)).toEqual(['P', 'P']);
  });
  it('fails closed on a working day without configured shift facts', () => {
    expect(() =>
      computeDayStatus({ shift: null, isHoliday: false, isWeekOff: false }, date, [], policy),
    ).toThrow(/shift/i);
  });
});
