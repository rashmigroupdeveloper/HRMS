import { describe, expect, it } from 'vitest';
import { formatINR, formatPaiseINR } from './format';

describe('formatINR', () => {
  it('formats standard rupee amounts with Indian comma grouping', () => {
    const formatted = formatINR(123456.78).replace(/\u00a0/g, ' ');
    expect(formatted).toBe('₹1,23,456.78');
  });

  it('formats zero correctly', () => {
    const formatted = formatINR(0).replace(/\u00a0/g, ' ');
    expect(formatted).toBe('₹0.00');
  });

  it('handles non-finite values safely', () => {
    expect(formatINR(NaN)).toBe('₹0.00');
    expect(formatINR(Infinity)).toBe('₹0.00');
  });

  it('formats paise amounts correctly', () => {
    const formatted = formatPaiseINR(12345678).replace(/\u00a0/g, ' ');
    expect(formatted).toBe('₹1,23,456.78');
  });
});

