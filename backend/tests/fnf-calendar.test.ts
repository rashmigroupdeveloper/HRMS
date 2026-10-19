import { describe, expect, it } from 'vitest';
import { fnfCycleForDate, fnfCycles, fnfTatState } from '../src/modules/payroll-core/fnf/fnf-calendar.js';

describe('F&F cycle calendar', () => {
  it('splits a month into two cycles and a 31-day close', () => {
    expect(fnfCycles('2026-10')).toEqual([
      { cycle: 1, opens: '2026-10-01', closes: '2026-10-15' },
      { cycle: 2, opens: '2026-10-16', closes: '2026-10-31' },
    ]);
    expect(fnfCycleForDate('2026-10-16')).toBe(2);
  });

  it('marks turnaround from the due date', () => {
    expect(fnfTatState('2026-10-20', '2026-10-19', 'computed')).toBe('on_track');
    expect(fnfTatState('2026-10-20', '2026-10-20', 'computed')).toBe('due_today');
    expect(fnfTatState('2026-10-20', '2026-10-21', 'computed')).toBe('overdue');
    expect(fnfTatState('2026-10-20', '2026-10-21', 'paid')).toBe('closed');
  });
});
