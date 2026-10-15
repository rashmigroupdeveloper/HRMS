/**
 * Labour Welfare Fund (LWF) Engine (PAY-12).
 *
 * Implements West Bengal semi-annual deduction schedule (June & December),
 * statutory rates (EE ₹3, ER ₹30), and Form D return data export.
 * Authoritative source: docs/10 §5.
 */

import {
  type Paise,
  paise,
} from '../../../core/money/money.js';

export interface LwfComputeResult {
  isLwfMonth: boolean;
  eeLwfPaise: Paise;
  erLwfPaise: Paise;
}

export interface FormDEmployeeRecord {
  employeeId: number;
  name: string;
  eeLwfPaise: Paise;
  erLwfPaise: Paise;
}

export interface FormDStatement {
  stateCode: string;
  year: number;
  period: 'H1' | 'H2'; // H1: Jan-Jun (due July 15), H2: Jul-Dec (due Jan 15)
  totalEmployees: number;
  totalEeSharePaise: Paise;
  totalErSharePaise: Paise;
  totalRemittancePaise: Paise;
  records: FormDEmployeeRecord[];
}

/**
 * Computes Labour Welfare Fund contributions for the given month.
 * West Bengal schedule: Deducted in June (Month 6) and December (Month 12).
 */
export function computeLwf(month: number, stateCode = 'WB'): LwfComputeResult {
  const normalizedState = stateCode.toUpperCase();

  if (normalizedState === 'WB') {
    // West Bengal: Months 6 (June) and 12 (December)
    if (month === 6 || month === 12) {
      return {
        isLwfMonth: true,
        eeLwfPaise: paise(300), // ₹3
        erLwfPaise: paise(3000), // ₹30 (revised Jan 2024)
      };
    }
  }

  return {
    isLwfMonth: false,
    eeLwfPaise: paise(0),
    erLwfPaise: paise(0),
  };
}

/**
 * Generates official Form D return statement for statutory LWF submission.
 */
export function generateFormDStatement(
  stateCode: string,
  year: number,
  period: 'H1' | 'H2',
  records: FormDEmployeeRecord[]
): FormDStatement {
  let totalEe = 0;
  let totalEr = 0;

  for (const r of records) {
    totalEe += r.eeLwfPaise;
    totalEr += r.erLwfPaise;
  }

  return {
    stateCode,
    year,
    period,
    totalEmployees: records.length,
    totalEeSharePaise: paise(totalEe),
    totalErSharePaise: paise(totalEr),
    totalRemittancePaise: paise(totalEe + totalEr),
    records,
  };
}
