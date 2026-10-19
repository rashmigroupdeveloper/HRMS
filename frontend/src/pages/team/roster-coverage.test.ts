import { describe, expect, it } from 'vitest';
import { meterOverCap, parseCycleLine, shortfallCells } from './roster-coverage';

describe('roster coverage strip (SHF-03/04/06)', () => {
  it('flags a week that is already over the 48h cap', () => {
    expect(
      meterOverCap({
        employeeId: 1,
        weekHours: 49,
        weekCap: 48,
        quarterHours: 100,
        quarterCap: 624,
      }),
    ).toBe(true);
    expect(
      meterOverCap({
        employeeId: 1,
        weekHours: 36,
        weekCap: 48,
        quarterHours: 624,
        quarterCap: 624,
      }),
    ).toBe(false);
  });

  it('keeps only shortfall cells so the strip is clickable numbers', () => {
    expect(
      shortfallCells([
        {
          date: '2026-09-01',
          shiftCode: 'GEN',
          sanctioned: 4,
          rostered: 4,
          onLeave: 1,
          remaining: 3,
          shortfall: 1,
        },
        {
          date: '2026-09-02',
          shiftCode: 'GEN',
          sanctioned: 2,
          rostered: 3,
          onLeave: 0,
          remaining: 3,
          shortfall: 0,
        },
      ]),
    ).toHaveLength(1);
  });

  it('parses a 6-on/1-off cycle line', () => {
    expect(parseCycleLine('GEN, GEN, GEN, GEN, GEN, GEN, WO')).toEqual([
      { shiftCode: 'GEN', weekOff: false },
      { shiftCode: 'GEN', weekOff: false },
      { shiftCode: 'GEN', weekOff: false },
      { shiftCode: 'GEN', weekOff: false },
      { shiftCode: 'GEN', weekOff: false },
      { shiftCode: 'GEN', weekOff: false },
      { shiftCode: null, weekOff: true },
    ]);
  });
});
