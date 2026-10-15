/** PAY-04, NFR-04: NUMERIC text is converted exactly at the DB boundary. */
import { describe, expect, it } from 'vitest';
import { parseRupees, decimalRupees, paise } from '../src/core/money/index.js';

describe('Exact PostgreSQL NUMERIC boundary', () => {
  it.each([
    ['0.00', 0],
    ['0.01', 1],
    ['10000.25', 1000025],
    ['32286.00', 3228600],
    ['-2500.50', -250050],
    ['-0.01', -1],
  ] as const)('parses %s without floating point money conversion', (text, expected) => {
    expect(parseRupees(text)).toBe(expected);
    expect(parseRupees(decimalRupees(paise(expected)))).toBe(expected);
  });
  it.each(['1.001', 'NaN', 'Infinity', '1e3', '', 'not-money'])(
    'rejects ambiguous value %s',
    (value) => {
      expect(() => parseRupees(value)).toThrow();
    },
  );
  it('rejects a value outside the Money safe range', () => {
    expect(() => parseRupees('999999999999.99')).toThrow('safe money range');
  });
  it('writes exact two-decimal SQL money with a preserved negative sign', () => {
    expect(decimalRupees(paise(1000025))).toBe('10000.25');
    expect(decimalRupees(paise(-1))).toBe('-0.01');
  });
});
