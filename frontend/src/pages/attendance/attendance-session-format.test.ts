import { describe, expect, it } from 'vitest';
import { attendanceSessionGlyph, attendanceSessionDescription } from './attendance-session-format';

describe('ATT-05 session display', () => {
  it.each([
    ['P', 'P', 'P'], ['A', 'P', 'A:P'], ['P', 'A', 'P:A'], ['A', 'A', 'A'], ['P', 'O', 'P:O'],
  ] as const)('displays %s / %s as %s', (first, second, expected) => {
    const sessions = [{ session: 1, status: first }, { session: 2, status: second }];
    expect(attendanceSessionGlyph('HD', sessions)).toBe(expected);
  });
  it('names off separately from absent for accessible descriptions', () => {
    expect(attendanceSessionDescription([{ session: 1, status: 'P' }, { session: 2, status: 'O' }]))
      .toBe('Session 1: Present; Session 2: Off');
    expect(attendanceSessionGlyph('WO', null)).toBe('WO');
  });
});
