import { describe, expect, it } from 'vitest';
import { nominationShareProblem } from '../src/modules/lifecycle/onboarding/joining-pack.schema.js';
import { calculateGratuity } from '../src/modules/payroll-core/fnf/gratuity-calculator.js';

describe('joining nominations', () => {
  it('requires each scheme to total 100 percent', () => {
    expect(nominationShareProblem([{ scheme: 'pf', sharePct: 60 }, { scheme: 'pf', sharePct: 40 }])).toBeNull();
    expect(nominationShareProblem([{ scheme: 'gratuity', sharePct: 70 }])).toMatch(/gratuity/);
  });
});

describe('gratuity on death', () => {
  it('pays gratuity before five years when the exit is death', () => {
    const input = { basicMonthlyPaise: 3_000_000, doj: '2024-01-01', lastWorkingDay: '2026-01-01' };
    expect(calculateGratuity(input).isEligible).toBe(false);
    const waived = calculateGratuity({ ...input, waiveMinimumService: true });
    expect(waived.isEligible).toBe(true);
    expect(waived.gratuityPaise).toBeGreaterThan(0);
    expect(waived.calcNote).toMatch(/waived on death/);
  });
});
