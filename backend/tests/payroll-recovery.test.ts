/** PAY-04/08/16: independent recovery goldens, docs/04 §3 F-G and docs/10 G1. */
import { describe, expect, it } from 'vitest';
import { paise } from '../src/core/money/index.js';
import {
  computeEmployeePayroll,
  type ComponentMetadata,
  type EmployeeComputeInput,
} from '../src/modules/payroll-core/engine/compute-engine.js';

const catalog = new Map<string, ComponentMetadata>([
  ...['BASIC', 'HRA', 'MEDICAL_ALLOW', 'SPECIAL_ALLOW', 'EDUCATION_ALLOW', 'STATUTORY_BONUS'].map(
    (code): [string, ComponentMetadata] => [
      code,
      {
        code,
        name: code,
        kind: 'earning',
        partOfGross: true,
        partOfPfWages: code === 'BASIC',
        prorateOnLop: true,
        displayOrder: 10,
      },
    ],
  ),
  [
    'GUEST_HOUSE',
    {
      code: 'GUEST_HOUSE',
      name: 'Guest house recovery',
      kind: 'deduction',
      partOfGross: false,
      partOfPfWages: false,
      prorateOnLop: false,
      displayOrder: 150,
    },
  ],
  [
    'PF_ER',
    {
      code: 'PF_ER',
      name: 'Employer PF',
      kind: 'employer_contribution',
      partOfGross: false,
      partOfPfWages: false,
      prorateOnLop: false,
      displayOrder: 200,
    },
  ],
]);
const baseline: EmployeeComputeInput = {
  employeeId: 1,
  salaryComponentsPaise: { BASIC: paise(1000000) },
  daysInMonth: 30,
  payableDays: 30,
  pfWageCeilingPaise: null,
  esicGrossThresholdPaise: paise(0),
  projectedMonthlyTdsPaise: paise(0),
  lwfPaise: paise(0),
  stateCode: 'WB',
};

describe('Recovery amounts actually reach employee net pay', () => {
  it('deducts a ₹2,500 monthly input: ₹10,000 − ₹1,200 PF − ₹2,500 = ₹6,300', () => {
    const result = computeEmployeePayroll(
      {
        ...baseline,
        variableInputs: [
          { componentCode: 'GUEST_HOUSE', amountPaise: paise(250000), note: 'June recovery' },
        ],
      },
      catalog,
    );
    expect(result.grossPaise).toBe(1000000);
    expect(result.totalDeductionsPaise).toBe(370000);
    expect(result.netPayPaise).toBe(630000);
  });

  it('matches the independent G1 net ₹57,999 including guest house recovery', () => {
    const result = computeEmployeePayroll(
      {
        ...baseline,
        salaryComponentsPaise: {
          BASIC: paise(3228600),
          HRA: paise(1614300),
          MEDICAL_ALLOW: paise(125000),
          SPECIAL_ALLOW: paise(1200500),
          EDUCATION_ALLOW: paise(20000),
          STATUTORY_BONUS: paise(268900),
        },
        variableInputs: [
          { componentCode: 'GUEST_HOUSE', amountPaise: paise(250000), note: 'G1 recovery' },
        ],
      },
      catalog,
    );
    expect(result.grossPaise).toBe(6457300);
    expect(result.totalDeductionsPaise).toBe(657400);
    expect(result.netPayPaise).toBe(5799900);
  });

  it('applies both a deduction arrear and its signed reversal to deductions', () => {
    const result = computeEmployeePayroll(
      {
        ...baseline,
        arrears: [
          {
            componentCode: 'GUEST_HOUSE',
            amountPaise: paise(250000),
            note: 'Prior under-recovery',
          },
          {
            componentCode: 'GUEST_HOUSE',
            amountPaise: paise(-50000),
            note: 'Reverse excess recovery',
          },
        ],
      },
      catalog,
    );
    expect(result.grossPaise).toBe(1000000);
    expect(result.totalDeductionsPaise).toBe(320000);
    expect(result.netPayPaise).toBe(680000);
  });

  it('updates the PF wage base for a BASIC earning adjustment before PF calculation', () => {
    const result = computeEmployeePayroll(
      {
        ...baseline,
        variableInputs: [
          { componentCode: 'BASIC', amountPaise: paise(100000), note: 'Approved basic adjustment' },
        ],
      },
      catalog,
    );
    // ₹11,000 gross; ₹1,320 PF; ₹110 WB PT; net ₹9,570.
    expect(result.totalDeductionsPaise).toBe(143000);
    expect(result.netPayPaise).toBe(957000);
  });

  it('keeps employer contribution adjustments outside employee gross and deductions', () => {
    const result = computeEmployeePayroll(
      {
        ...baseline,
        variableInputs: [
          {
            componentCode: 'PF_ER',
            amountPaise: paise(120000),
            note: 'Employer contribution adjustment',
          },
        ],
      },
      catalog,
    );
    expect(result.grossPaise).toBe(1000000);
    expect(result.totalDeductionsPaise).toBe(120000);
    expect(result.netPayPaise).toBe(880000);
    expect(result.lines.some((line) => line.componentCode === 'PF_ER')).toBe(true);
  });

  it('rejects unknown adjustment components instead of emitting an unclassified payment', () => {
    expect(() =>
      computeEmployeePayroll(
        {
          ...baseline,
          variableInputs: [
            { componentCode: 'UNKNOWN', amountPaise: paise(10000), note: 'Invalid' },
          ],
        },
        catalog,
      ),
    ).toThrow('Unknown payroll component');
  });
});
