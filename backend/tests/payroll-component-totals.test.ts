/** PAY-04/R20: retain base salary, current inputs and signed arrear reversals. */
import { describe, expect, it } from 'vitest';
import { componentTotals } from '../src/modules/payroll-core/reconciliation/component-totals.js';
describe('Independent component comparison totals', () => {
  it('sums repeated components and signed corrections without mixing employees', () => {
    const totals = componentTotals([
      { employee_id: 1, component_code: 'BASIC', amount: '10000.00' },
      { employee_id: 1, component_code: 'BASIC', amount: '2500.00' },
      { employee_id: 1, component_code: 'BASIC', amount: '-500.00' },
      { employee_id: 2, component_code: 'BASIC', amount: '7000.00' },
      { employee_id: 1, component_code: 'HRA', amount: '5000.00' },
    ]);
    expect(totals.get(1)?.get('BASIC')).toBe(1200000);
    expect(totals.get(2)?.get('BASIC')).toBe(700000);
    expect(totals.get(1)?.get('HRA')).toBe(500000);
  });
});
