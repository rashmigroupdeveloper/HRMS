/**
 * Retroactive Arrears Engine — Recompute-and-Delta (PAY-16, doc 14 §7.2, SOW crosswalk).
 *
 * Immutable period doctrine:
 *   Closed periods are NEVER edited. When a backdated salary revision occurs,
 *   we recompute shadow historical results for each affected month and record
 *   the delta in `pay.arrears` to be disbursed in the active open payroll run.
 */

import { type Paise, paise, add, subtract } from '../../../core/money/index.js';

export interface RetroMonthComparison {
  forMonth: string; // YYYY-MM-01
  componentCode: string;
  historicalPaise: Paise;
  revisedPaise: Paise;
  deltaPaise: Paise;
}

export interface ArrearScheduleItem {
  employeeId: number;
  sourceSalaryId: number;
  forMonth: string;
  componentCode: string;
  amountPaise: Paise;
}

/**
 * Compute component-wise deltas between historical amounts and revised amounts.
 */
export function computeRetroDeltas(
  forMonth: string,
  historicalComponents: Record<string, Paise>,
  revisedComponents: Record<string, Paise>
): RetroMonthComparison[] {
  const comparisons: RetroMonthComparison[] = [];
  const allCodes = new Set([
    ...Object.keys(historicalComponents),
    ...Object.keys(revisedComponents),
  ]);

  for (const code of allCodes) {
    const historical = historicalComponents[code] ?? paise(0);
    const revised = revisedComponents[code] ?? paise(0);
    const delta = subtract(revised, historical);

    if (delta !== 0) {
      comparisons.push({
        forMonth,
        componentCode: code,
        historicalPaise: historical,
        revisedPaise: revised,
        deltaPaise: delta,
      });
    }
  }

  return comparisons;
}

/**
 * Aggregate total arrears across multiple past months for a run.
 */
export function aggregateArrearsForRun(
  arrearItems: ArrearScheduleItem[]
): {
  totalArrearsPaise: Paise;
  byComponent: Record<string, Paise>;
  itemCount: number;
} {
  let total = paise(0);
  const byComp: Record<string, Paise> = {};

  for (const item of arrearItems) {
    total = add(total, item.amountPaise);
    const cur = byComp[item.componentCode] ?? paise(0);
    byComp[item.componentCode] = add(cur, item.amountPaise);
  }

  return {
    totalArrearsPaise: total,
    byComponent: byComp,
    itemCount: arrearItems.length,
  };
}
