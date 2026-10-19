/** SHF-01: hand-written policy boundaries, no derived payroll expectations. */
import { describe, expect, it } from 'vitest';
import { evaluateAttendancePenalties, timeSlabsSchema } from '../src/modules/attendance/penalty-evaluation.js';
const rules = [
  { fromMin: 0, toMin: 15, effect: 'none' },
  { fromMin: 16, toMin: 30, effect: 'late' },
  { fromMin: 31, toMin: null, effect: 'half_day' },
];
describe('SHF-01 separate penalty evaluation', () => {
  it('records inclusive boundaries without adding a pay or attendance quantity', () => {
    expect(evaluateAttendancePenalties(15, 0, rules, [])).toEqual([]);
    expect(evaluateAttendancePenalties(16, 0, rules, [])).toEqual([
      { cause: 'late_arrival', minutes: 16, rule: rules[1] },
    ]);
    expect(evaluateAttendancePenalties(30, 0, rules, [])[0]?.rule.effect).toBe('late');
    expect(evaluateAttendancePenalties(31, 0, rules, [])[0]?.rule.effect).toBe('half_day');
  });
  it('keeps late and early findings separate, without summing two half-day rules', () => {
    const results = evaluateAttendancePenalties(40, 50, rules, rules);
    expect(results).toEqual([
      { cause: 'late_arrival', minutes: 40, rule: rules[2] },
      { cause: 'early_exit', minutes: 50, rule: rules[2] },
    ]);
    rules[2] = { fromMin: 31, toMin: null, effect: 'none' };
    expect(results[0]?.rule.effect).toBe('half_day'); // snapshot, not a mutable catalog alias
    rules[2] = { fromMin: 31, toMin: null, effect: 'half_day' };
  });
  it('never penalizes zero deviation even with a rule beginning at zero', () => {
    expect(evaluateAttendancePenalties(0, 0, [{ fromMin: 0, toMin: null, effect: 'half_day' }], [])).toEqual([]);
  });
  it.each([
    [{ fromMin: 20, toMin: 10, effect: 'late' }],
    [{ fromMin: 0, toMin: 15, effect: 'none' }, { fromMin: 15, toMin: 30, effect: 'late' }],
    [{ fromMin: 0, toMin: null, effect: 'late' }, { fromMin: 40, toMin: null, effect: 'half_day' }],
    [{ fromMin: 0.5, toMin: null, effect: 'late' }],
  ])('refuses ambiguous or invalid rules %j', (...slabs) => {
    expect(timeSlabsSchema.safeParse(slabs).success).toBe(false);
  });
  it('refuses malformed stored rules instead of silently reporting no penalty', () => {
    expect(() => evaluateAttendancePenalties(40, 0, {}, [])).toThrow();
    expect(() => evaluateAttendancePenalties(-1, 0, [], [])).toThrow();
  });
});
