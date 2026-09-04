/**
 * core/org/states unit tests — the R7 `PT Location` column (docs/06 §2.1).
 * The live register prints the full state NAME ('West Bengal'), while every
 * table stores the 2-letter code ('WB'). One map, one direction each way.
 */
import { describe, expect, it } from 'vitest';
import { INDIA_STATE_NAMES, isStateCode, stateName } from '../src/core/org/states.js';

describe('core/org/states', () => {
  it('renders the live register value for the WB payroll base', () => {
    expect(stateName('WB')).toBe('West Bengal');
  });

  it('covers every state a Rashmi entity could be PT-registered in', () => {
    // PT is levied by ~16 states; the map must be complete, not WB-only,
    // because a second entity in another state must not silently print a code.
    for (const code of ['MH', 'KA', 'TN', 'GJ', 'AP', 'TS', 'OD', 'JH', 'BR', 'MP', 'AS']) {
      expect(isStateCode(code)).toBe(true);
      expect(stateName(code)).not.toBe(code);
    }
  });

  it('falls through an unknown code as-is instead of throwing or printing blank', () => {
    // A register row must never lose its PT location; an unmapped code is
    // visible in the output where finance will spot it.
    expect(stateName('ZZ')).toBe('ZZ');
    expect(isStateCode('ZZ')).toBe(false);
  });

  it('is case-insensitive on input but canonical on output', () => {
    expect(stateName('wb')).toBe('West Bengal');
  });

  it('has no duplicate names and no empty entries', () => {
    const names = Object.values(INDIA_STATE_NAMES);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.trim().length > 0)).toBe(true);
  });
});
