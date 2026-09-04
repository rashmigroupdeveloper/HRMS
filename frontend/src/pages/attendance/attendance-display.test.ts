import { describe, expect, it } from 'vitest';
import { attendanceState, formatAttendanceMinutes, sessionLabel } from './attendance-display';

describe('attendance display contract', () => {
  it('formats stored integer minutes without decimal-hour ambiguity', () => {
    expect(formatAttendanceMinutes(null)).toBe('Not recorded');
    expect(formatAttendanceMinutes(0)).toBe('0 min');
    expect(formatAttendanceMinutes(45)).toBe('45 min');
    expect(formatAttendanceMinutes(60)).toBe('1 h');
    expect(formatAttendanceMinutes(515)).toBe('8 h 35 min');
  });

  it('does not collapse OD or comp-off into week off', () => {
    expect(attendanceState('OD')).toBe('present');
    expect(attendanceState('CO')).toBe('present');
    expect(attendanceState('L')).toBe('leave');
    expect(attendanceState('WO')).toBe('weekoff');
  });

  it('names first and second half explicitly', () => {
    expect(sessionLabel({ session: 1, status: 'A' })).toBe('First half · Absent');
    expect(sessionLabel({ session: 2, status: 'P' })).toBe('Second half · Present');
  });
});
