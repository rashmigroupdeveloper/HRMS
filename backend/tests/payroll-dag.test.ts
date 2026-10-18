/**
 * Payroll DAG Formula Evaluator & Salary Breakup Tests (PAY-01, PAY-02, docs/10 §13 G1 & G6).
 * Golden fixtures tested to the rupee.
 */
import { describe, expect, it } from 'vitest';
import { fromRupees, toRupees, type Paise } from '../src/core/money/index.js';
import {
  buildAndValidateDag,
  resolveSalaryStructure,
  validateCtcBreakup,
  type ComponentFormulaNode,
} from '../src/modules/payroll-core/structures/dag-evaluator.js';

function getMonthlyPaise(monthly: Record<string, Paise>, code: string): Paise {
  const amount = monthly[code];
  if (amount === undefined) {
    throw new Error(`Expected component '${code}' in evaluated monthly breakup`);
  }
  return amount;
}

describe('Payroll DAG Evaluator', () => {
  it('correctly orders dependent components and detects topological order', () => {
    const nodes: ComponentFormulaNode[] = [
      { code: 'HRA', kind: 'earning', formula: 'BASIC * 0.50' },
      { code: 'BASIC', kind: 'earning', amount: 3228600 },
      { code: 'PF_EE', kind: 'deduction', formula: 'PF_WAGES * 0.12' },
      { code: 'STATUTORY_BONUS', kind: 'earning', formula: 'BASIC * 0.0833' },
    ];

    const { order, dependencies } = buildAndValidateDag(nodes);
    expect(dependencies['HRA']).toEqual(['BASIC']);
    expect(dependencies['STATUTORY_BONUS']).toEqual(['BASIC']);

    // BASIC must come before HRA and STATUTORY_BONUS
    const basicIdx = order.indexOf('BASIC');
    const hraIdx = order.indexOf('HRA');
    const bonusIdx = order.indexOf('STATUTORY_BONUS');
    expect(basicIdx).toBeLessThan(hraIdx);
    expect(basicIdx).toBeLessThan(bonusIdx);
  });

  it('rejects circular dependencies with a clear error message', () => {
    const nodes: ComponentFormulaNode[] = [
      { code: 'COMP_A', kind: 'earning', formula: 'COMP_B * 1.2' },
      { code: 'COMP_B', kind: 'earning', formula: 'COMP_C + 500' },
      { code: 'COMP_C', kind: 'earning', formula: 'COMP_A - 100' },
    ];

    expect(() => buildAndValidateDag(nodes)).toThrow(/Circular dependency detected/);
  });

  it('resolves G1 RML Staff Baseline fixture down to the rupee', () => {
    // Live greytHR May 2026 ground truth (docs/10 §13, docs/09 §2):
    // Basic: 32,286
    // HRA: 16,143 (50%)
    // Medical: 1,250
    // Special: 12,005
    // Education: 200
    // Statutory Bonus: 2,689 (8.33% * Basic)
    // Gross: 64,573
    // Deductions: PF EE 3,874 (12% of actual basic), PT 200, Guest House 2,500
    // Net: 57,999
    const nodes: ComponentFormulaNode[] = [
      { code: 'BASIC', kind: 'earning', amount: 3228600 },
      { code: 'HRA', kind: 'earning', formula: 'BASIC * 0.50' },
      { code: 'MEDICAL_ALLOW', kind: 'earning', amount: 125000 },
      { code: 'SPECIAL_ALLOW', kind: 'earning', amount: 1200500 },
      { code: 'EDUCATION_ALLOW', kind: 'earning', amount: 20000 },
      { code: 'STATUTORY_BONUS', kind: 'earning', formula: 'BASIC * 0.0833' },
      { code: 'PF_EE', kind: 'deduction', formula: 'PF_WAGES * 0.12' },
      { code: 'PT', kind: 'deduction', amount: 20000 },
      { code: 'GUEST_HOUSE', kind: 'deduction', amount: 250000 },
    ];

    const result = resolveSalaryStructure({ nodes });

    expect(toRupees(getMonthlyPaise(result.monthly, 'BASIC'))).toBe(32286);
    expect(toRupees(getMonthlyPaise(result.monthly, 'HRA'))).toBe(16143);
    expect(toRupees(getMonthlyPaise(result.monthly, 'MEDICAL_ALLOW'))).toBe(1250);
    expect(toRupees(getMonthlyPaise(result.monthly, 'SPECIAL_ALLOW'))).toBe(12005);
    expect(toRupees(getMonthlyPaise(result.monthly, 'EDUCATION_ALLOW'))).toBe(200);
    expect(toRupees(getMonthlyPaise(result.monthly, 'STATUTORY_BONUS'))).toBe(2689);

    // Assert exact gross
    expect(toRupees(result.monthlyGross)).toBe(64573);

    // Assert deductions
    expect(toRupees(getMonthlyPaise(result.monthly, 'PF_EE'))).toBe(3874);
    expect(toRupees(getMonthlyPaise(result.monthly, 'PT'))).toBe(200);
    expect(toRupees(getMonthlyPaise(result.monthly, 'GUEST_HOUSE'))).toBe(2500);
    expect(toRupees(result.monthlyDeductions)).toBe(6574);

    // Assert exact Net
    expect(toRupees(result.monthlyNet)).toBe(57999);
  });

  it('resolves G6 Probation 80% structure correctly', () => {
    // 80% probation scaling on earnings
    const nodes: ComponentFormulaNode[] = [
      { code: 'BASIC', kind: 'earning', amount: 5000000 }, // Confirmed 50,000
      { code: 'HRA', kind: 'earning', formula: 'BASIC * 0.50' }, // Confirmed 25,000
      { code: 'SPECIAL_ALLOW', kind: 'earning', amount: 2500000 }, // Confirmed 25,000
    ];

    const confirmed = resolveSalaryStructure({ nodes });
    expect(toRupees(confirmed.monthlyGross)).toBe(100000);

    const probation = resolveSalaryStructure({ nodes, probationPercent: 80 });
    // In probation, 80% of confirmed
    expect(toRupees(getMonthlyPaise(probation.monthly, 'BASIC'))).toBe(40000); // 50,000 * 0.8
    expect(toRupees(getMonthlyPaise(probation.monthly, 'HRA'))).toBe(20000); // 25,000 * 0.8
    expect(toRupees(getMonthlyPaise(probation.monthly, 'SPECIAL_ALLOW'))).toBe(20000); // 25,000 * 0.8
    expect(toRupees(probation.monthlyGross)).toBe(80000);
  });

  it('strict CTC validation rejects discrepancy with exact paise error', () => {
    const nodes: ComponentFormulaNode[] = [
      { code: 'BASIC', kind: 'earning' },
      { code: 'HRA', kind: 'earning' },
    ];

    // Monthly basic 50k, HRA 25k -> Monthly CTC = 75k -> Annual = 9,00,000
    const monthlyComponents = {
      BASIC: fromRupees(50000),
      HRA: fromRupees(25000),
    };

    // Correct annual CTC
    const validCheck = validateCtcBreakup({
      annualCtcPaise: fromRupees(900000),
      monthlyComponents,
      componentNodes: nodes,
    });
    expect(validCheck.valid).toBe(true);
    expect(validCheck.diffPaise).toBe(0);

    // Inconsistent annual CTC (higher)
    const invalidCheckHigher = validateCtcBreakup({
      annualCtcPaise: fromRupees(905000),
      monthlyComponents,
      componentNodes: nodes,
    });
    expect(invalidCheckHigher.valid).toBe(false);
    expect(invalidCheckHigher.diffPaise).toBe(500000); // 5,000 rupees = 500,000 paise
    expect(invalidCheckHigher.message).toContain('Annual CTC');
    expect(invalidCheckHigher.message).toContain('higher');
    expect(invalidCheckHigher.message).toContain('500000 paise');

    // Inconsistent annual CTC (lower)
    const invalidCheckLower = validateCtcBreakup({
      annualCtcPaise: fromRupees(895000),
      monthlyComponents,
      componentNodes: nodes,
    });
    expect(invalidCheckLower.valid).toBe(false);
    expect(invalidCheckLower.diffPaise).toBe(-500000);
    expect(invalidCheckLower.message).toContain('lower');
  });

  it('handles duplicate codes and external formula identifiers gracefully', () => {
    const dupNodes: ComponentFormulaNode[] = [
      { code: 'BASIC', kind: 'earning', amount: 1000 },
      { code: 'BASIC', kind: 'earning', amount: 2000 },
    ];
    expect(() => buildAndValidateDag(dupNodes)).toThrow(/Duplicate component code/);

    // Dependency not in nodeMap (external variable, e.g. PF_WAGES)
    const extNodes: ComponentFormulaNode[] = [
      { code: 'PF_EE', kind: 'deduction', formula: 'PF_WAGES * 0.12' },
    ];
    const { order, dependencies } = buildAndValidateDag(extNodes);
    expect(order).toEqual(['PF_EE']);
    expect(dependencies['PF_EE']).toEqual(['PF_WAGES']);
  });

  it('evaluates all supported math functions, rounding modes, and handles balancing components', () => {
    const nodes: ComponentFormulaNode[] = [
      { code: 'BASIC', kind: 'earning', amount: 3000000, rounding: 'floor' },
      { code: 'HRA', kind: 'earning', formula: 'round(BASIC * 0.455)', rounding: 'ceil' },
      { code: 'BONUS', kind: 'earning', formula: 'min(floor(BASIC * 0.1), 2500)', rounding: 'nearest_10' },
      { code: 'INCENTIVE', kind: 'earning', formula: 'max(ceil(BASIC * 0.05), 1000)', rounding: 'round' },
      { code: 'SPECIAL_ALLOW', kind: 'earning', amount: 0 },
      { code: 'PF_ER', kind: 'employer_contribution', formula: 'min(PF_WAGES_CAPPED * 0.12, 1800)' },
      { code: 'PF_EE', kind: 'deduction', formula: 'min(PF_WAGES_CAPPED * 0.12, 1800)' },
    ];

    // Target monthly CTC of 60,000 rupees (6,000,000 paise)
    const res = resolveSalaryStructure({
      nodes,
      monthlyCtcPaise: fromRupees(60000),
      fixedOverrides: { BONUS: fromRupees(2000) },
    });

    expect(res.monthly['BONUS']).toBe(fromRupees(2000));
    expect(res.monthlyGross).toBeGreaterThan(0);
    expect(res.monthlyEmployerCost).toBeGreaterThan(0);
    expect(res.monthlyDeductions).toBeGreaterThan(0);
    expect(res.monthlyNet).toBe(res.monthlyGross - res.monthlyDeductions);
    expect(res.monthlyCtc).toBe(fromRupees(60000));

    // When target CTC is smaller than other components, SPECIAL_ALLOW becomes 0
    const resSmall = resolveSalaryStructure({
      nodes,
      annualCtcPaise: fromRupees(120000), // 10,000 per month, lower than BASIC 30,000
    });
    expect(resSmall.monthly['SPECIAL_ALLOW']).toBe(0);
  });

  it('handles formula validation errors: unknown variable, invalid characters, non-finite, and syntax error', () => {
    // 1. Unknown variable
    const nodeUnknown: ComponentFormulaNode[] = [
      { code: 'TEST', kind: 'earning', formula: 'NONEXISTENT_VAR * 2' },
    ];
    expect(() => resolveSalaryStructure({ nodes: nodeUnknown })).toThrow(/Unknown variable/);

    // 2. Invalid characters
    const nodeBadChar: ComponentFormulaNode[] = [
      { code: 'TEST', kind: 'earning', formula: '100 + 50 @#$' },
    ];
    expect(() => resolveSalaryStructure({ nodes: nodeBadChar })).toThrow(/Invalid characters/);

    // 3. Division by zero returning infinity
    const nodeInf: ComponentFormulaNode[] = [
      { code: 'TEST', kind: 'earning', formula: '100 / 0' },
    ];
    expect(() => resolveSalaryStructure({ nodes: nodeInf })).toThrow(/did not return a finite number/);

    // 4. Malformed syntax
    const nodeSyntax: ComponentFormulaNode[] = [
      { code: 'TEST', kind: 'earning', formula: '(100 +' },
    ];
    expect(() => resolveSalaryStructure({ nodes: nodeSyntax })).toThrow(/Error evaluating formula/);
  });
});
