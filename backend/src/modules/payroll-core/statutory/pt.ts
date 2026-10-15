/**
 * Professional Tax (PT) Engine (PAY-11).
 *
 * Implements multi-state PT slabs with West Bengal baseline (docs/10 §4, Golden G4)
 * and monthly/annual PTRC return register formatting.
 */

import {
  type Paise,
  paise,
} from '../../../core/money/money.js';

export interface PtSlab {
  minGrossPaise: Paise;
  maxGrossPaise: Paise | null;
  ptPaise: Paise;
}

export interface PtrcEmployeeRecord {
  employeeId: number;
  name: string;
  grossPaise: Paise;
  ptPaise: Paise;
}

export interface PtrcRegisterSummary {
  stateCode: string;
  month: string;
  totalEmployees: number;
  totalPtPaise: Paise;
  records: PtrcEmployeeRecord[];
}

/**
 * West Bengal default slabs:
 *   <= ₹10,000: ₹0
 *   ₹10,001 – ₹15,000: ₹110
 *   ₹15,001 – ₹25,000: ₹130
 *   ₹25,001 – ₹40,000: ₹150
 *   > ₹40,000: ₹200
 */
export const WEST_BENGAL_PT_SLABS: PtSlab[] = [
  { minGrossPaise: paise(0), maxGrossPaise: paise(1000000), ptPaise: paise(0) },
  { minGrossPaise: paise(1000001), maxGrossPaise: paise(1500000), ptPaise: paise(11000) },
  { minGrossPaise: paise(1500001), maxGrossPaise: paise(2500000), ptPaise: paise(13000) },
  { minGrossPaise: paise(2500001), maxGrossPaise: paise(4000000), ptPaise: paise(15000) },
  { minGrossPaise: paise(4000001), maxGrossPaise: null, ptPaise: paise(20000) },
];

/**
 * Computes monthly Professional Tax based on state and monthly gross earnings.
 */
export function computePt(grossPaise: Paise, stateCode = 'WB'): Paise {
  const normalizedState = stateCode.toUpperCase();

  if (normalizedState === 'WB') {
    for (const slab of WEST_BENGAL_PT_SLABS) {
      if (slab.maxGrossPaise === null) {
        if (grossPaise >= slab.minGrossPaise) return slab.ptPaise;
      } else if (grossPaise >= slab.minGrossPaise && grossPaise <= slab.maxGrossPaise) {
        return slab.ptPaise;
      }
    }
  }

  // Fallback if state has no PT or gross is below first slab
  return paise(0);
}

/**
 * Generates PTRC monthly register data structure for West Bengal tax authority filing.
 */
export function generatePtrcRegister(
  stateCode: string,
  month: string,
  records: PtrcEmployeeRecord[]
): PtrcRegisterSummary {
  let totalPt = 0;
  for (const r of records) {
    totalPt += r.ptPaise;
  }

  return {
    stateCode,
    month,
    totalEmployees: records.length,
    totalPtPaise: paise(totalPt),
    records,
  };
}
